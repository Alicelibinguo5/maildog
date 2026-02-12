import { Worker } from "bullmq";
import { env } from "../lib/env.js";

const connection = { url: env.REDIS_URL };

export function createMailWorker(processFn: (job: any) => Promise<any>) {
  return new Worker("mail", async (job) => processFn(job), { connection });
}

export function createWebhookWorker(processFn: (job: any) => Promise<any>) {
  return new Worker("webhooks", async (job) => processFn(job), { connection });
}
