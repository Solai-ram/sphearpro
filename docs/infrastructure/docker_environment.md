# Docker / Development Environment

**Phase 0 Deliverable #11** — Covers §40, §1575–1613

---

## 1. Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  # ─────────────────────────────────────────────
  # PostgreSQL 15
  # ─────────────────────────────────────────────
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: his_lite
      POSTGRES_USER: his_lite
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-dev_password}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infrastructure/docker/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U his_lite -d his_lite"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─────────────────────────────────────────────
  # Redis 7 (cache + BullMQ)
  # ─────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  # ─────────────────────────────────────────────
  # MinIO (S3-compatible for local dev)
  # ─────────────────────────────────────────────
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  # ─────────────────────────────────────────────
  # Mailpit (email testing)
  # ─────────────────────────────────────────────
  mailpit:
    image: axllent/mailpit:latest
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # Web UI
    volumes:
      - mailpit_data:/data

  # ─────────────────────────────────────────────
  # NestJS Backend
  # ─────────────────────────────────────────────
  backend:
    build:
      context: .
      dockerfile: infrastructure/docker/Dockerfile.api
      target: development
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://his_lite:dev_password@postgres:5432/his_lite?schema=public
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: ${MINIO_ROOT_USER:-minioadmin}
      S3_SECRET_KEY: ${MINIO_ROOT_PASSWORD:-minioadmin}
      S3_BUCKET: his-lite
      JWT_SECRET: ${JWT_SECRET:-dev_jwt_secret_change_in_prod}
      JWT_EXPIRES_IN: 15m
      REFRESH_TOKEN_SECRET: ${REFRESH_TOKEN_SECRET:-dev_refresh_secret}
      REFRESH_TOKEN_EXPIRES_IN: 7d
      OPENAPI_ENABLED: "true"
      PORT: 3001
    ports:
      - "3001:3001"
    volumes:
      - ./apps/api:/app/apps/api
      - ./packages:/app/packages
      - /app/apps/api/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    command: npm run start:dev

  # ─────────────────────────────────────────────
  # BullMQ Worker (background jobs)
  # ─────────────────────────────────────────────
  worker:
    build:
      context: .
      dockerfile: infrastructure/docker/Dockerfile.api
      target: development
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://his_lite:dev_password@postgres:5432/his_lite?schema=public
      REDIS_URL: redis://redis:6379
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: ${MINIO_ROOT_USER:-minioadmin}
      S3_SECRET_KEY: ${MINIO_ROOT_PASSWORD:-minioadmin}
      S3_BUCKET: his-lite
    volumes:
      - ./apps/api:/app/apps/api
      - ./packages:/app/packages
      - /app/apps/api/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: npm run worker:dev

  # ─────────────────────────────────────────────
  # React Frontend (Vite dev server)
  # ─────────────────────────────────────────────
  frontend:
    build:
      context: .
      dockerfile: infrastructure/docker/Dockerfile.web
      target: development
    environment:
      NODE_ENV: development
      VITE_API_BASE: http://localhost:3001/api/v1
      VITE_APP_NAME: HIS-Lite
    ports:
      - "5173:5173"
    volumes:
      - ./apps/web:/app/apps/web
      - ./packages:/app/packages
      - /app/apps/web/node_modules
    depends_on:
      - backend
    command: npm run dev -- --host 0.0.0.0

  # ─────────────────────────────────────────────
  # NGINX (reverse proxy for local prod-like testing)
  # ─────────────────────────────────────────────
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./infrastructure/nginx/dev.conf:/etc/nginx/nginx.conf:ro
      - ./infrastructure/nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - backend
    profiles:
      - prod-local

volumes:
  postgres_data:
  redis_data:
  minio_data:
  mailpit_data:

networks:
  default:
    name: his-lite-network
```

---

## 2. Dockerfiles

### 2.1 Backend (NestJS)

```dockerfile
# infrastructure/docker/Dockerfile.api
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache python3 make g++ # for native deps

# ─────────────────────────────────────────────
# Development stage
# ─────────────────────────────────────────────
FROM base AS development
COPY package*.json ./
COPY packages ./packages
COPY apps/api/package*.json ./apps/api/
RUN npm ci --workspaces --include-workspace-root

COPY . .
EXPOSE 3001
CMD ["npm", "run", "start:dev", "--workspace=apps/api"]

# ─────────────────────────────────────────────
# Builder stage
# ─────────────────────────────────────────────
FROM base AS builder
COPY package*.json ./
COPY packages ./packages
COPY apps/api/package*.json ./apps/api/
RUN npm ci --workspaces --include-workspace-root --production=false

COPY . .
RUN npm run build --workspace=apps/api

# ─────────────────────────────────────────────
# Production stage
# ─────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./

USER nestjs
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

### 2.2 Frontend (React + Vite)

