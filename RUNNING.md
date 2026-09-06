# HIS-Lite - Running the Application

## Ports

| Service | Port | URL |
|---------|------|-----|
| **Web (Frontend - Vite)** | 3002 | http://localhost:3002 |
| **API (Backend - NestJS)** | 4000 | http://localhost:4000/api/v1 |
| **API Health Check** | 4000 | http://localhost:4000/api/v1/health |
| **API Swagger Docs** | 4000 | http://localhost:4000/api/docs |

> **Note**: Vite will automatically use the next available port if 3002 is in use (tries 3000, 3001, 3002, etc.)

---

## Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- PostgreSQL (running via Docker)
- Redis (running via Docker)

---

## Quick Start

### 1. Start Infrastructure (PostgreSQL, Redis, MinIO, Mailpit)

```bash
# From project root
npm run docker:up
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379
- MinIO (S3-compatible storage) on port 9000 (console: 9001)
- Mailpit (email testing) on port 8025 (SMTP: 1025)

### 2. Install Dependencies

```bash
# From project root - installs all workspaces
npm install
```

### 3. Set up Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# (Optional) Seed with sample data
npm run db:seed
```

### 4. Start Development Servers

```bash
# From project root - starts both web and API concurrently
npm run dev
```

This runs:
- `npm run dev:web` → Vite dev server on port 3002
- `npm run dev:api` → NestJS API on port 4000

---

## Individual Commands

### Web (Frontend) Only

```bash
cd apps/web
npm run dev          # Start Vite dev server
npm run build        # Production build
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint
npm run test         # Vitest unit tests
```

### API (Backend) Only

```bash
cd apps/api
npm run start:dev    # Start NestJS in watch mode (port 4000)
npm run build        # Production build
npm run start:prod   # Run production build
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint
npm run test         # Vitest unit tests
```

### Database Commands

```bash
cd apps/api
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run pending migrations
npm run db:migrate:dev   # Create & run migration (dev)
npm run db:push          # Push schema changes (no migration file)
npm run db:studio        # Open Prisma Studio (GUI)
npm run db:seed          # Seed database with sample data
```

### Docker Commands

```bash
npm run docker:up        # Start all containers
npm run docker:down      # Stop all containers
npm run docker:logs      # Follow container logs
npm run docker:build     # Build all images
npm run docker:build:prod # Build production images
```

---

## Environment Variables

### API (`apps/api/.env`)

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/his_lite?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=your-refresh-secret-change-in-production
REFRESH_TOKEN_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3002

# MinIO (S3-compatible)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=his-lite
S3_REGION=us-east-1

# OpenAPI/Swagger
OPENAPI_ENABLED=true

# Port
PORT=4000
```

### Web (`apps/web/.env`)

```env
VITE_API_URL=http://localhost:4000/api/v1
```

---

## API Endpoints (v1)

### Authentication
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/logout` - Logout
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password
- `GET /api/v1/auth/me` - Current user profile

### Patients
- `GET /api/v1/patients` - List patients (paginated)
- `GET /api/v1/patients/search?q=` - Search patients
- `GET /api/v1/patients/number/:patientNumber` - Get by patient number
- `GET /api/v1/patients/:id` - Get patient by ID
- `GET /api/v1/patients/:id/stats` - Patient statistics
- `GET /api/v1/patients/:id/timeline` - Patient timeline
- `GET /api/v1/patients/:id/documents` - Patient documents
- `POST /api/v1/patients` - Create patient
- `PATCH /api/v1/patients/:id` - Update patient
- `DELETE /api/v1/patients/:id` - Soft delete patient

### Appointments
- `GET /api/v1/appointments` - List appointments
- `GET /api/v1/appointments/patient/:patientId` - Patient appointments
- `GET /api/v1/appointments/:id` - Get appointment
- `POST /api/v1/appointments` - Create appointment
- `PATCH /api/v1/appointments/:id/status` - Update status
- `PATCH /api/v1/appointments/:id/reschedule` - Reschedule
- `DELETE /api/v1/appointments/:id` - Cancel appointment

