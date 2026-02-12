import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@maildog/db";
import { z } from "zod";

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/webhooks", async (req) => {
    return prisma.webhookEndpoint.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { updatedAt: "desc" }
    });
  });

  app.post("/v1/webhooks", async (req) => {
    const body = z.object({
      url: z.string().url(),
      enabled: z.boolean().optional(),
      events: z.array(z.string()).min(1) // validate on client for now
    }).parse(req.body);

    return prisma.webhookEndpoint.create({
      data: {
        tenantId: req.tenantId,
        url: body.url,
        enabled: body.enabled ?? true,
        events: body.events
      }
    });
  });

  app.put("/v1/webhooks/:id", async (req) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({
      url: z.string().url().optional(),
      enabled: z.boolean().optional(),
      events: z.array(z.string()).min(1).optional()
    }).parse(req.body);

    const updated = await prisma.webhookEndpoint.updateMany({
      where: { id: params.id, tenantId: req.tenantId },
      data: body
    });

    if (updated.count === 0) throw app.httpErrors.notFound();
    return { ok: true };
  });

  app.delete("/v1/webhooks/:id", async (req) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    await prisma.webhookEndpoint.deleteMany({ where: { id: params.id, tenantId: req.tenantId } });
    return { ok: true };
  });
};
