# Unraid PWA

Self-hostable, mobile-first web app to monitor and control Unraid via the GraphQL API.

## Install On Unraid (Terminal)

> This app is **not yet in Community Applications**. Install it manually with Docker Compose.

Run these commands on your Unraid server terminal:

```bash
cd /mnt/user/appdata
git clone https://github.com/laurensguijt/Unraid-PWA.git
cd Unraid-PWA

# Optional: customize environment values
cp .env.example .env
nano .env

# Build and start
docker compose up -d --build

# Check status
docker compose ps
```

Open:

- `http://<UNRAID-IP>:2442`

First run in the UI:

1. Add your Unraid server URL (`https://<unraid-ip>:3443`)
2. Add your Unraid API key
3. Save setup

## Update On Unraid

```bash
cd /mnt/user/appdata/Unraid-PWA
git pull
docker compose up -d --build
```

## Stop / Start

```bash
cd /mnt/user/appdata/Unraid-PWA
docker compose down
docker compose up -d
```

## Data Persistence

Persistent app data is stored in:

- `backend/data/servers.enc` (encrypted server credentials)
- `backend/data/encryption.key` (local encryption key)
- `backend/data/audit.log` (write action audit log)

Back up the `backend/data` folder.

## Configuration

`.env` is optional. Defaults work out of the box.

Available variables (see `.env.example`):

- `UNRAID_BFF_PORT` (default `3001`, mapped to host port `2442` in `docker-compose.yml`)
- `UNRAID_BFF_ORIGIN` (CORS allowlist for cross-origin `/api` requests; same-origin usage on `http://<UNRAID-IP>:2442` does not need this)
- `UNRAID_BFF_ENCRYPTION_KEY` (optional override; if empty, app auto-generates and persists `backend/data/encryption.key`)
- `UNRAID_BFF_ALLOW_SELF_SIGNED` (`true`/`false`)
- `UNRAID_BFF_TRUST_PROXY` (`false`, `true`, or proxy mode)

## Local Development

```bash
npm --prefix backend install
npm --prefix frontend install
npm run dev:backend
npm run dev:frontend
```

Frontend dev URL:

- `http://localhost:5173`

## Quality Checks

```bash
npm run lint
npm run test
npm run test:e2e
```

## License

MIT (`LICENSE`).
