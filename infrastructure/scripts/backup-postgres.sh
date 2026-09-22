#!/usr/bin/env bash
# Daily Postgres backup → local retention → optional off-VPS S3 upload.
# Intended to run inside the `backup` container or via host cron.
#
# Env: POSTGRES_*, BACKUP_RETENTION_DAILY (default 7),
#      BACKUP_S3_* (optional off-box), BACKUP_DIR (default /backups)

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups/postgres}"
RETENTION_DAILY="${BACKUP_RETENTION_DAILY:-7}"
RETENTION_WEEKLY="${BACKUP_RETENTION_WEEKLY:-4}"
RETENTION_MONTHLY="${BACKUP_RETENTION_MONTHLY:-3}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DAY="$(date -u +%u)"   # 1=Mon … 7=Sun
DOM="$(date -u +%d)"
FILE="hislite_${STAMP}.sql.gz"
PATH_OUT="${BACKUP_DIR}/daily/${FILE}"

mkdir -p "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly" "${BACKUP_DIR}/monthly"

echo "[backup-postgres] dumping ${POSTGRES_DB:-hislite} → ${PATH_OUT}"
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${POSTGRES_HOST:-postgres}" \
  -U "${POSTGRES_USER:-hislite}" \
  -d "${POSTGRES_DB:-hislite}" \
  --format=plain \
  --no-owner \
  --no-acl \
  | gzip -c > "${PATH_OUT}"

# Weekly (Sunday) + monthly (1st) copies
if [[ "$DAY" == "7" ]]; then
  cp "${PATH_OUT}" "${BACKUP_DIR}/weekly/"
fi
if [[ "$DOM" == "01" ]]; then
  cp "${PATH_OUT}" "${BACKUP_DIR}/monthly/"
fi

# Retention (count files, delete oldest)
prune() {
  local dir="$1" keep="$2"
  ls -1t "${dir}"/*.sql.gz 2>/dev/null | tail -n +"$((keep + 1))" | xargs -r rm -f
}
prune "${BACKUP_DIR}/daily" "$RETENTION_DAILY"
prune "${BACKUP_DIR}/weekly" "$RETENTION_WEEKLY"
prune "${BACKUP_DIR}/monthly" "$RETENTION_MONTHLY"

# Off-VPS upload (optional)
if [[ -n "${BACKUP_S3_ENDPOINT:-}" && -n "${BACKUP_S3_BUCKET:-}" ]]; then
  echo "[backup-postgres] uploading to ${BACKUP_S3_BUCKET}"
  if command -v aws >/dev/null 2>&1; then
    AWS_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY}" \
    AWS_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_KEY}" \
    aws --endpoint-url "${BACKUP_S3_ENDPOINT}" s3 cp "${PATH_OUT}" \
      "s3://${BACKUP_S3_BUCKET}/postgres/daily/${FILE}"
  elif command -v mc >/dev/null 2>&1; then
    mc alias set backupdest "${BACKUP_S3_ENDPOINT}" "${BACKUP_S3_ACCESS_KEY}" "${BACKUP_S3_SECRET_KEY}" >/dev/null
    mc cp "${PATH_OUT}" "backupdest/${BACKUP_S3_BUCKET}/postgres/daily/${FILE}"
  else
    echo "[backup-postgres] WARN: no aws/mc client; local backup only" >&2
  fi
fi

echo "[backup-postgres] ok ${FILE}"
