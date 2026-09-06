# =============================================================================
# HIS-Lite Web — multi-stage (development | builder | production)
# Build context: repository root
#   docker build -f apps/web/Dockerfile --target production \
#     --build-arg VITE_API_URL=https://api.hislite.in/api/v1 -t hislite-web .
# =============================================================================

FROM node:20-alpine AS base

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
COPY apps/web ./apps/web
COPY packages ./packages

EXPOSE 3000
CMD ["npm", "run", "dev", "--workspace=@his-lite/web", "--", "--host", "0.0.0.0"]

# -----------------------------------------------------------------------------
FROM base AS builder

ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL

RUN npm ci
COPY apps/web ./apps/web
COPY packages ./packages
RUN npm run build --workspace=@his-lite/web

# -----------------------------------------------------------------------------
FROM nginx:alpine AS production

# SPA only — edge nginx (compose) terminates TLS and proxies /api
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
