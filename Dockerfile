FROM node:22-bookworm-slim
WORKDIR /app

# Prisma engines need OpenSSL available
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy monorepo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY apps ./apps

# Install deps
RUN pnpm install --frozen-lockfile=false

# Generate Prisma client + build TS packages needed at runtime
RUN pnpm --filter @maildog/db prisma:generate \
  && pnpm --filter @maildog/shared build \
  && pnpm --filter @maildog/db build \
  && pnpm --filter @maildog/api build \
  && pnpm --filter @maildog/worker build

# Runtime
ENV NODE_ENV=production
ENV ROLE=api

EXPOSE 3000

CMD ["sh", "-lc", "if [ \"$ROLE\" = \"worker\" ]; then node apps/worker/dist/worker.js; else node apps/api/dist/server.js; fi"]
