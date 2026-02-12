export type SendMailInput = {
  from: { email: string; name?: string };
  to: { email: string; name?: string };
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
};

export type SendMailResult = {
  provider: string;
  providerMsgId?: string;
};

export interface MailAdapter {
  name: string;
  send(input: SendMailInput): Promise<SendMailResult>;
}
