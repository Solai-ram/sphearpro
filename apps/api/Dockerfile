# =============================================================================
# HIS-Lite API — multi-stage (development | builder | production)
# Build context: repository root
#   docker build -f apps/api/Dockerfile --target production -t hislite-api .
# =============================================================================

FROM node:20-alpine AS base

RUN apk add --no-cache \
    dumb-init \
    openssl \
    libc6-compat \
    python3 \
    make \
    g++ \
    postgresql-client

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/eslint-config/package.json ./packages/eslint-config/

# -----------------------------------------------------------------------------
FROM base AS development

RUN npm ci
COPY prisma ./prisma
COPY apps/api ./apps/api
COPY packages ./packages
RUN npx prisma generate --schema=prisma/schema.prisma

EXPOSE 4000
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start:dev", "--workspace=@his-lite/api"]

# -----------------------------------------------------------------------------
FROM base AS builder

RUN npm ci
COPY prisma ./prisma
COPY apps/api ./apps/api
COPY packages ./packages
RUN npx prisma generate --schema=prisma/schema.prisma
RUN npm run build --workspace=@his-lite/api

# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

RUN apk add --no-cache \
    dumb-init \
    openssl \
    libc6-compat \
    postgresql-client \
    wget

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/eslint-config/package.json ./packages/eslint-config/

# Production deps + Prisma CLI (needed for `migrate deploy` in release)
RUN npm ci --omit=dev && \
    npm install prisma@5.10.0 --no-save --workspace-root && \
    npm cache clean --force

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

RUN chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:4000/api/v1/health/live || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
