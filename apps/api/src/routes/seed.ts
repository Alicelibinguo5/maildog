import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@maildog/db";
import crypto from "node:crypto";
import { env } from "../lib/env.js";

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function randomKey(bytes = 24) {
  return env.API_KEY_PREFIX + crypto.randomBytes(bytes).toString("hex");
}

// DEV ONLY: creates a tenant + api key
export const seedRoutes: FastifyPluginAsync = async (app) => {
  app.post("/v1/public/dev/seed", async (req, reply) => {
    if (env.NODE_ENV === "production") {
      return reply.code(404).send({ error: "not_found" });
    }

    const tenant = await prisma.tenant.create({ data: { name: "Dev Tenant" } });
    const apiKey = randomKey();
    await prisma.apiKey.create({
      data: {
        tenantId: tenant.id,
        name: "dev",
        prefix: env.API_KEY_PREFIX,
        hashedKey: sha256(apiKey),
        last4: apiKey.slice(-4)
      }
    });

    return {
      tenantId: tenant.id,
      apiKey,
      mailhogUi: "http://localhost:8025"
    };
  });
};
