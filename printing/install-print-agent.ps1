# Run once as Administrator on the Receiving workstation.
# Installs the local BarTender print agent for the currently signed-in user.

$ErrorActionPreference = "Stop"

$agentPort = 38177
$taskName = "GLoomis Receiving Labels Print Agent"
$installDirectory = Join-Path $env:LOCALAPPDATA "GLoomis\ReceivingLabelsPrintAgent"
$sourceAgent = Join-Path $PSScriptRoot "receiving-label-print-agent.ps1"
$installedAgent = Join-Path $installDirectory "receiving-label-print-agent.ps1"
$url = "http://127.0.0.1:$agentPort/"
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name

$isAdmin = (
    New-Object Security.Principal.WindowsPrincipal(
        [Security.Principal.WindowsIdentity]::GetCurrent()
    )
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    throw "Open PowerShell as Administrator, then run this installer again."
}
if (-not (Test-Path $sourceAgent)) {
    throw "Print agent script not found: $sourceAgent"
}
if (-not (Test-Path "C:\Program Files\Seagull\BarTender 2022\Seagull.BarTender.Print.dll")) {
    throw "BarTender 2022 is not installed on this workstation."
}
if (-not (Test-Path "X:\Barcode Tag Formats\Receiving\RecievingFormat.btw")) {
    throw "The Receiving BarTender template is not available on X: (RecievingFormat.btw)."
}

New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null
Copy-Item -Path $sourceAgent -Destination $installedAgent -Force

# HttpListener requires a one-time URL reservation for a non-admin process.
& netsh http delete urlacl "url=$url" 2>&1 | Out-Null
& netsh http add urlacl "url=$url" "user=$currentUser"
if ($LASTEXITCODE -ne 0) {
    throw "Could not reserve $url for $currentUser."
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$installedAgent`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$principal = New-ScheduledTaskPrincipal `
    -UserId $currentUser `
    -LogonType Interactive `
    -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Force | Out-Null

Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 3

try {
    $health = Invoke-RestMethod -Uri ($url + "health") -TimeoutSec 10
    Write-Host "Print agent installed and running." -ForegroundColor Green
    Write-Host ("Printers found: " + @($health.printers).Count) -ForegroundColor Green
    foreach ($printer in @($health.printers)) {
        Write-Host ("  " + $printer.name)
    }
}
catch {
    Write-Host "The task was installed, but its health check failed." -ForegroundColor Yellow
    Write-Host "Open Task Scheduler and inspect: $taskName" -ForegroundColor Yellow
    throw
}
