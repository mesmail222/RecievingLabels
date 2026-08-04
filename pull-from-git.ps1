# Pull latest Receiving Labels code from GitHub (shock server)
# Run from the repo root, e.g. M:\Mfgsys\RecievingLabels
# Does not remove server\.env (gitignored)

$ErrorActionPreference = "Continue"
$GitBranch = "main"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Receiving Labels - Pull from GitHub" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Git is not installed." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

if (-not (Test-Path ".git")) {
    Write-Host "ERROR: Not a git repository. Clone first:" -ForegroundColor Red
    Write-Host "  git clone https://github.com/mesmail222/RecievingLabels.git" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Current branch:" -ForegroundColor Green
git branch --show-current
Write-Host ""
Write-Host "Local changes:" -ForegroundColor Green
git status --short
Write-Host ""

Write-Host "Fetching origin/$GitBranch ..." -ForegroundColor Green
git fetch origin $GitBranch
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: git fetch failed." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

$localCommit = git rev-parse HEAD
$remoteCommit = git rev-parse "origin/$GitBranch"

if ($localCommit -eq $remoteCommit) {
    Write-Host "Already up to date with origin/$GitBranch." -ForegroundColor Green
    Read-Host "Press Enter to exit"
    exit 0
}

Write-Host "Updates found. Pulling origin/$GitBranch ..." -ForegroundColor Yellow
git stash push -m "pull-from-git.ps1 auto-stash" 2>&1 | Out-Null
git pull origin $GitBranch --ff-only

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Fast-forward pull failed. Try a hard reset (discards local commits):" -ForegroundColor Yellow
    Write-Host "  git reset --hard origin/$GitBranch" -ForegroundColor White
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Pull complete." -ForegroundColor Green
Write-Host "  Local:  $localCommit" -ForegroundColor Gray
Write-Host "  Now at: $(git rev-parse HEAD)" -ForegroundColor Gray
Write-Host ""
Write-Host "Next step - deploy:" -ForegroundColor Cyan
Write-Host "  .\deploy-shock-server-complete.ps1" -ForegroundColor Yellow
Write-Host ""

Read-Host "Press Enter to exit"
