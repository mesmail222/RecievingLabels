# Deploy MO Receiving Labels on shock.lms.shimano.com
# Run as Administrator on the shock server after pull-from-git.ps1
# Compatible with Windows PowerShell 5.1

$ErrorActionPreference = "Continue"

trap {
    Write-Host ""
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Stack Trace: $($_.ScriptStackTrace)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Press Enter to exit..." -ForegroundColor Gray
    Read-Host | Out-Null
    break
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MO Receiving Labels - Complete Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$apiPort = 3011
$iisPort = 8084
$siteName = "ReceivingLabels"
$appPoolName = "ReceivingLabels"
$pm2Name = "receiving-labels-api"
$iisFrontendPath = "C:\inetpub\ReceivingLabels\frontend"

$serverIP = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
    Select-Object -First 1).IPAddress
if ([string]::IsNullOrWhiteSpace($serverIP)) {
    $serverIP = "127.0.0.1"
}
Write-Host "Server IP: $serverIP" -ForegroundColor Yellow
Write-Host ""

$scriptPath = $PSScriptRoot
if ([string]::IsNullOrEmpty($scriptPath)) {
    $scriptPath = (Get-Location).Path
}
Write-Host "Working directory: $scriptPath" -ForegroundColor Yellow

if (-not (Test-Path (Join-Path $scriptPath "server"))) {
    Write-Host "ERROR: 'server' directory not found!" -ForegroundColor Red
    Write-Host "Please ensure you are in the project root directory." -ForegroundColor Red
    exit 1
}

# Step 2: Stop PM2
Write-Host "Step 2: Stopping PM2 process ($pm2Name)..." -ForegroundColor Green
$pm2Check = Get-Command pm2 -ErrorAction SilentlyContinue
if ($pm2Check) {
    & pm2 stop $pm2Name 2>&1 | Out-Null
    Start-Sleep -Seconds 2
    & pm2 delete $pm2Name 2>&1 | Out-Null
    Start-Sleep -Seconds 1

    $portProcess = Get-NetTCPConnection -LocalPort $apiPort -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    if ($portProcess) {
        Write-Host "Killing process(es) on port $apiPort..." -ForegroundColor Yellow
        foreach ($procId in @($portProcess)) {
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 2
    }
    Write-Host "PM2 process stopped." -ForegroundColor Green
} else {
    Write-Host "WARNING: PM2 not found. Skipping PM2 stop." -ForegroundColor Yellow
}
Write-Host ""

# Step 3: Build frontend
Write-Host "Step 3: Building frontend..." -ForegroundColor Green
Set-Location $scriptPath
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend dependency installation failed!" -ForegroundColor Red
    exit 1
}
if (Test-Path "dist") {
    Remove-Item -Path "dist" -Recurse -Force
}
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend build failed!" -ForegroundColor Red
    exit 1
}
if (Test-Path "web.config") {
    Copy-Item -Path "web.config" -Destination "dist\web.config" -Force
    Write-Host "web.config copied to dist!" -ForegroundColor Green
} else {
    Write-Host "ERROR: web.config not found!" -ForegroundColor Red
    exit 1
}
Write-Host "Frontend built successfully!" -ForegroundColor Green
Write-Host ""

# Step 4: Build backend
Write-Host "Step 4: Building backend..." -ForegroundColor Green
Set-Location (Join-Path $scriptPath "server")
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Backend dependency installation failed!" -ForegroundColor Red
    exit 1
}
if (Test-Path "dist") {
    Remove-Item -Path "dist" -Recurse -Force
}
npm run build
if ($LASTEXITCODE -ne 0 -and -not (Test-Path "dist\index.js")) {
    Write-Host "ERROR: Backend build failed (dist\index.js missing)." -ForegroundColor Red
    exit 1
}
Write-Host "Backend built successfully!" -ForegroundColor Green
Write-Host ""

# Step 5: Ensure .env (do not overwrite DB credentials; only refresh PORT / ALLOWED_ORIGINS)
Write-Host "Step 5: Checking backend .env..." -ForegroundColor Green
$backendEnvPath = Join-Path $scriptPath "server\.env"
$allowedOrigins = @(
    "http://localhost",
    ("http://localhost:" + $iisPort),
    ("http://" + $serverIP),
    ("http://" + $serverIP + ":" + $iisPort),
    "http://shock",
    ("http://shock:" + $iisPort),
    "http://shock.lms.shimano.com",
    ("http://shock.lms.shimano.com:" + $iisPort)
) -join ","

