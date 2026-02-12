import crypto from "node:crypto";

export function signWebhook(secret: string, timestamp: string, body: string) {
  // signature over: <timestamp>.<body>
  const h = crypto.createHmac("sha256", secret);
  h.update(`${timestamp}.${body}`);
  return h.digest("hex");
}
