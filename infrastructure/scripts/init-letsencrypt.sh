#!/usr/bin/env bash
# Bootstrap Let's Encrypt certificates for SPHEAR (sphearpro.tech).
# DNS A/AAAA for apex, www, and api must already point at this VPS.
#
# Usage:
#   export CERTBOT_EMAIL=you@sphearpro.tech
#   ./infrastructure/scripts/init-letsencrypt.sh
#
# Optional:
#   CERTBOT_STAGING=1   # Let's Encrypt staging (rate-limit safe)
#   ENV_FILE=.env.production

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" --profile certs)
APP_DOMAIN="${APP_DOMAIN:-sphearpro.tech}"
WWW_DOMAIN="${WWW_DOMAIN:-www.sphearpro.tech}"
API_DOMAIN="${API_DOMAIN:-api.sphearpro.tech}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:?Set CERTBOT_EMAIL}"
STAGING_ARGS=()
if [[ -n "${CERTBOT_STAGING:-}" ]]; then
  STAGING_ARGS=(--staging)
fi

echo "==> Ensure data volumes exist"
"${COMPOSE[@]}" up --no-start nginx certbot

echo "==> Seed dummy certs so nginx can bind :443 on first boot"
"${COMPOSE[@]}" run --rm --entrypoint sh certbot -c "
set -e
apk add --no-cache openssl >/dev/null
for d in ${APP_DOMAIN} ${API_DOMAIN}; do
  dir=/etc/letsencrypt/live/\$d
  mkdir -p \"\$dir\"
  if [ ! -f \"\$dir/fullchain.pem\" ]; then
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
      -keyout \"\$dir/privkey.pem\" \
      -out \"\$dir/fullchain.pem\" \
      -subj \"/CN=\$d\"
    echo \"dummy cert for \$d\"
  fi
done
"

echo "==> Start nginx for ACME HTTP-01"
"${COMPOSE[@]}" up -d nginx

echo "==> Request certificate (app + www)"
"${COMPOSE[@]}" run --rm certbot certonly --webroot \
  -w /var/www/certbot \
  "${STAGING_ARGS[@]}" \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  --force-renewal \
  -d "$APP_DOMAIN" \
  -d "$WWW_DOMAIN"

echo "==> Request certificate (api)"
"${COMPOSE[@]}" run --rm certbot certonly --webroot \
  -w /var/www/certbot \
  "${STAGING_ARGS[@]}" \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  --force-renewal \
  -d "$API_DOMAIN"

echo "==> Reload nginx with real certificates"
"${COMPOSE[@]}" exec nginx nginx -s reload

echo "Done. Renew with: docker compose -f docker-compose.prod.yml --env-file .env.production run --rm certbot renew && docker compose -f docker-compose.prod.yml --env-file .env.production exec nginx nginx -s reload"
