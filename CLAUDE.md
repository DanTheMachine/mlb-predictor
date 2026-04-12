# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

An MLB game prediction and wagering analysis system. Core capabilities:
- Single-game simulator (React UI) with run projections, ML/RL/OU probabilities
- Daily schedule intelligence with live odds, lineups, weather
- Automated prediction pipeline (CLI/API/Airflow) with DB persistence
- Results tracking, grading, and model evaluation
- Multi-sport schema foundation (NBA, NHL, NFL, NCAAM, NCAAF planned)

## Commands

```bash
# Development servers (all three typically run concurrently)
npm run proxy        # MLB Stats API + ESPN CORS proxy (port 8787)
npm run api          # Automation REST API (port 8788)
npm run dev          # Vite React frontend (port 5173)

# Build & type checking
npm run build
npm run typecheck
npm run lint

# Testing
npm run test                  # Vitest unit tests
npm run test:watch
npm run test:ui               # Interactive Vitest UI
npm run test:e2e              # Playwright (requires running servers)
npx vitest run src/lib/mlbModel.test.ts   # Single test file

# Database
npm run prisma:generate
npm run prisma:migrate:dev    # Dev migrations (interactive)
npm run prisma:migrate:deploy # Production deploy
```

### CLI (requires proxy running)

```bash
npm run cli -- run-daily-pipeline --date 2026-03-31   # Full pipeline
npm run cli -- fetch-team-stats --date 2026-03-31
npm run cli -- load-slate --date 2026-03-31
npm run cli -- run-predictions --date 2026-03-31
npm run cli -- export-predictions-csv --date 2026-03-31
npm run cli -- ingest-results --date 2026-03-30
npm run cli -- export-results-csv --date 2026-03-30
npm run cli -- evaluate --from 2026-03-01 --to 2026-03-30
npm run cli -- import-season-sheet --file "path.csv"
npm run cli -- import-odds-overrides --file "path.txt"
npm run cli -- list-odds-overrides --date 2026-03-31
npm run cli -- approve-odds-overrides --date 2026-03-31 --source "manual-site-copy"
```

## Architecture

### Three-Tier Structure

**Frontend** (`src/`)
- `MLBPredictor.tsx` — root component with 4-tab UI (Predictor, Results Tracker, Model Eval, Automation)
- `src/lib/` — prediction engine, betting math, model evaluation, results tracker
- `src/hooks/` — state management (usePredictorState, useMlbModelData, useAutomationDashboard, useResultsTracker)
- `src/components/` — ScheduleAnalysis, AutomationDashboard, ModelEvaluation, ResultsTracker, SingleGameControls, etc.

**Backend** (`server/`, `api.ts`, `cli.ts`, `proxy.ts`)
- `proxy.ts` — CORS proxy for MLB Stats API, ESPN odds, weather APIs
- `api.ts` — Express REST API consumed by AutomationDashboard tab
- `cli.ts` — CLI wrapping the same service layer as the API
- `server/services/` — mlbAutomation, oddsCapture, oddsOverrides, historicalImport, sharpProvider
- `server/config.ts` — typed env config with defaults
- `server/db/` — Prisma client singleton + repository layer

**Database** (`prisma/`)
- PostgreSQL via Prisma 6
- `PredictionRun` is sport-aware root; all MLB detail tables FK into it
- Key tables: MlbTeamStatSnapshot, MlbSlateGame, MlbMarketOddsSnapshot, MlbOddsOverride, MlbPrediction, MlbGameResult
- Analytics: EvaluationSummary, ModelVersion, CalibrationRun
- DB persistence is optional — `ENABLE_DB_PERSISTENCE=false` runs without Postgres

### Prediction Engine (`src/lib/mlbModel.ts`)

The core model blends:
- ~400 team baseline ratings (prior season + 2026 live)
- Starter ERA/FIP/WHIP/K-rate/BB-rate/HR9 (L/R splits)
- Offense splits vs handedness
- Park factors + weather (wind direction relative to park orientation)
- Bullpen context

Outputs: projected runs for each team → ML/RL/OU probabilities.

### Odds Flow

Three states, applied in priority order:
1. ESPN live odds (fetched via proxy)
2. Manual overrides (bulk paste parser → staged in DB → approved)
3. Model-derived default

`sharpProvider.ts` controls which source is used per `SHARP_PROVIDER` env var. Sharp signal tracking uses `MlbSharpSignal*` tables.

### Export/Import

- Predictions CSV and Results CSV export to `EXPORT_DIR` (default `./generated/`)
- Sandbox exports go to `./generated-sandbox/`
- Historical TSV/CSV import via `import-season-sheet` command
- Lookup key format links prediction rows to result rows across exports

## Environment

Copy `.env.example` to `.env`. Key vars:
```
DATABASE_URL=postgresql://...
API_PORT=8788
VITE_AUTOMATION_API_BASE_URL=http://localhost:8788
EXPORT_DIR=./generated
SHARP_PROVIDER=espn-derived
ENABLE_DB_PERSISTENCE=true
```

Playwright-based odds capture requires additional `ODDS_CAPTURE_*` vars — see `.env.example`.

## Key Docs

- `RUNNING_THE_MLB_MODEL.md` — startup instructions, sandbox DB workflow, proxy/API/CLI usage
- `MLB_PREDICTOR_BUILD_PLAN.md` — original design doc, modeling philosophy, product direction
- `MLB_AUTOMATION_PLAN.md`, `MLB_GAME_INTELLIGENCE_PLAN.md`, `MLB_ODDS_OVERRIDE_PLAN.md` — feature roadmaps

## CI

GitHub Actions (`.github/workflows/ci.yml`): lint → typecheck → unit tests → build → E2E. Node 22.
