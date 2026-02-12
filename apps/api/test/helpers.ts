import type { FastifyInstance } from "fastify";
import request from "supertest";
import { prisma } from "@maildog/db";
import { buildApp } from "../src/app.js";

export async function truncateAll() {
  // Order doesn't matter with CASCADE, but keep it explicit.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE 
      "MessageEvent",
      "Message",
      "WebhookEndpoint",
      "Suppression",
      "Template",
      "ApiKey",
      "Tenant"
    RESTART IDENTITY CASCADE;
  `);
}

export async function buildTestApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

export async function devSeed(app: FastifyInstance) {
  const res = await request(app.server)
    .post("/v1/public/dev/seed")
    .send({});

  if (res.statusCode !== 200) {
    throw new Error(`Seed failed: ${res.statusCode} ${JSON.stringify(res.body)}`);
  }

  return res.body as { tenantId: string; apiKey: string };
}

export function authHeader(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}` };
}
