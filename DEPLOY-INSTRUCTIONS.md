# Deploy MO Receiving Labels (Shock Server)

1. **Open PowerShell as Administrator**

2. **Go to the project directory on shock**
   ```powershell
   cd "M:\mfgsys\RecievingLabels"
   ```

3. **Pull latest code**
   ```powershell
   .\pull-from-git.ps1
   ```

4. **Ensure database credentials exist**
   - Confirm `server\.env` has valid `DATABASE_*` values for ScheduleDB.
   - Deploy will set `PORT` and `ALLOWED_ORIGINS` automatically.

5. **Run the deployment script**
   ```powershell
   .\deploy-shock-server-complete.ps1
   ```
   Isolation:
   - Only touches PM2 app `receiving-labels-api`
   - Only touches IIS site/app pool `ReceivingLabels`
   - Does **not** kill other processes
   - Does **not** change shared ARR timeout
   - Picks the **next free** API port (from 3011+) and IIS port (from 8085+, so 8082/8084 stay free)
   - Saves chosen ports in `deploy-ports.json` and reuses them next time if still free

6. **Open the site**
   - Use the URLs printed at the end of the deploy script (port is dynamic).

## Repo

https://github.com/mesmail222/RecievingLabels
