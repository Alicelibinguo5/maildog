import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@maildog/db";
import { z } from "zod";

export const templateRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/templates", async (req) => {
    return prisma.template.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { updatedAt: "desc" }
    });
  });

  app.post("/v1/templates", async (req) => {
    const body = z.object({
      name: z.string().min(1),
      subject: z.string().min(1),
      html: z.string().min(1),
      text: z.string().optional()
    }).parse(req.body);

    return prisma.template.create({
      data: { ...body, tenantId: req.tenantId }
    });
  });

  app.get("/v1/templates/:id", async (req) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const t = await prisma.template.findFirst({ where: { id: params.id, tenantId: req.tenantId } });
    if (!t) throw app.httpErrors.notFound();
    return t;
  });

  app.put("/v1/templates/:id", async (req) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({
      name: z.string().min(1).optional(),
      subject: z.string().min(1).optional(),
      html: z.string().min(1).optional(),
      text: z.string().optional()
    }).parse(req.body);

    const t = await prisma.template.updateMany({
      where: { id: params.id, tenantId: req.tenantId },
      data: body
    });
    if (t.count === 0) throw app.httpErrors.notFound();
    return { ok: true };
  });
};
