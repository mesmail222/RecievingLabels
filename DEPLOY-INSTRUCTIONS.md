# Deploy MO Receiving Labels (Shock Server)

1. **Open PowerShell as Administrator**
   - Press the Windows key, type **PowerShell**
   - Right-click **Windows PowerShell** and choose **Run as administrator**

2. **Go to the project directory on shock**
   ```powershell
   cd "M:\mfgsys\RecievingLabels"
   ```
   (Adjust the path if you cloned the repo elsewhere.)

3. **Pull latest code**
   ```powershell
   .\pull-from-git.ps1
   ```
   Fast-forward pull from `origin/main`. Leaves `server\.env` alone (gitignored).

4. **Ensure database credentials exist**
   - Confirm `server\.env` has valid `DATABASE_*` values for ScheduleDB.
   - The deploy script will set `PORT=3011` and update `ALLOWED_ORIGINS`.

5. **Run the deployment script**
   ```powershell
   .\deploy-shock-server-complete.ps1
   ```
   This will:
   - Stop/restart PM2 app `receiving-labels-api` on port **3011**
   - `npm install` + build frontend and backend
   - Copy `dist` to `C:\inetpub\ReceivingLabels\frontend`
   - Configure IIS site **ReceivingLabels** on port **8084**
   - Proxy `/api` → `http://127.0.0.1:3011`

6. **Open the site**
   - http://localhost:8084
   - http://shock:8084

## Repo

https://github.com/mesmail222/RecievingLabels
