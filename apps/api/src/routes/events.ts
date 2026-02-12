import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@maildog/db";
import { z } from "zod";
import { webhookQueue } from "../queue/queues.js";

// Event ingestion endpoints (typically called by provider webhooks).
// MVP: allow dev to POST events for testing.
export const eventRoutes: FastifyPluginAsync = async (app) => {
  app.post("/v1/events/ingest", async (req) => {
    const body = z.object({
      messageId: z.string().uuid(),
      type: z.enum(["delivered", "bounce", "complaint", "open", "click"]),
      payload: z.record(z.any()).optional()
    }).parse(req.body);

    const msg = await prisma.message.findFirst({ where: { id: body.messageId, tenantId: req.tenantId } });
    if (!msg) throw app.httpErrors.notFound("Message not found");

    const evt = await prisma.messageEvent.create({
      data: {
        tenantId: req.tenantId,
        messageId: msg.id,
        type: body.type,
        payload: body.payload
      }
    });

    await webhookQueue.add("deliver", { tenantId: req.tenantId, eventId: evt.id });

    // Update status if terminal-ish
    if (body.type === "delivered") {
      await prisma.message.update({ where: { id: msg.id }, data: { status: "delivered" } });
    }
    if (body.type === "bounce") {
      await prisma.message.update({ where: { id: msg.id }, data: { status: "bounce" } });
      await prisma.suppression.upsert({
        where: { tenantId_email: { tenantId: req.tenantId, email: msg.toEmail } },
        update: { reason: "bounce" },
        create: { tenantId: req.tenantId, email: msg.toEmail, reason: "bounce" }
      });
    }
    if (body.type === "complaint") {
      await prisma.message.update({ where: { id: msg.id }, data: { status: "complaint" } });
      await prisma.suppression.upsert({
        where: { tenantId_email: { tenantId: req.tenantId, email: msg.toEmail } },
        update: { reason: "complaint" },
        create: { tenantId: req.tenantId, email: msg.toEmail, reason: "complaint" }
      });
    }

    return { ok: true };
  });

  app.get("/v1/analytics/summary", async (req) => {
    const since = z.object({
      since: z.string().datetime().optional()
    }).parse(req.query);

    const sinceDate = since.since ? new Date(since.since) : new Date(Date.now() - 7 * 24 * 3600 * 1000);

    const [messages, events] = await Promise.all([
      prisma.message.groupBy({
        by: ["status"],
        where: { tenantId: req.tenantId, createdAt: { gte: sinceDate } },
        _count: { _all: true }
      }),
      prisma.messageEvent.groupBy({
        by: ["type"],
        where: { tenantId: req.tenantId, createdAt: { gte: sinceDate } },
        _count: { _all: true }
      })
    ]);

    return {
      since: sinceDate.toISOString(),
      messagesByStatus: Object.fromEntries(messages.map(m => [m.status, m._count._all])),
      eventsByType: Object.fromEntries(events.map(e => [e.type, e._count._all]))
    };
  });
};
