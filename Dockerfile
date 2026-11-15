# Сборка: зависимости → prisma generate → nest build; в итоговый образ — prod-зависимости и dist.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm prisma generate && pnpm build

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY prisma.config.ts ./
EXPOSE 4000
# Миграции применяются при старте контейнера, затем запускается API.
CMD ["sh", "-c", "pnpm dlx prisma@7.10.1 migrate deploy && node dist/main"]
