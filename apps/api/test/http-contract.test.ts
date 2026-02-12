import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "@maildog/db";
import { authHeader, buildTestApp, devSeed, truncateAll } from "./helpers.js";

let app: Awaited<ReturnType<typeof buildTestApp>>;
let apiKey: string;
let tenantId: string;

beforeAll(async () => {
  app = await buildTestApp();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await truncateAll();
  const seed = await devSeed(app);
  apiKey = seed.apiKey;
  tenantId = seed.tenantId;
});

describe("Auth (SendGrid-style Bearer API key)", () => {
  it("rejects missing Authorization header", async () => {
    const res = await request(app.server).get("/v1/templates");
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toMatch(/Missing Authorization/i);
  });

  it("rejects invalid API key prefix", async () => {
    const res = await request(app.server)
      .get("/v1/templates")
      .set({ Authorization: "Bearer sg_fake" });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toMatch(/prefix/i);
  });
});

describe("POST /v1/mail/send (+ /v3/mail/send alias)", () => {
  const payload = {
    from: { email: "from@example.com", name: "From" },
    to: [{ email: "to@example.com", name: "To" }],
    subject: "Hello",
    text: "Hi"
  };

  it("enqueues mail (202) on v1", async () => {
    const res = await request(app.server)
      .post("/v1/mail/send")
      .set(authHeader(apiKey))
      .send(payload);

    expect(res.statusCode).toBe(202);
    expect(res.body.status).toBe("queued");
    expect(res.body.messageId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("enqueues mail (202) on v3 (SendGrid-compatible alias)", async () => {
    const res = await request(app.server)
      .post("/v3/mail/send")
      .set(authHeader(apiKey))
      .send(payload);

    expect(res.statusCode).toBe(202);
    expect(res.body.status).toBe("queued");
  });

  it("returns a 400 validation error for invalid payload", async () => {
    const res = await request(app.server)
      .post("/v1/mail/send")
      .set(authHeader(apiKey))
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("validation_error");
    expect(Array.isArray(res.body.issues)).toBe(true);
  });

  it("rejects suppressed recipients", async () => {
    await request(app.server)
      .post("/v1/suppressions")
      .set(authHeader(apiKey))
      .send({ email: "to@example.com", reason: "unsubscribe" })
      .expect(200);

    const res = await request(app.server)
      .post("/v1/mail/send")
      .set(authHeader(apiKey))
      .send(payload);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Suppressed/i);
    expect(res.body.suppressed?.[0]?.email).toBe("to@example.com");
  });
});

describe("Suppressions + public unsubscribe", () => {
  it("creates suppression via public unsubscribe endpoint (no auth)", async () => {
    const res = await request(app.server)
      .get("/v1/public/unsubscribe")
      .query({ tenantId, email: "person@example.com" });

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);

    const list = await request(app.server)
      .get("/v1/suppressions")
      .set(authHeader(apiKey));

    expect(list.statusCode).toBe(200);
    expect(list.body.some((s: any) => s.email === "person@example.com" && s.reason === "unsubscribe")).toBe(true);
  });
});

describe("Templates", () => {
  it("supports CRUD-ish operations", async () => {
    const created = await request(app.server)
      .post("/v1/templates")
      .set(authHeader(apiKey))
      .send({ name: "Welcome", subject: "Hi", html: "<b>Hi</b>", text: "Hi" });

    expect(created.statusCode).toBe(200);
    expect(created.body.id).toBeTruthy();

    const list = await request(app.server)
      .get("/v1/templates")
      .set(authHeader(apiKey));

    expect(list.statusCode).toBe(200);
    expect(list.body.length).toBe(1);

    const get = await request(app.server)
      .get(`/v1/templates/${created.body.id}`)
      .set(authHeader(apiKey));

    expect(get.statusCode).toBe(200);
    expect(get.body.name).toBe("Welcome");

    const updated = await request(app.server)
      .put(`/v1/templates/${created.body.id}`)
      .set(authHeader(apiKey))
      .send({ subject: "Hello" });

    expect(updated.statusCode).toBe(200);
    expect(updated.body.ok).toBe(true);
  });
});

describe("Events ingest + analytics", () => {
  it("ingests delivered event and updates message status", async () => {
    const sendRes = await request(app.server)
      .post("/v1/mail/send")
      .set(authHeader(apiKey))
      .send({
        from: { email: "from@example.com" },
        to: [{ email: "to@example.com" }],
        subject: "Hello",
        text: "Hi"
      });

    expect(sendRes.statusCode).toBe(202);

    const messageId = sendRes.body.messageId;

    const ingest = await request(app.server)
      .post("/v1/events/ingest")
      .set(authHeader(apiKey))
      .send({ messageId, type: "delivered", payload: { provider: "test" } });

    expect(ingest.statusCode).toBe(200);
    expect(ingest.body.ok).toBe(true);

    const msg = await prisma.message.findFirst({ where: { id: messageId } });
    expect(msg?.status).toBe("delivered");

    const summary = await request(app.server)
      .get("/v1/analytics/summary")
      .set(authHeader(apiKey));

    expect(summary.statusCode).toBe(200);
    expect(summary.body.messagesByStatus.delivered).toBe(1);
    expect(summary.body.eventsByType.delivered).toBe(1);
    expect(summary.body.eventsByType.queued).toBe(1);
  });
});

describe("Webhook endpoint CRUD", () => {
  it("creates, lists, updates, deletes webhook endpoints", async () => {
    const created = await request(app.server)
      .post("/v1/webhooks")
      .set(authHeader(apiKey))
      .send({ url: "https://example.com/webhook", events: ["delivered"] });

    expect(created.statusCode).toBe(200);
    expect(created.body.id).toBeTruthy();

    const list1 = await request(app.server)
      .get("/v1/webhooks")
      .set(authHeader(apiKey));

    expect(list1.statusCode).toBe(200);
    expect(list1.body.length).toBe(1);

    const updated = await request(app.server)
      .put(`/v1/webhooks/${created.body.id}`)
      .set(authHeader(apiKey))
      .send({ enabled: false });

    expect(updated.statusCode).toBe(200);
    expect(updated.body.ok).toBe(true);

    const del = await request(app.server)
      .delete(`/v1/webhooks/${created.body.id}`)
      .set(authHeader(apiKey));

    expect(del.statusCode).toBe(200);
    expect(del.body.ok).toBe(true);

    const list2 = await request(app.server)
      .get("/v1/webhooks")
      .set(authHeader(apiKey));

    expect(list2.statusCode).toBe(200);
    expect(list2.body.length).toBe(0);
  });
});
