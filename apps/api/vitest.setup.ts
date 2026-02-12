import { vi } from "vitest";

process.env.NODE_ENV ||= "test";
process.env.PORT ||= "0";
process.env.API_KEY_PREFIX ||= "md_";
process.env.WEBHOOK_SIGNING_SECRET ||= "REDACTED";

// Default local dev dependencies (docker-compose).
process.env.DATABASE_URL ||= "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5435/${POSTGRES_DB}";
process.env.REDIS_URL ||= "redis://localhost:6381";

// Avoid requiring Redis in tests (and avoid background jobs).
vi.mock("bullmq", () => {
  class Queue {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_name: string, _opts: any) {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async add(_name: string, _data: any) {
      return { id: "test" };
    }
  }
  return { Queue };
});
