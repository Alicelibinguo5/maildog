import { prisma } from "@maildog/db";
import Mustache from "mustache";
import { createMailWorker, createWebhookWorker } from "./queue/worker.js";
import { webhookQueue } from "./queue/queues.js";
import { getMailAdapter } from "./mail/index.js";
import { deliverEventWebhook } from "./webhooks/deliver.js";

const adapter = getMailAdapter();

const mailWorker = createMailWorker(async (job) => {
  if (job.name !== "send") return;

  const { messageId, tenantId } = job.data as { messageId: string; tenantId: string };

  const msg = await prisma.message.findFirst({
    where: { id: messageId, tenantId },
  });
  if (!msg) {
    return;
  }

  // Render template if present
  let subject = msg.subject;
  let html = msg.html ?? undefined;
  let text = msg.text ?? undefined;

  if (msg.templateId) {
    const tpl = await prisma.template.findFirst({ where: { id: msg.templateId, tenantId } });
    if (tpl) {
      const data = (msg.templateData ?? {}) as Record<string, any>;
      subject = Mustache.render(tpl.subject, data);
      html = Mustache.render(tpl.html, data);
      text = tpl.text ? Mustache.render(tpl.text, data) : text;
    }
  }

  const res = await adapter.send({
    from: { email: msg.fromEmail, name: msg.fromName ?? undefined },
    to: { email: msg.toEmail, name: msg.toName ?? undefined },
    subject,
    html,
    text,
    headers: (msg.headers ?? undefined) as any
  });

  await prisma.message.update({
    where: { id: msg.id },
    data: {
      status: "sent",
      provider: res.provider,
      providerMsgId: res.providerMsgId
    }
  });

  const evt = await prisma.messageEvent.create({
    data: {
      tenantId,
      messageId: msg.id,
      type: "sent",
      payload: { provider: res.provider, providerMsgId: res.providerMsgId }
    }
  });

  // best-effort: enqueue webhook delivery
  await webhookQueue.add("deliver", { tenantId, eventId: evt.id });
});

mailWorker.on("failed", (job, err) => {
  // TODO: mark message failed + retry policy
  console.error("mail job failed", job?.id, err);
});

const webhookWorker = createWebhookWorker(async (job) => {
  if (job.name !== "deliver") return;
  const { tenantId, eventId } = job.data as { tenantId: string; eventId: string };
  await deliverEventWebhook({ tenantId, eventId });
});

webhookWorker.on("failed", (job, err) => {
  console.error("webhook job failed", job?.id, err);
});

console.log(`maildog worker started (adapter=${adapter.name})`);
