# MLB Automation, CLI, API, and Postgres Plan

## Implemented Foundation

- Shared Node/TypeScript automation layer now exists under `server/`
- TypeScript CLI added in `cli.ts`
- Lightweight API added in `api.ts`
- Prisma schema and initial migration scaffold added under `prisma/`
- Airflow DAG scaffold added under `airflow/dags/`
- Local config/secrets flow added through `.env` / `.env.example`

## Delivery Shape

The predictor remains usable as a standalone UI, but now has an operational foundation for:

1. refreshing team stats
2. loading a slate
3. enriching slate rows with sharp data
4. generating predictions
5. storing runs in Postgres when configured
6. exporting predictions/results CSV from the automation layer
7. evaluating persisted runs

## Target Automated Pipeline

The target daily automation flow is:

1. ensure Postgres and the app stack are available
2. fetch MLB data and the day's slate
3. override fetched odds with the actual odds source when available
4. add sharp information to the slate context
5. predict games
6. store predictions in Postgres
7. export predictions CSV
8. load yesterday's final results
9. store results in Postgres
10. export results CSV

Manual for now after the pipeline runs:

1. interpret predictions and decide bets
2. record actual bets placed
3. track realized betting results separately from model predictions

Future automation candidate after the pipeline is stable:

- add bet-tracking persistence and workflows
- optionally automate bet/result journaling

## Phase Breakdown

### Phase 1

- backend automation pipeline for predictions and results
- Postgres persistence
- CSV exports
- manual or imported odds overrides supported as an optional step
- no automated bet placement or automated bet journaling

### Phase 2

- login-based odds capture worker
- review and approval flow for imported/scraped odds overrides
- Airflow scheduling around the daily pipeline command

### Phase 3

- manual bet tracking stored in Postgres
- optional future automation for bet-result capture after the model pipeline is stable

## Notes

- Fallback mode is preserved: if `DATABASE_URL` is absent, CLI/API still run in non-persistent mode.
- Sharp data is currently derived from ESPN opening/closing line movement and stored as normalized sharp signals.
- Odds overrides now have a separate persisted lane planned and scaffolded so login-based/manual-source lines can be staged independently from the default market-odds workflow.
- The live production predictor remains the existing heuristic model.
- Prisma migrations are scaffolded but still need to be applied against a real Postgres instance.
- Airflow is intentionally orchestration-only and shells out to the CLI.
- The frontend automation client now reads `VITE_AUTOMATION_API_BASE_URL` instead of a hardcoded API URL.
- Sandbox testing is supported with `.env.sandbox`, a separate Postgres database, and a separate API port.
- The login-based odds capture worker exists, but the live site flow still needs stabilization before Phase 2 can be considered complete.
- The persistence layer now has a shared multi-sport foundation:
  - sport-aware `PredictionRun`
  - shared `PredictionFile` / `ResultFile`
  - MLB-specific detail models ready to coexist with future `NBA`, `NHL`, `NCAAM`, `NFL`, and `NCAAF` tables.

## Manual CLI Validation Sequence

Use this sequence when manually validating the automation pipeline against the UI for a given slate date. The `2026-04-11` date below is an example and can be swapped for a different slate date.

**Windows (PowerShell):**
```powershell
npm.cmd run cli -- fetch-team-stats --date 2026-04-11
npm.cmd run cli -- capture-odds-overrides --date 2026-04-11 --source betlotus-mlb
npm.cmd run cli -- approve-odds-overrides --date 2026-04-11 --source betlotus-mlb
npm.cmd run cli -- load-slate --date 2026-04-11 --use-odds-overrides --override-source betlotus-mlb
npm.cmd run cli -- run-predictions --date 2026-04-11 --use-odds-overrides --override-source betlotus-mlb
npm.cmd run cli -- export-predictions-csv --date 2026-04-11
```

**macOS / Linux:**
```bash
npm run cli -- fetch-team-stats --date 2026-04-11
npm run cli -- capture-odds-overrides --date 2026-04-11 --source betlotus-mlb
npm run cli -- approve-odds-overrides --date 2026-04-11 --source betlotus-mlb
npm run cli -- load-slate --date 2026-04-11 --use-odds-overrides --override-source betlotus-mlb
npm run cli -- run-predictions --date 2026-04-11 --use-odds-overrides --override-source betlotus-mlb
npm run cli -- export-predictions-csv --date 2026-04-11
```

Expected intent of each step:

- `fetch-team-stats` mirrors `Fetch MLB Data`
- `capture-odds-overrides` runs the Playwright sportsbook scrape and stages overrides
- `approve-odds-overrides` promotes the staged sportsbook lines so the pipeline can use them
- `load-slate --use-odds-overrides` mirrors `Load Games` with approved overrides applied
- `run-predictions --use-odds-overrides` mirrors `Run All Sims`
- `export-predictions-csv` writes the automation-side predictions export for UI comparison
