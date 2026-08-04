# Deploy MO Receiving Labels on shock.lms.shimano.com
# Run as Administrator on the shock server after pull-from-git.ps1
# Compatible with Windows PowerShell 5.1
#
# Isolation rules:
# - Only manages PM2 app "receiving-labels-api"
# - Only manages IIS site/app pool "ReceivingLabels"
# - Does NOT kill other processes
# - Does NOT change shared ARR timeout
# - Picks the next free API + IIS ports (avoids 8082 Scheduler, 8084 Plotter, etc.)

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

function Test-TcpPortInUse {
    param([int]$Port)
    $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    return [bool]$conn
}

function Get-IisBoundPorts {
    $ports = @()
    try {
        Import-Module WebAdministration -ErrorAction SilentlyContinue
        $bindings = Get-WebBinding -ErrorAction SilentlyContinue
        foreach ($b in @($bindings)) {
            # bindingInformation like "*:8084:" or "172.x.x.x:8084:host"
            if ($b.bindingInformation -match ':(\d+):') {
                $ports += [int]$Matches[1]
            }
        }
    } catch {
        # ignore - fall back to TCP checks only
    }
    return $ports | Select-Object -Unique
}

function Get-NextFreePort {
    param(
        [int]$StartPort,
        [int[]]$AlsoAvoid = @(),
        [int]$MaxTries = 50
    )
    $port = $StartPort
    $avoid = @{}
    foreach ($p in $AlsoAvoid) { $avoid[[int]$p] = $true }

    for ($i = 0; $i -lt $MaxTries; $i++) {
        if (-not $avoid.ContainsKey($port) -and -not (Test-TcpPortInUse -Port $port)) {
            return $port
        }
        $port++
    }
    throw ("Could not find a free port starting at " + $StartPort)
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MO Receiving Labels - Complete Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$siteName = "ReceivingLabels"
$appPoolName = "ReceivingLabels"
$pm2Name = "receiving-labels-api"
$iisFrontendPath = "C:\inetpub\ReceivingLabels\frontend"
# Prefer these ranges; skip anything already bound/listening
$apiPortStart = 3011
$iisPortStart = 8085

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

# Step 1: Stop only OUR PM2 app (do not kill other processes / ports)
Write-Host ("Step 1: Stopping PM2 process (" + $pm2Name + ") only...") -ForegroundColor Green
$pm2Check = Get-Command pm2 -ErrorAction SilentlyContinue
if ($pm2Check) {
    & pm2 stop $pm2Name 2>&1 | Out-Null
    Start-Sleep -Seconds 1
    & pm2 delete $pm2Name 2>&1 | Out-Null
    Start-Sleep -Seconds 1
    Write-Host "PM2 app stopped/deleted if it existed. Other PM2 apps left alone." -ForegroundColor Green
} else {
    Write-Host "WARNING: PM2 not found. Skipping PM2 stop." -ForegroundColor Yellow
}
Write-Host ""

# Step 2: Pick free ports (no process kills)
Write-Host "Step 2: Selecting free API and IIS ports..." -ForegroundColor Green
$iisBoundPorts = @(Get-IisBoundPorts)
Write-Host ("IIS already bound ports: " + (($iisBoundPorts | Sort-Object) -join ", ")) -ForegroundColor Gray

# Prefer previously saved ports if still free
$portsFile = Join-Path $scriptPath "deploy-ports.json"
$preferredApi = $null
$preferredIis = $null
if (Test-Path $portsFile) {
    try {
        $saved = Get-Content $portsFile -Raw | ConvertFrom-Json
        $preferredApi = [int]$saved.apiPort
        $preferredIis = [int]$saved.iisPort
        Write-Host ("Found saved ports from last deploy: API " + $preferredApi + ", IIS " + $preferredIis) -ForegroundColor Gray
    } catch {
        # ignore corrupt file
    }
}

if ($preferredApi -and -not (Test-TcpPortInUse -Port $preferredApi)) {
    $apiPort = $preferredApi
} else {
    $apiPort = Get-NextFreePort -StartPort $apiPortStart
}

if ($preferredIis -and ($iisBoundPorts -notcontains $preferredIis) -and -not (Test-TcpPortInUse -Port $preferredIis)) {
    $iisPort = $preferredIis
} else {
    $iisPort = Get-NextFreePort -StartPort $iisPortStart -AlsoAvoid $iisBoundPorts
}

Write-Host ("Selected API port:  " + $apiPort + " (loopback Node / PM2)") -ForegroundColor Yellow
Write-Host ("Selected IIS port:  " + $iisPort + " (public site)") -ForegroundColor Yellow
Write-Host ""

# Persist selection for next deploy
@{
    apiPort = $apiPort
    iisPort = $iisPort
    updatedAt = (Get-Date).ToString("o")
} | ConvertTo-Json | Set-Content -Path $portsFile -Encoding UTF8

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

# Generate web.config with chosen API port (never hardcode)
if (-not (Test-Path "web.config")) {
    Write-Host "ERROR: web.config template not found!" -ForegroundColor Red
    exit 1
}
$webConfig = Get-Content -Path "web.config" -Raw
$webConfig = $webConfig.Replace("__API_PORT__", [string]$apiPort)
# Support older checked-out templates that still had a literal 3011
$webConfig = $webConfig.Replace("127.0.0.1:3011", ("127.0.0.1:" + $apiPort))
$webConfig = $webConfig.Replace("localhost:3011", ("localhost:" + $apiPort))
Set-Content -Path "dist\web.config" -Value $webConfig -Encoding UTF8
Write-Host ("web.config written for API port " + $apiPort) -ForegroundColor Green
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

# Step 5: Ensure .env (keep DB credentials; set PORT / ALLOWED_ORIGINS)
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

# Keep ecosystem.config.js PORT in sync with selected apiPort
$ecoPath = Join-Path $scriptPath "server\ecosystem.config.js"
if (Test-Path $ecoPath) {
    $eco = Get-Content -Path $ecoPath -Raw
    $eco = [regex]::Replace($eco, "PORT:\s*\d+", ("PORT: " + $apiPort))
    Set-Content -Path $ecoPath -Value $eco -Encoding UTF8
    Write-Host ("Updated ecosystem.config.js PORT=" + $apiPort) -ForegroundColor Green
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
Write-Host ("Step 7: Starting PM2 (" + $pm2Name + ") on port " + $apiPort + "...") -ForegroundColor Green
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

# Step 8: Configure IIS site on chosen free port only
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

        # Replace bindings so we do not keep a conflicting old port (e.g. 8084)
        $existingBindings = @(Get-WebBinding -Name $siteName -ErrorAction SilentlyContinue)
        foreach ($b in $existingBindings) {
            try {
                Remove-WebBinding -Name $siteName -BindingInformation $b.bindingInformation -ErrorAction SilentlyContinue
            } catch {
                # continue
            }
        }
        New-WebBinding -Name $siteName -Protocol "http" -Port $iisPort -IPAddress "*"
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

# Step 8b: Do NOT change shared ARR timeout (other sites depend on it).
# Only ensure ARR proxy feature is enabled if appcmd is present.
Write-Host "Step 8b: Ensuring ARR proxy is enabled (timeout left unchanged)..." -ForegroundColor Green
try {
    $appcmd = Join-Path $env:windir "system32\inetsrv\appcmd.exe"
    if (Test-Path $appcmd) {
        & $appcmd set config -section:system.webServer/proxy /enabled:"true" /commit:apphost 2>&1 | Out-Null
        Write-Host "ARR proxy enabled (existing timeout preserved)." -ForegroundColor Green
    }
} catch {
    Write-Host ("WARNING: Could not enable ARR: " + $_) -ForegroundColor Yellow
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
Write-Host "This app only:" -ForegroundColor Cyan
Write-Host ("  PM2:      " + $pm2Name) -ForegroundColor Yellow
Write-Host ("  API:      http://127.0.0.1:" + $apiPort) -ForegroundColor Yellow
Write-Host ("  IIS site: " + $siteName) -ForegroundColor Yellow
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
