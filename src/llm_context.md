# MLB Predictor Context

This folder contains the working MLB predictor app for the `game_sims` workspace.

## Current Product State

- React + TypeScript + Vite app is live
- tabs exist for `Predictor`, `Automation`, `Results Tracker`, and `Model Eval`
- `Results Tracker` and `Model Eval` are now independent workflows
- `Automation` tab now exists as an API-backed dashboard with manual fallback still preserved in the `Predictor` tab
- Predictor tab contains:
  - MLB model data refresh
  - daily schedule workflow
  - bulk line editing
  - single-game tools in a collapsible panel
- automation foundation now exists outside the React UI:
  - shared backend services in `server/`
  - TypeScript CLI in `cli.ts`
  - lightweight API in `api.ts`
  - Prisma schema and migration scaffold in `prisma/`
  - Airflow DAG scaffold in `airflow/dags/`
  - persistence layer now includes shared multi-sport metadata plus MLB-specific detail models
- built-in blended default team ratings
- daily schedule cards support:
  - probable starters
  - lineups
  - weather
  - odds
  - sharp information
  - three market-specific composite recommendation cards (`ML`, `O/U`, `RL`)
  - projected score + best composite recommendation in the game-card header
  - visible team rating inputs used by the model

## Current Daily Workflow

1. Set `Live Slate Date`
2. Click `Fetch MLB Data`
   - refreshes team-level model ratings from MLB team stats
   - requests current-season MLB team hitting / pitching / fielding plus split hitting stats
   - falls back one season only if current-season data is too incomplete
   - updates the `Teams Updated` chip
3. Click `Load Games`
   - loads slate games for the selected date
   - loads probable starters and lineup state
   - loads weather
   - interprets wind direction relative to the home park orientation
   - loads ESPN odds when available
   - now also derives a first-pass sharp snapshot from ESPN opening vs close movement
4. Optionally use `Bulk Edit Lines`
   - pasted odds now override active game odds as `manual`
   - manual odds count as valid market odds
   - this should not reset lineup/weather state
5. Click `Run All Sims`
6. Export `Predictions CSV`
7. Export `Results CSV`

## Results Tracker Workflow

- The `Results Tracker` tab now mirrors the NBA-style import flow rather than depending on `Model Eval`
- It owns its own state through `src/hooks/useResultsTracker.ts`
- it is still primarily CSV/manual at this stage and is not yet DB-backed by default
- It supports:
  - pasting exported predictions CSV
  - pasting results CSV
  - downloading yesterday's MLB results directly from the tracker
  - independent grading summaries for `ML`, `RL`, and `O/U`
  - a running graded game log
- The tracker UI now keeps two visible side-by-side textareas:
  - `Predictions CSV`
  - `Results CSV`
- Summary cards show pushes inline as `W-L-P`

## Model Eval Workflow

- `Model Eval` remains a separate calibration / threshold-tuning screen
- It no longer feeds state into `Results Tracker`
- It still consumes the same exported predictions + results CSV data through `src/lib/modelEvaluation.ts`
- DB-backed evaluation logic now exists in the automation layer, but the React `Model Eval` tab still defaults to manual CSV paste

## Automation Workflow

- the automation foundation is now implemented but not fully activated end-to-end
- current automation pieces:
  - `server/services/mlbAutomation.ts`
    - refresh team stats
    - load slate
    - load sharp signals
    - generate predictions
    - export predictions CSV
    - ingest results
    - export results CSV
    - evaluate persisted runs
  - `api.ts`
    - exposes automation runs, exports, evaluation, prediction trigger, and results ingest endpoints
  - `cli.ts`
    - operational non-UI entrypoint for automation and manual fallback
  - `airflow/dags/mlb_automation.py`
    - platform-neutral DAG scaffold that shells out to the CLI
  - `server/services/oddsCapture.ts`
    - Playwright-based login odds capture worker scaffold
  - `server/services/oddsOverrides.ts`
    - persisted odds override import/review/apply flow
- current fallback behavior:
  - if `DATABASE_URL` is absent, CLI and API stay usable in non-persistent fallback mode
  - the React app manual predictor workflow still works without Postgres or Airflow
