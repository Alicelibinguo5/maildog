import { Queue } from "bullmq";
import { env } from "../lib/env.js";

const connection = { url: env.REDIS_URL };

export const mailQueue = new Queue("mail", { connection });
export const webhookQueue = new Queue("webhooks", { connection });