if (-not (Test-Path $backendEnvPath)) {
    Write-Host "WARNING: server\.env not found. Creating a template - update DB credentials!" -ForegroundColor Yellow
    $template = @(
        "DATABASE_SERVER=shock.lms.shimano.com",
        "DATABASE_NAME=ScheduleDB",
        "DATABASE_USER=",
        "DATABASE_PASSWORD=",
        ("PORT=" + $apiPort),
        "NODE_ENV=production",
        ("ALLOWED_ORIGINS=" + $allowedOrigins)
    ) -join "`r`n"
    Set-Content -Path $backendEnvPath -Value $template -Encoding UTF8
} else {
    $envContent = Get-Content -Path $backendEnvPath -Raw -ErrorAction Stop
    if ($null -eq $envContent) { $envContent = "" }

    $originsLine = "ALLOWED_ORIGINS=" + $allowedOrigins
    if ($envContent -match "(?m)^ALLOWED_ORIGINS=") {
        $envContent = [regex]::Replace($envContent, "(?m)^ALLOWED_ORIGINS=.*$", $originsLine)
    } else {
        $envContent = $envContent.TrimEnd() + "`r`n" + $originsLine + "`r`n"
    }

    $portLine = "PORT=" + $apiPort
    if ($envContent -match "(?m)^PORT=") {
        $envContent = [regex]::Replace($envContent, "(?m)^PORT=\d+\s*$", $portLine)
    } else {
        $envContent = $envContent.TrimEnd() + "`r`n" + $portLine + "`r`n"
    }

    Set-Content -Path $backendEnvPath -Value $envContent -Encoding UTF8
    Write-Host "Updated PORT and ALLOWED_ORIGINS in server\.env" -ForegroundColor Green
}
Write-Host ""

# Step 6: Copy frontend to IIS
Write-Host ("Step 6: Copying frontend to IIS (" + $iisFrontendPath + ")...") -ForegroundColor Green
Set-Location $scriptPath
if (-not (Test-Path "C:\inetpub\ReceivingLabels")) {
    New-Item -ItemType Directory -Path "C:\inetpub\ReceivingLabels" -Force | Out-Null
}
if (-not (Test-Path $iisFrontendPath)) {
    New-Item -ItemType Directory -Path $iisFrontendPath -Force | Out-Null
} else {
    Remove-Item -Path (Join-Path $iisFrontendPath "*") -Recurse -Force -ErrorAction SilentlyContinue
}
Copy-Item -Path "dist\*" -Destination $iisFrontendPath -Recurse -Force
Write-Host "Frontend copied to IIS!" -ForegroundColor Green
Write-Host ""

# Step 7: Start PM2
Write-Host ("Step 7: Starting PM2 (" + $pm2Name + ")...") -ForegroundColor Green
Set-Location (Join-Path $scriptPath "server")
New-Item -ItemType Directory -Path "logs" -Force | Out-Null

if (-not (Test-Path "dist\index.js")) {
    Write-Host "ERROR: dist\index.js not found!" -ForegroundColor Red
    exit 1
}

if ($pm2Check) {
    if (Test-Path "ecosystem.config.js") {
        & pm2 start ecosystem.config.js --update-env
    } else {
        & pm2 start dist/index.js --name $pm2Name --update-env
    }
    & pm2 save 2>&1 | Out-Null
    Start-Sleep -Seconds 3
    & pm2 status
    Write-Host ""
    & pm2 logs $pm2Name --lines 15 --nostream
} else {
    Write-Host "WARNING: PM2 not found. Start manually: cd server then npm start" -ForegroundColor Yellow
}
Write-Host ""

