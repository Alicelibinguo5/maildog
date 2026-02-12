import { prisma } from "@maildog/db";
import { env } from "../lib/env.js";
import { signWebhook } from "./signing.js";

export async function deliverEventWebhook(input: { tenantId: string; eventId: string }) {
  const evt = await prisma.messageEvent.findFirst({
    where: { id: input.eventId, tenantId: input.tenantId },
    include: { message: true }
  });
  if (!evt) return;

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { tenantId: input.tenantId, enabled: true }
  });

  if (endpoints.length === 0) return;

  const eventPayload = {
    id: evt.id,
    type: evt.type,
    tenantId: evt.tenantId,
    messageId: evt.messageId,
    timestamp: evt.createdAt.toISOString(),
    payload: evt.payload ?? undefined,
    message: {
      to: evt.message.toEmail,
      from: evt.message.fromEmail,
      subject: evt.message.subject,
      tags: evt.message.tags
    }
  };

  const body = JSON.stringify(eventPayload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signWebhook(env.WEBHOOK_SIGNING_SECRET, timestamp, body);

  await Promise.all(
    endpoints
      .filter((e) => e.events.includes(evt.type))
      .map(async (e) => {
        try {
          const res = await fetch(e.url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-maildog-timestamp": timestamp,
              "x-maildog-signature": signature
            },
            body
          });

          // MVP: best-effort only (no retries). Next: BullMQ retries + DLQ.
          if (!res.ok) {
            console.warn("webhook delivery failed", e.url, res.status);
          }
        } catch (err) {
          console.warn("webhook delivery error", e.url, err);
        }
      })
  );
}
