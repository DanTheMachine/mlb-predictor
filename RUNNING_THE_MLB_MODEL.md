# Running The MLB Model

## Install

```bash
npm install
```

## Start The Proxy

The MLB app uses a local proxy for:

- MLB schedule and probable starters
- MLB lineup checks
- MLB team stats used for model refresh
- weather
- ESPN odds

Run this from the `mlb_predictor` project directory in a separate terminal:

```bash
npm run proxy
```

The proxy listens on `http://localhost:8787`.

## Start The App

```bash
npm run dev
```

## Start The Automation API

```bash
npm run api
```

The frontend automation dashboard uses `VITE_AUTOMATION_API_BASE_URL`.

Important:

- `API_PORT` controls where the API listens
- `VITE_AUTOMATION_API_BASE_URL` controls which API the React app calls
- restart `npm run dev` after changing any `VITE_*` variable

Recommended startup order:

1. `npm run proxy`
2. `npm run api`
3. `npm run dev`
4. Open the MLB predictor UI

## Sandbox Database Workflow

Use this when you want to test the API, CLI, and pipeline without writing to your main `mlb_predictor` database.

1. create a separate Postgres database such as `mlb_sandbox`
2. create `.env.sandbox`
3. set sandbox-specific values:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/mlb_sandbox?schema=public"
API_PORT=8789
VITE_AUTOMATION_API_BASE_URL=http://localhost:8789
EXPORT_DIR="./generated-sandbox"
```

4. load `.env.sandbox` into the current PowerShell session:

```powershell
Get-Content .env.sandbox | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') {
    $name = $matches[1].Trim()
    $value = $matches[2].Trim().Trim('"')
    [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}
```

5. apply migrations to the sandbox database:

```powershell
npm.cmd run prisma:migrate:deploy
```

6. start the sandbox API:

```powershell
npm.cmd run api
```

7. start the sandbox frontend from the same loaded environment:

```powershell
npm.cmd run dev
```

8. run sandbox CLI commands from the same loaded environment:

```powershell
npm.cmd run cli -- run-daily-pipeline --date YYYY-MM-DD
```

Notes:

- if the frontend was already running, restart it after loading `.env.sandbox`
- if the API was already running, restart it after loading `.env.sandbox`
- this keeps sandbox writes isolated to `mlb_sandbox`

## Phase 1 Automation Workflow

Phase 1 assumes:

- Postgres is already installed and running
- the proxy is running
- you may optionally stage real odds overrides before prediction generation

One-command daily pipeline:

```bash
npm run cli -- run-daily-pipeline --date YYYY-MM-DD
```

If you want to use staged odds overrides first:

```bash
npm run cli -- import-odds-overrides --date YYYY-MM-DD --file "C:\path\to\odds.txt" --source "manual-site-copy"
```

If you want to try browser-based capture from a login-protected site instead:

```bash
npm run cli -- capture-odds-overrides --date YYYY-MM-DD --source "playwright-site"
```

That command requires the `ODDS_CAPTURE_*` environment variables in `.env` to be configured for:

- login URL
- optional post-login odds page URL
- username and password
- username/password/submit selectors
- content selector for the odds block you want to parse

Review the staged overrides:

```bash
npm run cli -- list-odds-overrides --date YYYY-MM-DD
```

Approve them for pipeline use:

```bash
npm run cli -- approve-odds-overrides --date YYYY-MM-DD --source "manual-site-copy"
```

```bash
npm run cli -- run-daily-pipeline --date YYYY-MM-DD --use-odds-overrides --override-source "manual-site-copy"
```

That pipeline currently does:

1. refresh team stats
2. load the day's slate
3. load sharp information
4. optionally replace fetched odds with stored odds overrides
5. generate predictions
6. write predictions to Postgres
7. export predictions CSV
8. ingest yesterday's results
9. write results to Postgres
10. export results CSV

Only `approved` overrides are used by the pipeline.

## Import Historical Predictions Into Postgres

To import a historical predictions CSV or TSV into Postgres:

```powershell
npm.cmd run cli -- import-season-sheet --file "C:\path\to\predictions.csv"
```

Optional source label:

```powershell
npm.cmd run cli -- import-season-sheet --file "C:\path\to\predictions.csv" --source "my-import"
```

The import expects the historical sheet headers used by `server/services/historicalImport.ts`, including at least:

- `Date`
- `Away`
- `Home`
- `LookupKey`

If the file also includes `Actual Home Score` and `Actual Away Score`, results are imported too.

## Automated Daily Pipeline (macOS launchd)

The daily pipeline runs automatically at **9 AM Pacific** via macOS launchd. This replaces Airflow as the production scheduler — Airflow 2.10.x has a Python 3.11 multiprocessing incompatibility on macOS that prevents tasks from executing.

### How it works

1. launchd fires `airflow/run-pipeline.sh` at 9 AM daily
2. The script checks if the proxy is running; starts it if not
3. Runs: `npm run cli -- run-daily-pipeline --date DATE --use-odds-overrides --override-source betlotus-mlb`
4. Logs output to `airflow/logs/pipeline/YYYY-MM-DD.log`

### Managing the launchd job

```bash
# Check if the job is loaded and running
launchctl list | grep mlb-predictor

