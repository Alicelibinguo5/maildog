FROM node:22-alpine AS base
WORKDIR /app

COPY package.json /app/package.json
COPY pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY pnpm-lock.yaml /app/pnpm-lock.yaml
COPY packages /app/packages
COPY apps/worker /app/apps/worker

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN pnpm -C /app install --frozen-lockfile=false

FROM base AS dev
WORKDIR /app/apps/worker
CMD ["pnpm", "dev"]
