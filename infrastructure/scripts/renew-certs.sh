#!/usr/bin/env bash
# Renew Let's Encrypt certs and reload nginx. Schedule via host cron (twice daily).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" --profile certs)

"${COMPOSE[@]}" run --rm certbot renew --webroot -w /var/www/certbot
"${COMPOSE[@]}" exec nginx nginx -s reload

echo "[renew-certs] ok"
