#!/usr/bin/env bash
# Cron entrypoint inside the backup container (runs daily at 02:00 UTC by default).
set -euo pipefail

echo "[backup-cron] starting"
/scripts/backup-postgres.sh
/scripts/backup-minio.sh || echo "[backup-cron] minio backup failed" >&2
echo "[backup-cron] finished"
