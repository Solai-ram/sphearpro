#!/usr/bin/env bash
# Restore a gzipped pg_dump into a TARGET database (never overwrite prod blindly).
#
# Usage:
#   ./infrastructure/scripts/restore-postgres.sh /backups/postgres/daily/hislite_….sql.gz
#
# Required env: POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
# Optional: RESTORE_CONFIRM=YES

set -euo pipefail

DUMP="${1:?Usage: restore-postgres.sh <dump.sql.gz>}"
if [[ "${RESTORE_CONFIRM:-}" != "YES" ]]; then
  echo "Refusing restore. Set RESTORE_CONFIRM=YES after verifying target DB." >&2
  echo "Target: ${POSTGRES_HOST:-postgres}/${POSTGRES_DB:-hislite}" >&2
  exit 1
fi

echo "[restore] loading ${DUMP} into ${POSTGRES_DB}"
gunzip -c "${DUMP}" | PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h "${POSTGRES_HOST:-postgres}" \
  -U "${POSTGRES_USER:-hislite}" \
  -d "${POSTGRES_DB:-hislite}" \
  -v ON_ERROR_STOP=1

echo "[restore] done — verify table counts and app /health"
