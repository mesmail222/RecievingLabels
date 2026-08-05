param(
    [string]$TemplatePath = "X:\Barcode Tag Formats\Receiving\RecievingFormat.btw",
    [int]$Port = 38177
)

$ErrorActionPreference = "Stop"

$sdk = "C:\Program Files\Seagull\BarTender 2022\Seagull.BarTender.Print.dll"
if (-not (Test-Path $sdk)) {
    throw "BarTender 2022 Print SDK not found: $sdk"
}
if (-not (Test-Path $TemplatePath)) {
    throw "Receiving label template not found: $TemplatePath"
}

[void][Reflection.Assembly]::LoadFrom($sdk)

function Add-CorsHeaders {
    param($Response)
    $Response.Headers["Access-Control-Allow-Origin"] = "*"
    $Response.Headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    $Response.Headers["Access-Control-Allow-Headers"] = "Content-Type"
    $Response.Headers["Access-Control-Allow-Private-Network"] = "true"
}

function Write-JsonResponse {
    param(
        $Context,
        [int]$StatusCode,
        $Body
    )

    $json = $Body | ConvertTo-Json -Depth 12 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($json)
    $Context.Response.StatusCode = $StatusCode
    $Context.Response.ContentType = "application/json; charset=utf-8"
    Add-CorsHeaders $Context.Response
    $Context.Response.ContentLength64 = $bytes.Length
    $Context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Context.Response.OutputStream.Close()
}

function Get-InstalledPrinters {
    $printers = New-Object Seagull.BarTender.Print.Printers
    $items = @()
    foreach ($printer in $printers) {
        $items += [pscustomobject]@{
            name = $printer.PrinterName
            model = $printer.PrinterModel
            port = $printer.Port
            isDefault = $printer.IsDefault
        }
    }
    return $items
}

function Set-ObjectValues {
    param(
        [Parameter(Mandatory = $true)]$Document,
        [Parameter(Mandatory = $true)][hashtable]$Values
    )

    $accessorType = $Document.GetType().Assembly.GetType(
        "Seagull.BarTender.Print.LabelFormatDocumentInternalAccessor"
    )
    $constructor = $accessorType.GetConstructors(
        [Reflection.BindingFlags]"Public,NonPublic,Instance"
    )[0]
    $accessor = $constructor.Invoke(@($Document))

    $objectsXml = foreach ($entry in $Values.GetEnumerator()) {
        $encoded = [Convert]::ToBase64String(
            [Text.Encoding]::Unicode.GetBytes([string]$entry.Value)
        )
        $escapedName = [System.Security.SecurityElement]::Escape([string]$entry.Key)
        @"
      <Object Name="$escapedName" Type="2">
        <SubString Position="0"><Value Encoding="base64">$encoded</Value></SubString>
      </Object>
"@
    }

    $dataMergeXml = @"
<?xml version="1.0" encoding="UTF-8" ?>
<Command>
  <DataMerge>
$($objectsXml -join "`r`n")
  </DataMerge>
</Command>
"@

    if (-not $accessor.ImportDataSourceValuesFromXML($dataMergeXml)) {
        throw "BarTender rejected the Receiving label values."
    }
}

