import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  MAIL_TRANSPORT: z.string().default("smtp_sink"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  WEBHOOK_SIGNING_SECRET: z.string().default("REPLACE_ME")
});

export const env = EnvSchema.parse(process.env);
