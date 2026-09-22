#!/usr/bin/env bash
# Mirror MinIO document bucket to local archive + optional off-VPS S3.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups/minio}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${BACKUP_DIR}/minio_${STAMP}"
RETENTION_DAILY="${BACKUP_RETENTION_DAILY:-7}"

mkdir -p "${BACKUP_DIR}"
SRC_ALIAS="${MINIO_ALIAS:-src}"
SRC_BUCKET="${S3_BUCKET:-hislite-documents}"

mc alias set "${SRC_ALIAS}" "${S3_ENDPOINT:-http://minio:9000}" \
  "${S3_ACCESS_KEY:?}" "${S3_SECRET_KEY:?}" >/dev/null

echo "[backup-minio] mirroring ${SRC_BUCKET} → ${OUT}"
mkdir -p "${OUT}"
mc mirror --overwrite "${SRC_ALIAS}/${SRC_BUCKET}" "${OUT}"

tar -C "${BACKUP_DIR}" -czf "${OUT}.tar.gz" "$(basename "${OUT}")"
rm -rf "${OUT}"

ls -1t "${BACKUP_DIR}"/minio_*.tar.gz 2>/dev/null | tail -n +"$((RETENTION_DAILY + 1))" | xargs -r rm -f

if [[ -n "${BACKUP_S3_ENDPOINT:-}" && -n "${BACKUP_S3_BUCKET:-}" ]]; then
  mc alias set backupdest "${BACKUP_S3_ENDPOINT}" "${BACKUP_S3_ACCESS_KEY}" "${BACKUP_S3_SECRET_KEY}" >/dev/null
  mc cp "${OUT}.tar.gz" "backupdest/${BACKUP_S3_BUCKET}/minio/$(basename "${OUT}.tar.gz")"
fi

echo "[backup-minio] ok $(basename "${OUT}.tar.gz")"
