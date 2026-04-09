# MLB Odds Override Capture Plan

## Goal

Add a separate odds-capture pipeline that can ingest the real lines you use each day without changing the current predictor path until the capture method is proven reliable.

## Why Keep It Separate

- The current automation path can continue using fetched market odds.
- Login-based site automation may fail because of MFA, bot protection, markup changes, or terms constraints.
- Persisting overrides separately lets us compare:
  - default fetched odds
  - manually pasted odds
  - future scraped odds
- We can promote overrides into the prediction flow only after they are stable.

## Target Workflow

1. Load today's slate as usual.
2. Capture the actual odds from the site you use.
3. Save those odds into a dedicated `OddsOverride` store in Postgres.
4. Review the staged overrides.
5. Later, run predictions using either:
   - default market odds
   - approved odds overrides

## Phase 1

- Add `OddsOverride` persistence in Postgres.
- Add CLI/API support to import your pasted bulk odds into that table.
- Keep the existing `run-predictions` behavior unchanged.
- Use this phase to validate:
  - the source format
  - matchup mapping quality
  - date handling
  - storage and auditability

## Phase 2

- Add a Playwright-based odds capture worker for the login-protected site.
- Store credentials in environment variables or a secret manager.
- Navigate:
  - login page
  - MLB odds page
  - capture page text or structured rows
- Parse and normalize the captured odds into the same `OddsOverride` table.
- Fall back to Phase 1 pasted import when scraping fails.

## Phase 3

- Add an approval/apply concept for overrides:
  - `staged`
  - `approved`
  - `rejected`
- Update prediction generation so it can optionally prefer approved overrides.
- Preserve a switch to keep using default fetched odds.

## Current Implementation Status

- `OddsOverride` table added to Prisma schema and migration scaffold.
- CLI added:
  - `import-odds-overrides --date YYYY-MM-DD --file PATH [--source LABEL]`
  - `capture-odds-overrides --date YYYY-MM-DD [--source LABEL]`
  - `list-odds-overrides --date YYYY-MM-DD`
- CLI review actions added:
  - `approve-odds-overrides --date YYYY-MM-DD [--source LABEL]`
  - `reject-odds-overrides --date YYYY-MM-DD [--source LABEL]`
- API added:
  - `GET /api/automation/odds-overrides?date=YYYY-MM-DD`
  - `POST /api/automation/odds-overrides/import`
- API review actions added:
  - `POST /api/automation/odds-overrides/approve`
  - `POST /api/automation/odds-overrides/reject`
- Bulk odds parsing reuses the existing app parser, so manual pasted odds and future scraper output can normalize into one path.
- The pipeline now uses only `approved` overrides when override mode is enabled.
- A generic Playwright browser worker is now scaffolded and driven by `ODDS_CAPTURE_*` environment variables.
- The Automation tab includes odds override import, capture, approve, reject, and pipeline-trigger controls.
- Browser capture progress includes:
  - iframe-aware login handling
  - slower credential typing
  - submit retries
  - modal dismissal hooks
  - visible MLB link targeting
- Browser capture is still not stable enough to treat as production-ready.

## Next Recommended Step

Stabilize the live site flow for the current sportsbook capture worker and verify that captured rows can be reviewed and approved end to end from the Automation tab against a sandbox database.
