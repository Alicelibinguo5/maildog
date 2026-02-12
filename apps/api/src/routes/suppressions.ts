import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@maildog/db";
import { z } from "zod";

export const suppressionRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/suppressions", async (req) => {
    return prisma.suppression.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: "desc" }
    });
  });

  app.post("/v1/suppressions", async (req) => {
    const body = z.object({
      email: z.string().email(),
      reason: z.enum(["bounce", "complaint", "unsubscribe", "manual"]).default("manual")
    }).parse(req.body);

    return prisma.suppression.upsert({
      where: { tenantId_email: { tenantId: req.tenantId, email: body.email } },
      update: { reason: body.reason },
      create: { tenantId: req.tenantId, email: body.email, reason: body.reason }
    });
  });

  app.delete("/v1/suppressions/:email", async (req) => {
    const params = z.object({ email: z.string().email() }).parse(req.params);
    await prisma.suppression.deleteMany({ where: { tenantId: req.tenantId, email: params.email } });
    return { ok: true };
  });

  // Public unsubscribe link
  // MVP: /v1/public/unsubscribe?tenantId=...&email=...
  app.get("/v1/public/unsubscribe", async (req) => {
    const q = z.object({
      tenantId: z.string().uuid(),
      email: z.string().email()
    }).parse(req.query);

    await prisma.suppression.upsert({
      where: { tenantId_email: { tenantId: q.tenantId, email: q.email } },
      update: { reason: "unsubscribe" },
      create: { tenantId: q.tenantId, email: q.email, reason: "unsubscribe" }
    });

    return { ok: true, message: "You have been unsubscribed." };
  });
};
