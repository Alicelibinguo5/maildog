import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { ZodError } from "zod";

import { authPlugin } from "./plugins/auth.js";

import { healthRoutes } from "./routes/health.js";
import { seedRoutes } from "./routes/seed.js";
import { emailRoutes } from "./routes/emails.js";
import { templateRoutes } from "./routes/templates.js";
import { suppressionRoutes } from "./routes/suppressions.js";
import { eventRoutes } from "./routes/events.js";
import { webhookRoutes } from "./routes/webhooks.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(sensible);

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: "validation_error",
        issues: err.issues
      });
    }

    // fall back to Fastify's default formatting for httpErrors, etc.
    reply.send(err);
  });

  await app.register(swagger, {
    openapi: {
      info: { title: "MailDog API", version: "0.1.0" }
    }
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  await app.register(healthRoutes);
  await app.register(seedRoutes);

  await app.register(authPlugin);
  await app.register(emailRoutes);
  await app.register(templateRoutes);
  await app.register(suppressionRoutes);
  await app.register(eventRoutes);
  await app.register(webhookRoutes);

  app.get("/", async () => ({ name: "maildog", docs: "/docs" }));

  return app;
}
