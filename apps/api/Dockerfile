FROM node:22-alpine AS base
WORKDIR /app

# Install deps
COPY package.json /app/package.json
COPY pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY pnpm-lock.yaml /app/pnpm-lock.yaml
COPY packages /app/packages
COPY apps/api /app/apps/api

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN pnpm -C /app install --frozen-lockfile=false

# Test target (run with: docker build --target test -t maildog-api-test .
# Then: docker run --rm --network host -e DATABASE_URL=... maildog-api-test)
FROM base AS test
WORKDIR /app
ENV NODE_ENV=test
CMD ["pnpm", "--filter", "@maildog/api", "test"]

# Dev target
FROM base AS dev
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["pnpm", "dev"]