- the schema now uses:
  - shared sport-aware `PredictionRun` rows
  - shared `PredictionFile` / `ResultFile` audit tables
  - MLB-specific Prisma models mapped onto the current MLB prediction/result/odds tables
- next required infrastructure step:
  - set up a local Postgres instance
  - copy `.env.example` to `.env`
  - populate `DATABASE_URL`
  - run Prisma migrations
- sandbox workflow is supported by loading `.env.sandbox` before starting Prisma, CLI, API, or Vite

Current manual CLI validation sequence for UI comparison:

```powershell
npm.cmd run cli -- fetch-team-stats --date 2026-04-11
npm.cmd run cli -- capture-odds-overrides --date 2026-04-11 --source betlotus-mlb
npm.cmd run cli -- approve-odds-overrides --date 2026-04-11 --source betlotus-mlb
npm.cmd run cli -- load-slate --date 2026-04-11 --use-odds-overrides --override-source betlotus-mlb
npm.cmd run cli -- run-predictions --date 2026-04-11 --use-odds-overrides --override-source betlotus-mlb
npm.cmd run cli -- export-predictions-csv --date 2026-04-11
```

Important behavior:

- `run-predictions` uses only `approved` overrides when override mode is enabled
- the exported file should be compared against the Predictor tab output for the same slate date and odds source
- the specific example date can be swapped for any target slate date

## Secrets / Config

- `.env` is now the local development config source
- `.env.sandbox` can be used for isolated local pipeline testing against a separate Postgres database
- `.env.example` documents:
  - `DATABASE_URL`
  - `API_PORT`
  - `VITE_AUTOMATION_API_BASE_URL`
  - `EXPORT_DIR`
  - `SHARP_PROVIDER`
  - fallback/persistence feature flags
- production intent remains environment variables or a secret manager rather than checked-in secrets

Important behavior:

- `API_PORT` controls where `api.ts` listens
- `VITE_AUTOMATION_API_BASE_URL` controls which automation API the React frontend calls
- changing a `VITE_*` variable requires restarting the Vite dev server
- the API now sends permissive local CORS headers so the Vite frontend can call it across ports during development

## Platform Notes

- core app, API, CLI, Prisma, and Postgres setup are intended to work on both Windows and macOS
- the Airflow DAG is now platform-neutral and chooses `npm` vs `npm.cmd` automatically
- if Airflow is launched outside the repo root, use `MLB_PREDICTOR_DIR` to point it to the project directory

## Doubleheader Support

Doubleheaders are fully supported across the automation pipeline. Two games on the same date with the same home/away pair get lookup keys `YYYYMMDDHOAWAY` (game 1) and `YYYYMMDDHOAWAY_2` (game 2).

Key behaviors to know when working on this codebase:

