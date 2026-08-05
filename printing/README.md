# Receiving workstation BarTender printing

The website is hosted on `shock`, but the label printer is installed on the
Receiving workstation. The local print agent bridges that gap:

1. The website sends selected MO label data to `http://127.0.0.1:38177`.
2. The agent opens the shared BarTender template
   (`X:\Barcode Tag Formats\Receiving\RecievingFormat.btw`).
3. BarTender fills the MO/date/component fields and prints to the selected
   workstation printer.

## One-time workstation setup

Requirements:

- BarTender 2022 Automation or Enterprise installed.
- The label printer installed in Windows.
- The shared `X:` drive available.
- Access to the project `printing` folder.

Open **Windows PowerShell as Administrator**, change to the `printing` folder,
and run:

```powershell
.\install-print-agent.ps1
```

The installer:

- Copies the agent to `%LOCALAPPDATA%\GLoomis\ReceivingLabelsPrintAgent`.
- Reserves local port `38177`.
- Creates a Scheduled Task that starts the agent at logon.
- Starts the agent and lists the printers BarTender can see.

Reload the Receiving Labels website after installation. The printer dropdown
will appear beside **Print with BarTender**.

## Label behavior

- One 3.775" × 2.775" label holds up to eight components.
- MOs with more than eight components automatically print continuation labels,
  such as `MF-23599 (1/2)` and `MF-23599 (2/2)`.
- The browser print button remains available as a fallback, but it does not use
  the BarTender template.