```dockerfile
# infrastructure/docker/Dockerfile.web
FROM node:20-alpine AS base
WORKDIR /app

# ─────────────────────────────────────────────
# Development
# ─────────────────────────────────────────────
FROM base AS development
COPY package*.json ./
COPY packages ./packages
COPY apps/web/package*.json ./apps/web/
RUN npm ci --workspaces --include-workspace-root

COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--workspace=apps/web", "--", "--host", "0.0.0.0"]

# ─────────────────────────────────────────────
# Builder
# ─────────────────────────────────────────────
FROM base AS builder
COPY package*.json ./
COPY packages ./packages
COPY apps/web/package*.json ./apps/web/
RUN npm ci --workspaces --include-workspace-root --production=false

COPY . .
RUN npm run build --workspace=apps/web

# ─────────────────────────────────────────────
# Production (served by NGINX)
# ─────────────────────────────────────
FROM nginx:alpine AS production
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY infrastructure/nginx/prod.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## 3. NGINX Configs

### 3.1 Development (prod-local profile)

```nginx
# infrastructure/nginx/dev.conf
events { worker_connections 1024; }

http {
  upstream backend {
    server backend:3001;
  }
  
  upstream frontend {
    server frontend:5173;
  }

  server {
    listen 80;
    server_name localhost;

    # Frontend (Vite HMR)
    location / {
      proxy_pass http://frontend;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
      proxy_cache_bypass $http_upgrade;
    }

    # API
    location /api/ {
      proxy_pass http://backend;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket for BullMQ monitoring (if needed)
    location /ws/ {
      proxy_pass http://backend;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
    }
  }
}
```

### 3.2 Production

```nginx
# infrastructure/nginx/prod.conf
server {
  listen 80;
  server_name _;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name _;

  ssl_certificate /etc/nginx/ssl/cert.pem;
  ssl_certificate_key /etc/nginx/ssl/key.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;

  # Security headers
  add_header X-Frame-Options "SAMEORIGIN";
  add_header X-Content-Type-Options "nosniff";
  add_header Referrer-Policy "strict-origin-when-cross-origin";
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=()";

  # Static assets (React build)
  location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
      expires 1y;
      add_header Cache-Control "public, immutable";
    }
  }

  # API proxy
  location /api/ {
    proxy_pass http://backend:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Timeouts
    proxy_connect_timeout 30s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
  }

  # Health check
  location /health {
    access_log off;
    return 200 "healthy\n";
  }
}
```

---

## 4. Environment Files

```bash
# .env.example (commit this)
POSTGRES_PASSWORD=dev_password
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
JWT_SECRET=dev_jwt_secret_change_in_prod
REFRESH_TOKEN_SECRET=dev_refresh_secret
S3_BUCKET=his-lite
OPENAPI_ENABLED=true

# .env.local (gitignored - actual secrets)
# POSTGRES_PASSWORD=...
# JWT_SECRET=...
# OPENROUTER_API_KEY=...
# SARVAM_API_KEY=...
# WHATSAPP_API_KEY=...
```

---

## 5. Init Script (PostgreSQL)

```sql
-- infrastructure/docker/init.sql
-- Run on first container start

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fuzzy search

-- Create read-only role for reporting (future)
CREATE ROLE his_lite_readonly;
GRANT USAGE ON SCHEMA public TO his_lite_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO his_lite_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO his_lite_readonly;
```

---

## 6. Usage Commands

```bash
# Start all services (dev)
docker compose up -d

# Start with NGINX (prod-like local)
docker compose --profile prod-local up -d

# View logs
docker compose logs -f backend
docker compose logs -f worker
docker compose logs -f frontend

# Run Prisma migrations
docker compose exec backend npx prisma migrate dev

# Seed database
docker compose exec backend npx prisma db seed

# Open Prisma Studio
docker compose exec backend npx prisma studio

# Access MinIO console: http://localhost:9001
# Access Mailpit: http://localhost:8025
# Access API docs: http://localhost:3001/api/docs

# Stop
docker compose down

# Stop + remove volumes (clean slate)
docker compose down -v
```

---

## 7. Production Deployment Notes (§1613)

For the **current VPS Docker Compose production path (Phase 11)**, see:

- [`docker-compose.prod.yml`](../../docker-compose.prod.yml)
- [`.env.production.example`](../../.env.production.example)
- [`docs/DEPLOY-PRODUCTION.md`](../DEPLOY-PRODUCTION.md)

Longer-term / larger-scale options:

| Component | Production Recommendation |
|-----------|---------------------------|
| PostgreSQL | Managed service (AWS RDS / Azure Database / GCP Cloud SQL) with automated backups, read replicas |
| Redis | Managed (ElastiCache / Azure Cache / Memorystore) with persistence (AOF) |
| S3 | AWS S3 / MinIO cluster / Cloudflare R2 with versioning |
| Compute | Kubernetes (EKS/GKE/AKS) or ECS/Fargate; or VMs with systemd |
| NGINX | Ingress controller (NGINX Ingress / Traefik) with cert-manager for TLS |
| Monitoring | Sentry + Grafana + Loki + Prometheus |
| CI/CD | GitHub Actions → build images → push to registry → ArgoCD/Flux deploy |
| Secrets | External secret manager (Vault / AWS Secrets Manager / Azure Key Vault) |