import type { MailAdapter, SendMailInput, SendMailResult } from "./adapter.js";

export class NoopMailAdapter implements MailAdapter {
  name = "noop";
  async send(_input: SendMailInput): Promise<SendMailResult> {
    return { provider: this.name, providerMsgId: undefined };
  }
}
