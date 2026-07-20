# IntiTrade — Deploy to intitrade.shop

Deploys your code to the live site. Run everything in **Windows PowerShell**,
opened in the project root: `C:\Users\VICTUS\Desktop\Adelina\IntiTrade`.

The deploy ships whatever is on GitHub `origin/main`. Your local edits do NOT
go live until you commit AND push them (Step 2).

---

## One-time setup (already done, listed for reference)

```powershell
# Node 20+ installed, then in the backend folder:
cd backend
npm ci
npx prisma generate
cd ..
```

---

## Every deploy

### 1. Open PowerShell in the project root
In VSCode terminal, make sure the prompt shows:
`PS C:\Users\VICTUS\Desktop\Adelina\IntiTrade>`
If not: `cd C:\Users\VICTUS\Desktop\Adelina\IntiTrade`

### 2. Commit and push your changes to GitHub
```powershell
git add -A
git commit -m "describe what you changed"
git push origin main
```
If git says "nothing to commit", there are no new changes — the deploy will
just rebuild the current version.

### 3. Set the server connection variables (this window only)
These reset every time you open a new terminal. Re-paste them each session.
```powershell
$env:SSH_HOST="178.105.33.204"
$env:SSH_USER="root"
$env:SSH_HOST_FINGERPRINTS="<your SHA256:... host fingerprint>"
$env:SSH_PASSWORD="<your server password>"
```
To get the fingerprint (run once, on the SERVER, in the root@ubuntu tab):
`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`  → copy the `SHA256:...` part.

### 4. Preflight (safe, read-only — changes nothing)
```powershell
node backend/ssh_preflight.js
```
Confirms it can connect and shows the server's git state and services.

### 5. Deploy (the real thing)
```powershell
node backend/ssh_deploy.js
```
Builds a fresh release on the server, runs tests, backs up the database,
applies migrations, and atomically swaps in the new backend + frontend.
Takes a few minutes. **Do not interrupt it.**

### 6. Verify the site
Open https://intitrade.shop and https://intitrade.shop/api/health/live

---

## Important rules

- **Fast-forward only.** The server does `git merge --ff-only origin/main`.
  Keep `main` linear; always push before deploying.
- **New migration = update the marker.** If you add a Prisma migration, edit
  `deploy/backend-schema-compatibility` to the new migration name, or CI/build
  fails. Never hand-edit it otherwise.
- **Never** commit `.env`, passwords, or your SSH password to git.
- The live backend runs as `intitrade-api.service` on the server (port 4099,
  behind Nginx). It is NOT Docker, and NOT your local machine.
