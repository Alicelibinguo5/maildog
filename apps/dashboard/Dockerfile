FROM node:22-alpine
WORKDIR /app

COPY package.json /app/package.json
COPY pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY pnpm-lock.yaml /app/pnpm-lock.yaml
COPY packages /app/packages
COPY apps/dashboard /app/apps/dashboard

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN pnpm -C /app install --frozen-lockfile=false

WORKDIR /app/apps/dashboard
EXPOSE 5173
CMD ["pnpm", "dev"]
