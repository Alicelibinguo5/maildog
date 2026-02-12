import { z } from "zod";

// Shared DTOs and validators (API + dashboard)

export const SendEmailRequestSchema = z.object({
  from: z.object({
    email: z.string().email(),
    name: z.string().optional()
  }),
  to: z.array(
    z.object({
      email: z.string().email(),
      name: z.string().optional()
    })
  ).min(1),
  subject: z.string().min(1),
  text: z.string().optional(),
  html: z.string().optional(),
  templateId: z.string().uuid().optional(),
  templateData: z.record(z.any()).optional(),
  headers: z.record(z.string()).optional(),
  tags: z.array(z.string()).optional()
}).refine(v => v.text || v.html || v.templateId, {
  message: "Must provide text/html or templateId"
});

export type SendEmailRequest = z.infer<typeof SendEmailRequestSchema>;

export type SendEmailResponse = {
  messageId: string;
  status: "queued";
};

export type MaildogEventType =
  | "queued"
  | "sent"
  | "delivered"
  | "bounce"
  | "complaint"
  | "open"
  | "click"
  | "unsubscribe";

export type WebhookEvent = {
  id: string;
  type: MaildogEventType;
  tenantId: string;
  messageId: string;
  timestamp: string; // ISO
  payload?: Record<string, unknown>;
};