# Step 8: Configure IIS site
Write-Host ("Step 8: Configuring IIS website (" + $siteName + ") on port " + $iisPort + "...") -ForegroundColor Green
try {
    Import-Module WebAdministration -ErrorAction SilentlyContinue

    if (-not (Test-Path ("IIS:\AppPools\" + $appPoolName))) {
        New-WebAppPool -Name $appPoolName | Out-Null
    }
    Set-ItemProperty ("IIS:\AppPools\" + $appPoolName) -Name managedRuntimeVersion -Value ""
    Set-ItemProperty ("IIS:\AppPools\" + $appPoolName) -Name managedPipelineMode -Value "Integrated"

    $website = Get-Website -Name $siteName -ErrorAction SilentlyContinue
    if (-not $website) {
        New-Website `
            -Name $siteName `
            -PhysicalPath $iisFrontendPath `
            -Port $iisPort `
            -ApplicationPool $appPoolName `
            -ErrorAction SilentlyContinue | Out-Null
    } else {
        Set-ItemProperty ("IIS:\Sites\" + $siteName) -Name applicationPool -Value $appPoolName
        Set-ItemProperty ("IIS:\Sites\" + $siteName) -Name physicalPath -Value $iisFrontendPath
        Stop-Website -Name $siteName -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
        $bindingPattern = "*:" + $iisPort + ":*"
        $binding = Get-WebBinding -Name $siteName | Where-Object { $_.bindingInformation -like $bindingPattern }
        if (-not $binding) {
            New-WebBinding -Name $siteName -Protocol "http" -Port $iisPort -IPAddress "*"
        }
    }

    $appPoolState = Get-WebAppPoolState -Name $appPoolName -ErrorAction SilentlyContinue
    if ($appPoolState -and $appPoolState.Value -eq "Stopped") {
        Start-WebAppPool -Name $appPoolName
    } else {
        Restart-WebAppPool -Name $appPoolName -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
    Start-Website -Name $siteName -ErrorAction SilentlyContinue
    Write-Host ("IIS website configured on port " + $iisPort + "!") -ForegroundColor Green
} catch {
    Write-Host ("WARNING: Error managing IIS: " + $_) -ForegroundColor Yellow
}
Write-Host ""

# Step 8b: ARR proxy
Write-Host "Step 8b: Ensuring ARR reverse-proxy is enabled..." -ForegroundColor Green
try {
    $appcmd = Join-Path $env:windir "system32\inetsrv\appcmd.exe"
    if (Test-Path $appcmd) {
        & $appcmd set config -section:system.webServer/proxy /enabled:"true" /commit:apphost 2>&1 | Out-Null
        & $appcmd set config -section:system.webServer/proxy /timeout:"00:10:00" /commit:apphost 2>&1 | Out-Null
        Write-Host "ARR proxy enabled." -ForegroundColor Green
    }
} catch {
    Write-Host ("WARNING: Could not configure ARR: " + $_) -ForegroundColor Yellow
}
Write-Host ""

# Step 9: Health check
Write-Host "Step 9: Health check..." -ForegroundColor Green
Start-Sleep -Seconds 2
try {
    $healthUri = "http://127.0.0.1:" + $apiPort + "/api/health"
    $health = Invoke-RestMethod -Uri $healthUri -TimeoutSec 10
    Write-Host ("API health: " + $health.status + " - " + $health.message) -ForegroundColor Green
} catch {
    Write-Host ("WARNING: Direct API health check failed: " + $_.Exception.Message) -ForegroundColor Yellow
}

try {
    $proxiedUri = "http://localhost:" + $iisPort + "/api/health"
    $proxied = Invoke-RestMethod -Uri $proxiedUri -TimeoutSec 10
    Write-Host ("IIS proxied health: " + $proxied.status) -ForegroundColor Green
} catch {
    Write-Host ("WARNING: IIS proxied health check failed: " + $_.Exception.Message) -ForegroundColor Yellow
    Write-Host "Confirm URL Rewrite + ARR are installed and the site is started." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Access URLs:" -ForegroundColor Cyan
Write-Host ("  Local:    http://localhost:" + $iisPort) -ForegroundColor Yellow
Write-Host ("  Network:  http://" + $serverIP + ":" + $iisPort) -ForegroundColor Yellow
Write-Host ("  Hostname: http://shock:" + $iisPort) -ForegroundColor Yellow
Write-Host ""
Write-Host "PM2:" -ForegroundColor Cyan
Write-Host "  pm2 status" -ForegroundColor Yellow
Write-Host ("  pm2 logs " + $pm2Name) -ForegroundColor Yellow
Write-Host ""

Write-Host "Press Enter to exit..." -ForegroundColor Gray
Read-Host | Out-Null
