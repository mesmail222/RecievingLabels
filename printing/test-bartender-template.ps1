param(
    [Parameter(Mandatory = $true)]
    [string]$TemplatePath
)

$ErrorActionPreference = "Stop"

$sdk = "C:\Program Files\Seagull\BarTender 2022\Seagull.BarTender.Print.dll"
if (-not (Test-Path -LiteralPath $sdk)) {
    throw "BarTender 2022 Print SDK not found: $sdk"
}
if (-not (Test-Path -LiteralPath $TemplatePath)) {
    throw "BarTender template not found: $TemplatePath"
}

$required = @(
    "MO Date",
    "MO Number",
    "MO Quantity"
)
for ($row = 1; $row -le 8; $row++) {
    $required += "Component Item $row"
    $required += "Component Qty $row"
}

[void][Reflection.Assembly]::LoadFrom($sdk)
$engine = New-Object Seagull.BarTender.Print.Engine($true)

try {
    $document = $engine.Documents.Open($TemplatePath)
    try {
        $available = @($document.SubStrings | ForEach-Object { $_.Name })
        $missing = @($required | Where-Object { $_ -notin $available })

        Write-Host "Template: $TemplatePath"
        Write-Host ("Named data sources found: " + $available.Count)
        foreach ($name in $available | Sort-Object) {
            Write-Host "  $name"
        }

        if ($missing.Count -gt 0) {
            throw ("Missing required named data sources: " + ($missing -join ", "))
        }

        Write-Host "Template is ready for Receiving Labels BTXML printing." -ForegroundColor Green
    }
    finally {
        $document.Close([Seagull.BarTender.Print.SaveOptions]::DoNotSaveChanges)
    }
}
finally {
    try {
        $engine.Stop([Seagull.BarTender.Print.SaveOptions]::DoNotSaveChanges)
    }
    catch {
        # Ignore shutdown errors after validation.
    }
    $engine.Dispose()
}
