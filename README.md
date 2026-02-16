# Unraid PWA

Open-source, self-hostable, mobile-first web app to monitor and control Unraid through its GraphQL API.

## Why this project

Existing Unraid mobile UIs are often closed source or not self-hostable. This project is designed to be:

- open source
- easy to self-host
- safe by default for write actions
- straightforward to extend

## Features

- Multi-server setup (store multiple Unraid endpoints, switch active server)
- Monitoring views: Dash, Storage, Shares, Docker, VM
- Write actions with guardrails:
  - CSRF protection
  - rate limiting on write endpoints
  - audit log entries
- PWA shell + offline API snapshot cache
- Docker icon fallback proxy endpoint (`/api/docker/:id/icon`)
- Encrypted local credential store (`backend/data/servers.enc`)

## Stack

- Frontend: React + Vite + TypeScript
- Backend: Express + TypeScript
- Testing:
  - Backend unit tests with Vitest
  - Frontend smoke test with Playwright

## Repository structure

- `frontend/` React app
- `backend/` Express BFF
- `docs/` schema and architecture docs
  - `docs/unraid-api-schema.graphql`
  - `docs/architecture.md`
- `docker-compose.yml` single-container deployment
- `Dockerfile` multi-stage frontend+backend build

## Quick start (local)

1. Create env file:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm --prefix backend install
npm --prefix frontend install
```

3. Run both apps (two terminals):

```bash
npm run dev:backend
npm run dev:frontend
```

4. Open frontend:

- `http://localhost:5173`

## Quick start (docker)

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost:8080`.

## Install on Unraid (easy)

This app runs as a single Docker container. The simplest way on Unraid is to use the Docker CLI from the Unraid terminal or a user script.

1. Open Unraid terminal (or SSH in).
2. Create a folder for the app and enter it:

```bash
mkdir -p /mnt/user/appdata/unraid-pwa
cd /mnt/user/appdata/unraid-pwa
```

3. Copy the repository contents into this folder (for example via `git clone` or by uploading the files).
4. Create the env file:

```bash
cp .env.example .env
```

5. Update `.env` with your settings (especially `UNRAID_BFF_ENCRYPTION_KEY`).
6. Start the container:

```bash
docker compose up -d --build
```

7. Open the app in your browser:

- `http://<your-unraid-ip>:8080`

Notes:
- Data is stored in `/mnt/user/appdata/unraid-pwa/backend/data` via the volume mount in `docker-compose.yml`.
- If you want to change the port, edit `docker-compose.yml` (`8080:3001`) and restart the container.

## Environment variables

Defined in `.env.example`:

- `UNRAID_BFF_PORT` backend port (default `3001`)
- `UNRAID_BFF_ORIGIN` CORS allowlist (comma-separated, `*` allowed)
- `UNRAID_BFF_SESSION_SECRET` reserved for future session hardening
- `UNRAID_BFF_ENCRYPTION_KEY` key material used for local credential encryption
- `UNRAID_BFF_ALLOW_SELF_SIGNED` allow self-signed Unraid certs (`true`/`false`)

## Security notes

- API keys are not stored in browser local storage.
- Backend stores credentials encrypted on disk.
- Write routes require CSRF token and are rate-limited.
- All write actions are logged in `backend/data/audit.log`.
- Use a strong `UNRAID_BFF_ENCRYPTION_KEY` in production.

## Scripts

Root scripts:

- `npm run dev:backend`
- `npm run dev:frontend`
- `npm run lint`
- `npm run build`
- `npm run test`
- `npm run test:e2e`

Project-level scripts remain available in `backend/package.json` and `frontend/package.json`.

## Testing

Backend:

```bash
npm run test
```

Frontend smoke (requires app/API running):

```bash
npm run test:e2e
```

Playwright browser install (first time only):

```bash
npm --prefix frontend exec playwright install chromium
```

## Troubleshooting

- If your workspace is mounted with `noexec` (common in cloud-synced folders), `esbuild` may fail with `EACCES`.
- Fix locally with:

```bash
chmod u+x frontend/node_modules/@esbuild/darwin-arm64/bin/esbuild
```

## Contributing

See `CONTRIBUTING.md`.

## License

MIT (`LICENSE`).