### Reception
- `GET /api/v1/reception/queue` - Today's queue
- `GET /api/v1/reception/queue/stats` - Queue statistics
- `POST /api/v1/reception/check-in` - Check-in patient
- `PATCH /api/v1/reception/queue/:id/call` - Call patient
- `PATCH /api/v1/reception/queue/:id/start` - Start consultation
- `PATCH /api/v1/reception/queue/:id/complete` - Complete consultation
- `PATCH /api/v1/reception/queue/:id/no-show` - Mark no-show
- `PATCH /api/v1/reception/queue/reorder` - Reorder queue (drag-and-drop)

### Staff
- `GET /api/v1/staff` - List staff
- `GET /api/v1/staff/:id` - Get staff
- `GET /api/v1/staff/:id/schedule` - Staff schedule
- `POST /api/v1/staff` - Create staff
- `PATCH /api/v1/staff/:id` - Update staff
- `PATCH /api/v1/staff/:id/schedule` - Update schedule
- `DELETE /api/v1/staff/:id` - Delete staff

### Documents
- `POST /api/v1/documents/patients/:patientId` - Upload document
- `GET /api/v1/documents/patients/:patientId` - List patient documents
- `GET /api/v1/documents/categories` - Document categories
- `GET /api/v1/documents/:id` - Get document
- `GET /api/v1/documents/:id/download` - Download document
- `DELETE /api/v1/documents/:id` - Delete document

### RBAC
- `GET /api/v1/users` - List users
- `GET /api/v1/roles` - List roles
- `GET /api/v1/permissions` - List permissions
- `POST /api/v1/users/:id/roles` - Assign role
- `DELETE /api/v1/users/:id/roles/:roleId` - Remove role
- `POST /api/v1/users/:id/permissions` - Grant permission
- `DELETE /api/v1/users/:id/permissions/:permissionId` - Revoke permission
- `POST /api/v1/roles/:id/permissions` - Assign permission to role
- `DELETE /api/v1/roles/:id/permissions/:permissionId` - Remove permission from role

### Health
- `GET /api/v1/health` - Health check
- `GET /api/v1/health/ready` - Readiness probe
- `GET /api/v1/health/live` - Liveness probe

---

## Troubleshooting

### Port Already in Use

**Web (Vite):**
```bash
# Kill process on port 3002
npx kill-port 3002

# Or let Vite auto-select next port (3003, 3004, etc.)
```

**API (NestJS):**
```bash
# Kill process on port 4000
npx kill-port 4000

# Or change PORT in apps/api/.env
```

### Database Connection Failed
```bash
# Ensure Docker containers are running
npm run docker:up

# Check PostgreSQL logs
docker compose logs postgres

# Reset database
npm run docker:down
docker volume rm his-lite_postgres_data
npm run docker:up
npm run db:migrate
npm run db:seed
```

### TypeScript Errors
```bash
# Check both workspaces
npm run typecheck

# Or individually
cd apps/web && npm run typecheck
cd apps/api && npm run typecheck
```

### Module Not Found
```bash
# Reinstall all dependencies
rm -rf node_modules apps/*/node_modules packages/*/node_modules
npm install
```

---

## Project Structure

```
his-lite/
├── apps/
│   ├── web/          # React + Vite + TypeScript frontend
│   └── api/          # NestJS + TypeScript backend
├── packages/
│   ├── shared-types/ # Shared TypeScript types
│   ├── eslint-config/
│   └── tsconfig/
├── prisma/
│   ├── schema.prisma # Database schema
│   └── seed.ts       # Database seeding
├── infrastructure/
│   ├── docker/       # Docker configurations
│   └── nginx/        # Nginx configs
└── docs/             # Documentation
```

---

## Default Credentials (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@his-lite.local | Admin@123 |
| Doctor | doctor@his-lite.local | Doctor@123 |
| Receptionist | reception@his-lite.local | Reception@123 |
| Therapist | therapist@his-lite.local | Therapist@123 |

---

## Useful Links

- **Frontend**: http://localhost:3002
- **API Base**: http://localhost:4000/api/v1
- **Swagger UI**: http://localhost:4000/api/docs
- **Health Check**: http://localhost:4000/api/v1/health
- **Prisma Studio**: `npm run db:studio` (typically http://localhost:5555)
- **MinIO Console**: http://localhost:9001 (minioadmin / minioadmin)
- **Mailpit**: http://localhost:8025