- **`gameNumber`** from the MLB Stats API is available on `LiveGame` and used in `buildLiveScheduleRow` to look up the correct ESPN odds/sharp key (`HOME-AWAY_2` for game 2).
- **ESPN odds and sharp maps** now deduplicate by matchup count so game 2 gets its own key instead of overwriting game 1.
- **Odds paste** (`parseBulkOdds`) extracts `gameTime` from the header line (e.g., `1:05 PM`). This is stored in `MlbOddsOverride.metadata.gameTime` and used for time-proximity matching.
- **Override assignment** (`applyOddsOverrides`) uses align-from-right when a paste has fewer entries than slate rows for a matchup — the assumption is that missing entries are games that already started and left the sportsbook.
- **Starter overrides from the paste are only applied when the MLB API returns TBD.** The API's known starters are never overridden by the paste.
- The MLB Stats API returns a placeholder time for doubleheader game 2 (near game 1's time) until game 1 ends. Don't rely on game 2's `gameTime` from the slate for time-sensitive logic until after game 1 completes.

## Odds Sources

The app now distinguishes three odds sources:

- `espn`
  - live odds from ESPN
- `manual`
  - pasted or user-edited odds
- `model`
  - generated fallback odds when no market odds are available

Sharp data behavior:

- a `sharpInput` snapshot now exists on schedule rows
- current source is `espn-derived`
- it is derived from opening vs closing line movement, not a dedicated paid sharp-data feed yet
- sharp data currently affects composite recommendation context and reporting, not the core projection equations

Important behavior:

- `Odds live` counts both `espn` and `manual`
- `Market fallback active` only means the card is still using `model` odds
- live summary chips stay gray before a live load attempt
- after a live load:
  - green means all eligible games updated
  - yellow means partial update coverage
  - red means the load failed or coverage is still `0`
- already-started games do not count against the lineup / odds / weather chip denominators

## Header Summary Behavior

Daily schedule card headers now show:

- `Proj Score: AWAY x.xx - HOME y.yy`
- `Comp Rec: ...` using the strongest active composite market

When the composite recommendation is a total, the header includes the market and price, for example:

- `Comp Rec: OVER 8.5 -115`

## Composite Recommendation Cards

After `Run All Sims`, each expanded daily schedule card now shows:

- `Composite ML Recommendation`
- `Composite O/U Recommendation`
- `Composite RL Recommendation`

Important behavior:

- each market gets its own tier, score, pick, and reasons
- displayed composite scores are on a `0-10` scale
- `PASS` / `C` / `B` / `A` color-coding is used for market edge percentages and recommendation text
- total-card reasons should explain total-related drivers such as projected total vs market total, weather, and run environment

## Grading / CSV Flow

`Predictions` export includes the grading fields used by the evaluator:

- recommendations for ML / RL / total
- edge percentages
- all market odds needed for ROI later
- `Away` and `Home` export as `ABBR TeamName` so spreadsheet formulas can safely derive team abbreviations
- `LookupKey` as the last column

`Results` export includes:

- `Date`
- `Home`
- `HomeScore`
- `Away`
- `AwayScore`
- `Winner`
- `Total`
- `LookupKey`

Important behavior:

- result rows use MLB `officialDate` for `Date` and `LookupKey`, not the UTC `gameDate`
- this avoids late West Coast games rolling into the next calendar day in exports

These are consumed by both:

- `src/lib/modelEvaluation.ts`
- `src/lib/resultsTracker.ts`

## Key Files

- `api.ts`
- `cli.ts`
- `server/config.ts`
- `server/db/repositories.ts`
- `server/services/mlbAutomation.ts`
- `prisma/schema.prisma`
- `airflow/dags/mlb_automation.py`
- `.env.example`
- `src/components/AutomationDashboard.tsx`
- `src/hooks/useAutomationDashboard.ts`
- `src/lib/automationApi.ts`
- `src/components/ResultsTracker.tsx`
- `src/components/ModelEvaluation.tsx`
- `src/components/ScheduleAnalysis.tsx`
- `src/components/SingleGameControls.tsx`
- `src/components/SingleGameResults.tsx`
- `src/hooks/useMlbModelData.ts`
- `src/hooks/usePredictorState.ts`
- `src/hooks/useResultsTracker.ts`
- `src/lib/mlbApi.ts`
- `src/lib/teamRatings.ts`
- `src/lib/mlbModel.ts`
- `src/lib/modelEvaluation.ts`
- `src/lib/resultsTracker.ts`
- `proxy.ts`
- `.github/workflows/ci.yml`

## Current Gaps

- Prisma schema and migration scaffold exist, but migrations have not yet been applied to a live local Postgres instance
- API-backed automation dashboard is wired into the app, but `Results Tracker` and `Model Eval` are still manual-first
- Airflow DAG exists as a scaffold and has not yet been validated in a live Airflow runtime
- no dedicated sharp-data vendor is integrated yet beyond ESPN-derived movement signals
- login-protected odds capture is in progress for BetLotus-style flow but is not stable enough to be considered finished

## CI

GitHub Actions CI now exists for the MLB predictor.

Current workflow coverage:

- lint
- typecheck
- unit tests
- build
- Playwright e2e
- focused Results Tracker coverage now exists for:
  - `src/hooks/useResultsTracker.test.ts`
  - `src/components/ResultsTracker.test.tsx`
  - parser compatibility in `src/lib/modelEvaluation.test.ts`
