# Contributing

Thanks for helping improve Unraid PWA.

## Development setup

1. Copy environment file:
   - `cp .env.example .env`
2. Install dependencies:
   - `npm --prefix backend install`
   - `npm --prefix frontend install`
3. Run apps:
   - backend: `npm run dev:backend`
   - frontend: `npm run dev:frontend`

## Quality checks

- Lint/type-check: `npm run lint`
- Backend tests: `npm run test`
- Frontend e2e: `npm run test:e2e`

## Pull request guidelines

- Keep PRs focused and small.
- Include tests for backend logic changes when possible.
- Do not commit generated artifacts (`dist`, `test-results`, runtime `backend/data/*`).
- Update `README.md` if user-facing behavior or setup changed.

## Security notes

- Never commit real server URLs, API keys, or encrypted local data from `backend/data/`.
- Use a strong `UNRAID_BFF_ENCRYPTION_KEY` in production.
