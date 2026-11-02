#!/usr/bin/env bash
# ==============================================================================
# SPHEARPRO (HIS-LITE) ONE-CLICK PUSH & DEPLOY SCRIPT
# ==============================================================================
# Usage:
#   ./deploy.sh
#   ./deploy.sh "your custom commit message"
# ==============================================================================
set -euo pipefail

COMMIT_MSG="${1:-auto deploy: $(date '+%Y-%m-%d %H:%M:%S')}"
VPS_HOST="root@200.234.45.171"
VPS_DIR="/opt/his-lite"

echo "=========================================================="
echo " [1/4] Pushing code to GitHub (main & feature branches)..."
echo "=========================================================="
git add -A
# Commit only if there are changes
if git diff-index --quiet HEAD --; then
  echo "No new local changes to commit. Pushing existing commits..."
else
  git commit -m "$COMMIT_MSG"
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git push origin "$CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "Syncing changes into main branch..."
  git checkout main
  git merge "$CURRENT_BRANCH"
  git push origin main
  git checkout "$CURRENT_BRANCH"
fi

echo ""
echo "=========================================================="
echo " [2/4] Connecting to VPS ($VPS_HOST) and pulling code..."
echo "=========================================================="
ssh -o StrictHostKeyChecking=accept-new "$VPS_HOST" "bash -s" << 'EOF'
set -euo pipefail
cd /opt/his-lite

echo "--> Pulling latest changes from main branch..."
git pull origin main

echo ""
echo "=========================================================="
echo " [3/4] Rebuilding and updating production containers..."
echo "=========================================================="
# Build any updated containers (web / api)
docker compose --env-file .env.production -f docker-compose.prod.yml build

# Run database migrations if any schema changes exist
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api npx prisma migrate deploy --schema=prisma/schema.prisma || true

# Bring up updated containers
docker compose --env-file .env.production -f docker-compose.prod.yml up -d

echo ""
echo "=========================================================="
echo " [4/4] Verifying health and services..."
echo "=========================================================="
docker compose --env-file .env.production -f docker-compose.prod.yml ps

echo ""
echo "Checking API Health:"
curl -fsS https://api.sphearpro.tech/api/v1/health || echo "API healthcheck warning"

echo ""
echo "Checking Web Health:"
curl -IsS https://sphearpro.tech | head -n 5
EOF

echo ""
echo "=========================================================="
echo " Deployment to VPS Complete! 🎉"
echo " Web: https://sphearpro.tech"
echo " API: https://api.sphearpro.tech/api/v1/health"
echo "=========================================================="
