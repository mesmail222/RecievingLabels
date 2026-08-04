# PowerShell script to FORCE pull latest changes from GitHub and overwrite local files
# Run on the shock server from the Receiving Labels project directory as Administrator.
# WARNING: This will overwrite ALL local changes!

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FORCE Update from GitHub" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "WARNING: This will overwrite ALL local files with the remote repository!" -ForegroundColor Red
Write-Host "Any local changes will be LOST!" -ForegroundColor Red
Write-Host ""

$response = Read-Host "Are you sure you want to continue? (type 'yes' to confirm)"
if ($response -ne "yes") {
    Write-Host "Aborted." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 0
}

Write-Host ""

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Git is not installed!" -ForegroundColor Red
    Write-Host "Please install Git for Windows first." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

if (-not (Test-Path ".git")) {
    Write-Host "ERROR: This is not a Git repository!" -ForegroundColor Red
    Write-Host "Clone https://github.com/mesmail222/RecievingLabels first." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

$branch = "main"
$remoteBranch = git rev-parse --abbrev-ref origin/HEAD 2>$null
if ($LASTEXITCODE -eq 0 -and $remoteBranch) {
    $branch = ($remoteBranch -replace '^origin/', '')
}

Write-Host "Step 1: Fetching latest changes from GitHub ($branch)..." -ForegroundColor Green
git fetch origin $branch
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to fetch from GitHub!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host ""
Write-Host "Step 2: Removing all untracked files and directories..." -ForegroundColor Green
git clean -fd
Write-Host "Untracked files removed!" -ForegroundColor Green

Write-Host ""
Write-Host "Step 3: Resetting to match remote repository exactly..." -ForegroundColor Green
Write-Host "This will overwrite all local changes!" -ForegroundColor Yellow
git reset --hard "origin/$branch"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Force Update Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "All files have been updated to match the remote repository!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Ensure server\.env has ScheduleDB credentials" -ForegroundColor White
    Write-Host "  2. Run the deployment script:" -ForegroundColor White
    Write-Host "     .\deploy-shock-server-complete.ps1" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "ERROR: Reset failed!" -ForegroundColor Red
    Write-Host "You may need to manually resolve conflicts." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
