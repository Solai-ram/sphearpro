<#
.SYNOPSIS
    One-click push and deploy to production VPS.
.DESCRIPTION
    Pushes local code to git and triggers deployment on the production VPS via SSH.
.EXAMPLE
    .\deploy.ps1
    .\deploy.ps1 "fix: update invoice print layout"
#>
param (
    [string]$CommitMessage = "auto deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
)

$ErrorActionPreference = "Stop"
$VpsHost = "root@200.234.45.171"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [1/4] Pushing code to GitHub..." -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

git add -A
$status = git status --porcelain
if ($status) {
    git commit -m "$CommitMessage"
} else {
    Write-Host "No unstaged changes to commit. Proceeding with push..." -ForegroundColor Yellow
}

$currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
git push origin $currentBranch

if ($currentBranch -ne "main") {
    Write-Host "Syncing changes into main branch..." -ForegroundColor Cyan
    git checkout main
    git merge $currentBranch
    git push origin main
    git checkout $currentBranch
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [2/4] Triggering build & deploy on VPS ($VpsHost)..." -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$remoteScript = @'
set -euo pipefail
cd /opt/his-lite

echo "--> Pulling latest changes from main branch..."
git pull origin main

echo ""
echo "--> Building updated containers..."
docker compose --env-file .env.production -f docker-compose.prod.yml build

echo ""
echo "--> Applying database migrations (if any)..."
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api npx prisma migrate deploy --schema=prisma/schema.prisma || true

echo ""
echo "--> Launching updated containers..."
docker compose --env-file .env.production -f docker-compose.prod.yml up -d

echo ""
echo "--> Service Status:"
docker compose --env-file .env.production -f docker-compose.prod.yml ps

echo ""
echo "--> Checking API Health:"
curl -fsS https://api.sphearpro.tech/api/v1/health || echo "API healthcheck warning"

echo ""
echo "--> Checking Web Frontend:"
curl -IsS https://sphearpro.tech | head -n 5
'@

ssh -o StrictHostKeyChecking=accept-new $VpsHost $remoteScript

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " Deployment to VPS Complete! 🎉" -ForegroundColor Green
Write-Host " Web: https://sphearpro.tech" -ForegroundColor Green
Write-Host " API: https://api.sphearpro.tech/api/v1/health" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
