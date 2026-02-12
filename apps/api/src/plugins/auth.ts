import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { prisma } from "@maildog/db";
import crypto from "node:crypto";
import { env } from "../lib/env.js";

declare module "fastify" {
  interface FastifyRequest {
    tenantId: string;
    apiKeyId: string;
  }
}

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

// API key format: <prefix><random>
// Store sha256(fullKey) and last4 for display.
const plugin: FastifyPluginAsync = async (app) => {
  // Ensure these exist on the request object for routes.
  app.decorateRequest("tenantId", "");
  app.decorateRequest("apiKeyId", "");

  app.addHook("preHandler", async (req) => {
    // Public routes
    if (req.url.startsWith("/health") || req.url.startsWith("/docs") || req.url.startsWith("/v1/public")) {
      return;
    }

    const header = req.headers.authorization;
    if (!header || !header.toLowerCase().startsWith("bearer ")) {
      throw app.httpErrors.unauthorized("Missing Authorization: Bearer <API_KEY>");
    }

    const apiKey = header.slice("bearer ".length).trim();
    if (!apiKey.startsWith(env.API_KEY_PREFIX)) {
      throw app.httpErrors.unauthorized("Invalid API key prefix");
    }

    const hashedKey = sha256(apiKey);
    const key = await prisma.apiKey.findFirst({
      where: { hashedKey, revokedAt: null },
      select: { id: true, tenantId: true },
    });

    if (!key) {
      throw app.httpErrors.unauthorized("Invalid or revoked API key");
    }

    req.tenantId = key.tenantId;
    req.apiKeyId = key.id;
  });
};

// fastify-plugin disables encapsulation so the auth hook applies to subsequently-registered routes.
export const authPlugin = fp(plugin, { name: "maildog-auth" });
