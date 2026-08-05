# Native BarTender printing from the Receiving Labels app

The production website runs on `shock`, while the label printer is connected
directly to the Receiving workstation. Printing now uses BarTender's native
Integration Service; the custom local PowerShell print agent is not used.

```text
Receiving browser -> shock /api/labels/print -> BarTender Web Service Integration
                  -> RecievingFormat.btw -> Receiving workstation printer
```

The browser never contacts localhost and does not need printer access. `shock`
creates a BTXML batch containing one Print command for each physical label and
posts it to the Receiving workstation.

## Requirements

- BarTender 2022 Automation or Enterprise on the Receiving workstation.
- BarTender Integration Service installed and running there.
- The label printer installed in Windows on that workstation.
- A stable hostname or reserved IP for the Receiving workstation.
- A template path visible to the **integration execution account**.

Do not use a mapped drive such as `X:` when the Integration Service runs as
Local System; mapped drives are normally available only to an interactive user.
Copy the template to a local path such as
`C:\BarTender\RecievingFormat.btw`, use a UNC path, or configure the integration
to run under an account that can access the template share.

## 1. Name the template data sources

BTXML sets **named data sources**, not template object names. Open
`RecievingFormat.btw` in BarTender Designer and assign the following exact name
to the embedded data source inside each corresponding text object:

| Text object | Named data source |
| --- | --- |
| MO Date | `MO Date` |
| MO Number | `MO Number` |
| MO Quantity | `MO Quantity` |
| Component Item 1 through 8 | `Component Item 1` through `Component Item 8` |
| Component Qty 1 through 8 | `Component Qty 1` through `Component Qty 8` |

For each object: open **Properties**, select its embedded data source, open the
**Change Data Source Name** wizard beside **Name**, choose **Create new named
data source**, and type the matching name. Save the document.

Validate the saved template without printing:

```powershell
.\test-bartender-template.ps1 -TemplatePath "C:\BarTender\RecievingFormat.btw"
```

## 2. Create the Web Service Integration

On the Receiving workstation, open **BarTender Integration Builder** and create
a **Web Service Integration**.

Recommended settings:

1. **Integration**
   - Name: `Receiving Labels`
   - Start integration: **Automatic**
   - Process events in order.
   - Run actions under an account that can read the template and use the label
     printer.
2. **Service**
   - Protocol: HTTP (or HTTPS if a workstation certificate is available)
   - Port: `38178`
   - Service name: `ReceivingLabels`
   - Prefer Basic authentication. Anonymous authentication is acceptable only
     when Windows Firewall restricts the port to `shock`.
   - Copy the exact generated URL; it becomes
     `BARTENDER_INTEGRATION_URL` on `shock`.
3. **Input Data**
   - Input data format: **BTXML Script**. The request body is saved in
     `%EventData%`.
4. **Action**
   - Add **Print BTXML Script**.
   - Script: `%EventData%`
   - Print response variable: `PrintResponse`
   - Do not ignore errors.
5. **Response**
   - Enable **Send response to client**.
   - Enable **Wait for actions to complete before sending response**.
   - Content type: `application/xml`
   - Response source: the `PrintResponse` variable.

Deploy the integration, then start it in BarTender Administration Console.
Create an inbound Windows Firewall rule for the selected port, restricted to
the IP address of `shock`.

## 3. Configure `shock`

Add these values to `server\.env` on `shock`:

```dotenv
BARTENDER_INTEGRATION_URL=http://RECEIVING-STATION:38178/ReceivingLabels
BARTENDER_TEMPLATE_PATH=C:\BarTender\RecievingFormat.btw
BARTENDER_PRINTER_NAME=Exact Windows printer name
BARTENDER_USERNAME=
BARTENDER_PASSWORD=
BARTENDER_TIMEOUT_MS=120000
```

If the integration uses Basic authentication, fill in both username and
password. Leave both blank for anonymous authentication. Restart the PM2 app
after changing `.env`:

```powershell
pm2 restart receiving-labels-api --update-env
```

The template and printer values are interpreted on the **Receiving
workstation**, not on `shock`.

## 4. Verify

Check server configuration:

```powershell
Invoke-RestMethod http://shock:8087/api/labels/print-status
```

The response should contain `configured: true` and the correct printer name.
Then select one test MO in the website and click **Print with BarTender**.

One label holds up to eight components. MOs with more than eight components
automatically produce continuation labels such as `MF-23599 (1/2)` and
`MF-23599 (2/2)`. All unused component fields are explicitly cleared in every
BTXML command.

## Legacy files

`install-print-agent.ps1` and `receiving-label-print-agent.ps1` are retained
only as a rollback option. The application no longer calls port `38177` and
does not require either script to be installed or running.
