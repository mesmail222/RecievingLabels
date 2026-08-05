param(
    [string]$Source = "X:\Barcode Tag Formats\Receiving\RecievingFormat.btw",
    [string]$Output = "",
    [string]$PreviewPath = ""
)

$ErrorActionPreference = "Stop"

$sdk = "C:\Program Files\Seagull\BarTender 2022\Seagull.BarTender.Print.dll"
$interop = "C:\Program Files\Seagull\BarTender 2022\Interop.BarTender.dll"

if (-not (Test-Path $Source)) {
    throw "BarTender template not found: $Source"
}
if (-not (Test-Path $sdk) -or -not (Test-Path $interop)) {
    throw "BarTender 2022 SDK files were not found."
}

if ([string]::IsNullOrWhiteSpace($Output)) {
    $Output = $Source
}

$sourceFull = [System.IO.Path]::GetFullPath($Source)
$outputFull = [System.IO.Path]::GetFullPath($Output)

if ($sourceFull -ne $outputFull) {
    Copy-Item -Path $sourceFull -Destination $outputFull -Force
}

[void][Reflection.Assembly]::LoadFrom($sdk)
[void][Reflection.Assembly]::LoadFrom($interop)

function Escape-XmlText {
    param([string]$Value)
    return [System.Security.SecurityElement]::Escape($Value)
}

function New-TextObject {
    param(
        [Parameter(Mandatory = $true)]$Objects,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$SampleValue,
        [Parameter(Mandatory = $true)][double]$X,
        [Parameter(Mandatory = $true)][double]$Y,
        [Parameter(Mandatory = $true)][double]$Width,
        [Parameter(Mandatory = $true)][double]$Height,
        [Parameter(Mandatory = $true)][double]$FontSize,
        [bool]$Bold = $false
    )

    $object = $Objects.Create([BarTender.BtObjectType]::btObjectText)
    $id = ([Guid]::NewGuid()).ToString().ToUpperInvariant()
    $weight = if ($Bold) { 700 } else { 400 }
    $escapedValue = Escape-XmlText $SampleValue

    $xml = @"
<Text Name="$Name" Width="$($Width.ToString('0.000')) in" Height="$($Height.ToString('0.000')) in" ConditionalPrintType="Always" Position.X="$($X.ToString('0.000')) in" Position.Y="$($Y.ToString('0.000')) in">
  <Tabs/>
  <Font PointSize="$($FontSize.ToString('0.000'))" FontName="Arial" Weight="$weight" CharacterSet="16909056">
    <Underline/>
    <Strikethrough/>
    <Foreground Mode="Solid" Color="00000000"><Color RGB="00000000"/></Foreground>
  </Font>
  <AutoFit/>
  <DataSources>
    <EmbeddedDataSource ID="{$id}" SubStringListStringID="4294967295" CharSet="0" CultureID="-3" InputCultureID="1033">
      <Transforms>
        <DataEntryTransform/>
        <VbScriptTransform/>
        <ScriptEventCode><ScriptEvents><OnProcessData/><OnPostSerialize/><Functions-and-Subs/></ScriptEvents></ScriptEventCode>
      </Transforms>
      <Value>$escapedValue</Value>
    </EmbeddedDataSource>
  </DataSources>
</Text>
"@

    $object.SetXML($xml)
    $object.Width = $Width
    $object.FontName = "Arial"
    $object.FontSize = $FontSize
    $object.FontBold = $Bold
    return $object
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
        @"
      <Object Name="$(Escape-XmlText ([string]$entry.Key))" Type="2">
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
        throw "BarTender rejected the object data values."
    }
}

$engine = New-Object Seagull.BarTender.Print.Engine($true)
try {
    $document = $engine.Documents.Open($outputFull)
    $activeXProperty = $document.GetType().GetProperty(
        "ActiveXFormat",
        [Reflection.BindingFlags]"NonPublic,Instance"
    )
    $format = $activeXProperty.GetValue($document, $null)
    $objects = $format.Objects

    while ($objects.Count -gt 0) {
        $index = [object]1
        $existingObject = $objects.Item([ref]$index)
        [xml]$existingXml = $existingObject.GetXML($false, $false)
        $name = [string]$existingXml.DocumentElement.GetAttribute("Name")
        if (-not $objects.Delete($name)) {
            throw "Could not delete existing BarTender object: $name"
        }
    }

    $null = New-TextObject $objects "MO Date" "DATE: 08/05/26" 2.45 0.12 1.15 0.24 9 $false
    $null = New-TextObject $objects "MO Number" "MF-23599" 0.15 0.42 1.90 0.30 13 $true
    $null = New-TextObject $objects "MO Quantity" "QTY: 12" 2.75 0.42 0.85 0.30 11 $true
    $sampleItems = @(
        "44453-55",
        "44497-01",
        "44463-01",
        "44484-55",
        "43964-01",
        "45745-01",
        "43874-01",
        "43875-01"
    )
    for ($row = 1; $row -le 8; $row++) {
        $rowY = 0.86 + (($row - 1) * 0.22)
        $null = New-TextObject `
            $objects `
            ("Component Item " + $row) `
            $sampleItems[$row - 1] `
            0.15 `
            $rowY `
            2.15 `
            0.20 `
            9.5 `
            $false
        $null = New-TextObject `
            $objects `
            ("Component Qty " + $row) `
            "QTY: 12" `
            2.70 `
            $rowY `
            0.90 `
            0.20 `
            9.5 `
            $false
    }

    $line = $objects.Create([BarTender.BtObjectType]::btObjectLine)
    $line.LineStartX = 0.15
    $line.LineStartY = 0.76
    $line.LineEndX = 3.60
    $line.LineEndY = 0.76
    $line.LineThickness = 0.01

    $document.PrintSetup.UseDatabase = $false
    $sampleValues = @{
        "MO Date" = "DATE: 08/05/26"
        "MO Number" = "MF-23599"
        "MO Quantity" = "QTY: 12"
    }
    for ($row = 1; $row -le 8; $row++) {
        $sampleValues["Component Item " + $row] = $sampleItems[$row - 1]
        $sampleValues["Component Qty " + $row] = "QTY: 12"
    }
    Set-ObjectValues $document $sampleValues
    $document.Save()
    $document.Close([Seagull.BarTender.Print.SaveOptions]::SaveChanges)

    if (-not [string]::IsNullOrWhiteSpace($PreviewPath)) {
        $previewDocument = $engine.Documents.Open($outputFull)
        Set-ObjectValues $previewDocument $sampleValues
        $resolution = New-Object Seagull.BarTender.Print.Resolution(300)
        $previewDocument.ExportImageToFile(
            $PreviewPath,
            [Seagull.BarTender.Print.ImageType]::PNG,
            [Seagull.BarTender.Print.ColorDepth]::ColorDepth24bit,
            $resolution,
            [Seagull.BarTender.Print.OverwriteOptions]::Overwrite
        )
        $previewDocument.Close([Seagull.BarTender.Print.SaveOptions]::DoNotSaveChanges)
    }
}
finally {
    try {
        $engine.Stop([Seagull.BarTender.Print.SaveOptions]::DoNotSaveChanges)
    }
    catch {
        # Ignore shutdown errors.
    }
    $engine.Dispose()
}

Write-Host "Updated BarTender template: $outputFull"
if (-not [string]::IsNullOrWhiteSpace($PreviewPath)) {
    Write-Host "Preview: $PreviewPath"
}