# Load (install/enable) the job
launchctl load ~/Library/LaunchAgents/com.mlb-predictor.daily-pipeline.plist

# Unload (disable) the job
launchctl unload ~/Library/LaunchAgents/com.mlb-predictor.daily-pipeline.plist

# Trigger a manual run right now
launchctl start com.mlb-predictor.daily-pipeline

# View today's log
cat airflow/logs/pipeline/$(date +%Y-%m-%d).log

# View launchd stdout/stderr
cat airflow/logs/pipeline/launchd-stdout.log
cat airflow/logs/pipeline/launchd-stderr.log
```

### If the Mac was asleep at 9 AM

launchd handles this natively — the job fires when the Mac wakes. No manual intervention needed.

### Airflow webserver (optional, for UI only)

The Airflow DAG (`airflow/dags/mlb_automation.py`) still exists and the webserver can be started for visibility, but the **scheduler is not used in production**:

```bash
cd airflow
bash start.sh
# Opens Airflow UI at http://localhost:8080
```

## Cross-Platform Notes

- The app, API, CLI, Prisma, and Postgres setup are intended to work on both Windows and macOS.
- The Airflow DAG is platform-neutral and chooses `npm` vs `npm.cmd` automatically based on host OS, but the scheduler is not used on macOS — launchd is the production scheduler.
- If running the CLI manually, the proxy must be running first (`npm run proxy` in a separate terminal).
- Set `MLB_PREDICTOR_DIR` env var if running outside the repo root.

## Normal Predictor Workflow

1. Set `Live Slate Date`
2. Click `Fetch MLB Data`
   - refreshes team-level ratings used by the model
   - pulls MLB hitting / pitching / fielding plus split hitting team stats
   - uses current-season data first and only falls back a season if current-season coverage is too thin
3. Click `Load Games`
   - loads the slate
   - loads lineups
   - loads weather
   - interprets wind direction relative to the home park orientation
   - loads ESPN odds when available
4. Optionally use `Bulk Edit Lines`
   - pasted lines become active `Manual` odds
5. Click `Run All Sims`
6. Export `Predictions`
7. Export `Results`

## Results Tracker Workflow

1. Open the `Results Tracker` tab
2. Paste exported `Predictions CSV`
3. Paste `Results CSV` or click `Download Yesterday's Results`
4. Import each file from its own side-by-side editor
5. Review the market summaries and graded game log

## Model Eval Workflow

- `Model Eval` is separate from `Results Tracker`
- Use it for threshold tuning, edge-bucket diagnostics, and evaluator reporting
- It still accepts pasted predictions and results CSV data, but it no longer powers the tracker tab

## Notes

- `Load Sample Slate` does not require the proxy.
- `Bulk Edit Lines` does not require the proxy.
- `Fetch MLB Data` and `Load Games` do require the proxy.
- built-in baseline team ratings are currently a blend of prior defaults and live 2026-derived team ratings.
- `Results` exports the previous day's completed MLB results using MLB `officialDate` for `Date` and `LookupKey`.
- `Results` CSV column order is `Date, Home, Away, Home Score, Away Score, Winner, Total, LookupKey`.
- `Predictions` exports `Away` and `Home` as `ABBR TeamName`.
- `run-daily-pipeline` is the current Phase 1 backend automation entrypoint.
- odds overrides can now be staged separately in Postgres before prediction generation.
- `Results Tracker` now has its own import flow and no longer depends on `Model Eval`.
- `Results Tracker` keeps `Predictions CSV` and `Results CSV` editors visible side by side.
- `Odds live` counts both `ESPN live` and `Manual` odds.
- `Market fallback active` means the card is still using model-generated default odds.
- live lineup / odds / weather chips are gray before load, green for full eligible coverage, yellow for partial eligible coverage, and red on failure or zero coverage
- already-started games are excluded from the live chip denominator
- the expanded daily card shows separate `Composite ML`, `Composite O/U`, and `Composite RL` recommendation cards.
- composite scores are displayed on a 10-point scale.
- the game card header shows `Proj Score: AWAY x.xx - HOME y.yy` and the strongest `Comp Rec: ...`

## Validation Commands

```bash
npm run typecheck
```

```bash
npm run test
```

```bash
npm run build
```

## CI

GitHub Actions now runs the same core checks in CI from `.github/workflows/ci.yml`:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run test:e2e`
