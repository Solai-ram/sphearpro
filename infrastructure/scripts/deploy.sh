#!/usr/bin/env bash
# Production deploy sequence (§85). Run on the VPS from the repo root.
#   ./infrastructure/scripts/deploy.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE")

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing ${ENV_FILE}. Copy .env.production.example and fill secrets." >&2
  exit 1
fi

echo "==> git pull"
git pull --ff-only

echo "==> build"
"${COMPOSE[@]}" build

echo "==> migrate deploy (never migrate reset)"
"${COMPOSE[@]}" run --rm api npx prisma migrate deploy --schema=prisma/schema.prisma

echo "==> up -d"
"${COMPOSE[@]}" up -d

echo "==> ps"
"${COMPOSE[@]}" ps

echo "==> health"
sleep 5
curl -fsS "https://${API_DOMAIN:-api.sphearpro.tech}/api/v1/health" || \
  "${COMPOSE[@]}" exec -T api wget -qO- http://127.0.0.1:4000/api/v1/health || true

echo "Deploy complete. Tail logs: ${COMPOSE[*]} logs -f api"
