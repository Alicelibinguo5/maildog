import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@maildog/db";
import { buildTestApp } from "./helpers.js";

let app: Awaited<ReturnType<typeof buildTestApp>>;

beforeAll(async () => {
  app = await buildTestApp();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("OpenAPI schema snapshot", () => {
  it("exposes a stable-ish OpenAPI document", async () => {
    // Provided by @fastify/swagger
    const doc = (app as any).swagger();

    // Keep snapshot small and stable.
    expect({
      openapi: doc.openapi,
      info: doc.info,
      paths: Object.keys(doc.paths).sort(),
      components: Object.keys(doc.components ?? {}).sort()
    }).toMatchSnapshot();
  });
});
