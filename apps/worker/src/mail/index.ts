import { env } from "../lib/env.js";
import type { MailAdapter } from "./adapter.js";
import { NoopMailAdapter } from "./noop.js";
import { SmtpSinkAdapter } from "./smtpSink.js";

export function getMailAdapter(): MailAdapter {
  switch (env.MAIL_TRANSPORT) {
    case "smtp_sink":
      return new SmtpSinkAdapter();
    case "noop":
      return new NoopMailAdapter();
    default:
      // Future: SES/SendGrid/Mailgun adapters
      return new NoopMailAdapter();
  }
}