function Print-Labels {
    param(
        [Parameter(Mandatory = $true)]$Engine,
        [Parameter(Mandatory = $true)]$Labels,
        [Parameter(Mandatory = $true)][string]$PrinterName
    )

    $installed = @(Get-InstalledPrinters)
    if (-not ($installed | Where-Object { $_.name -eq $PrinterName })) {
        throw "Printer is not installed on this workstation: $PrinterName"
    }

    $printed = 0
    $document = $Engine.Documents.Open($TemplatePath)
    try {
        $document.PrintSetup.PrinterName = $PrinterName
        $document.PrintSetup.UseDatabase = $false
        $document.PrintSetup.IdenticalCopiesOfLabel = 1

        foreach ($label in @($Labels)) {
            $components = @($label.components)
            $pageCount = [Math]::Max(1, [Math]::Ceiling($components.Count / 8.0))

            for ($page = 0; $page -lt $pageCount; $page++) {
                $pageComponents = @($components | Select-Object -Skip ($page * 8) -First 8)
                $moDisplay = [string]$label.moNumber
                if ($pageCount -gt 1) {
                    $moDisplay += " (" + ($page + 1) + "/" + $pageCount + ")"
                }

                $values = @{
                    "MO Date" = "DATE: " + [string]$label.createdDate
                    "MO Number" = $moDisplay
                    "MO Quantity" = "QTY: " + [string]$label.qty
                }

                for ($row = 1; $row -le 8; $row++) {
                    if ($row -le $pageComponents.Count) {
                        $component = $pageComponents[$row - 1]
                        $values["Component Item " + $row] = [string]$component.itemNumber
                        $values["Component Qty " + $row] = "QTY: " + [string]$component.qty
                    } else {
                        $values["Component Item " + $row] = ""
                        $values["Component Qty " + $row] = ""
                    }
                }

                Set-ObjectValues $document $values
                $messages = New-Object Seagull.BarTender.Print.Messages
                $jobName = "Receiving " + $label.moNumber + " " + ($page + 1)
                $result = $document.Print($jobName, 60000, [ref]$messages)
                if ($result -ne [Seagull.BarTender.Print.Result]::Success) {
                    $details = ($messages | ForEach-Object { $_.Text }) -join "; "
                    throw "BarTender print failed for $($label.moNumber): $result $details"
                }
                $printed++
            }
        }
    }
    finally {
        $document.Close([Seagull.BarTender.Print.SaveOptions]::DoNotSaveChanges)
    }

    return $printed
}

$engine = New-Object Seagull.BarTender.Print.Engine($true)
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")

try {
    $listener.Start()
    Write-Host "Receiving Labels local print agent is running."
    Write-Host "  URL:      http://127.0.0.1:$Port"
    Write-Host "  Template: $TemplatePath"
    Write-Host "Press Ctrl+C to stop."

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            if ($context.Request.HttpMethod -eq "OPTIONS") {
                $context.Response.StatusCode = 204
                Add-CorsHeaders $context.Response
                $context.Response.Close()
                continue
            }

            if ($context.Request.HttpMethod -eq "GET" -and $context.Request.Url.AbsolutePath -eq "/health") {
                Write-JsonResponse $context 200 @{
                    status = "ok"
                    template = $TemplatePath
                    printers = @(Get-InstalledPrinters)
                }
                continue
            }

            if ($context.Request.HttpMethod -eq "POST" -and $context.Request.Url.AbsolutePath -eq "/print") {
                $reader = New-Object IO.StreamReader($context.Request.InputStream, $context.Request.ContentEncoding)
                $payload = ($reader.ReadToEnd() | ConvertFrom-Json)
                $reader.Close()

                if ([string]::IsNullOrWhiteSpace([string]$payload.printerName)) {
                    throw "printerName is required."
                }
                if (@($payload.labels).Count -eq 0) {
                    throw "At least one label is required."
                }

                $printed = Print-Labels $engine $payload.labels ([string]$payload.printerName)
                Write-JsonResponse $context 200 @{
                    status = "printed"
                    labelsPrinted = $printed
                    printerName = [string]$payload.printerName
                }
                continue
            }

            Write-JsonResponse $context 404 @{ error = "Not found" }
        }
        catch {
            Write-Host ("Print agent request failed: " + $_.Exception.Message) -ForegroundColor Red
            if ($context.Response.OutputStream.CanWrite) {
                Write-JsonResponse $context 500 @{
                    error = $_.Exception.Message
                }
            }
        }
    }
}
finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
    $listener.Close()
    try {
        $engine.Stop([Seagull.BarTender.Print.SaveOptions]::DoNotSaveChanges)
    }
    catch {
        # Ignore shutdown errors.
    }
    $engine.Dispose()
}
