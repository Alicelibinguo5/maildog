import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@maildog/db";
import { SendEmailRequestSchema } from "@maildog/shared";
import { mailQueue, webhookQueue } from "../queue/queues.js";

export const emailRoutes: FastifyPluginAsync = async (app) => {
  const handler = async (req: any, reply: any) => {
    const body = SendEmailRequestSchema.parse(req.body);

    // suppression check (basic: per-recipient)
    const suppressed = await prisma.suppression.findMany({
      where: { tenantId: req.tenantId, email: { in: body.to.map(t => t.email) } },
      select: { email: true, reason: true }
    });
    if (suppressed.length > 0) {
      // For MVP: reject whole request if any recipient suppressed
      return reply.code(400).send({
        message: "Suppressed recipient(s)",
        suppressed
      });
    }

    // MVP: one message per recipient (easier analytics/events)
    const first = body.to[0];

    const message = await prisma.message.create({
      data: {
        tenantId: req.tenantId,
        fromEmail: body.from.email,
        fromName: body.from.name,
        toEmail: first.email,
        toName: first.name,
        subject: body.subject,
        text: body.text,
        html: body.html,
        templateId: body.templateId,
        templateData: body.templateData,
        headers: body.headers,
        tags: body.tags ?? [],
        status: "queued"
      }
    });

    const evt = await prisma.messageEvent.create({
      data: {
        tenantId: req.tenantId,
        messageId: message.id,
        type: "queued",
        payload: { apiKeyId: req.apiKeyId }
      }
    });

    await mailQueue.add("send", { messageId: message.id, tenantId: req.tenantId });
    await webhookQueue.add("deliver", { tenantId: req.tenantId, eventId: evt.id });

    // SendGrid returns 202 Accepted for enqueue.
    return reply.code(202).send({ messageId: message.id, status: "queued" });
  };

  // MailDog canonical endpoint
  app.post("/v1/mail/send", handler);

  // SendGrid-compatible alias (v3)
  app.post("/v3/mail/send", handler);
};
