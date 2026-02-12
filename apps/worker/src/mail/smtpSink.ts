import nodemailer from "nodemailer";
import type { MailAdapter, SendMailInput, SendMailResult } from "./adapter.js";
import { env } from "../lib/env.js";

// Dev adapter: sends via SMTP to a local sink (MailHog), not the real world.
export class SmtpSinkAdapter implements MailAdapter {
  name = "smtp_sink";

  private transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
    ignoreTLS: true
  });

  async send(input: SendMailInput): Promise<SendMailResult> {
    const info = await this.transport.sendMail({
      from: input.from.name ? `${input.from.name} <${input.from.email}>` : input.from.email,
      to: input.to.name ? `${input.to.name} <${input.to.email}>` : input.to.email,
      subject: input.subject,
      text: input.text,
      html: input.html,
      headers: input.headers
    });

    return { provider: this.name, providerMsgId: info.messageId };
  }
}
