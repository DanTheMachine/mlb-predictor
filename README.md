# MLB Predictor

MLB predictor app for the `game_sims` workspace.

## Stack

- React
- TypeScript
- Vite
- Vitest
- Playwright
- ESLint
- Prisma
- Postgres
- Express API
- TypeScript CLI

## Current App

The MLB app is no longer a scaffold. It now includes:

- Predictor / Results Tracker / Model Eval tabs
- Predictor / Automation / Results Tracker / Model Eval tabs
- independent Results Tracker and Model Eval workflows
- live MLB team-model refresh
- daily schedule loading
- live weather and ESPN odds integration
- park-relative wind-direction interpretation for weather
- bulk manual line editing
- single-game simulator tools
- prediction export and results export for grading
- automation foundation with CLI/API/Postgres support

## Core Workflow

1. Select `Live Slate Date`
2. Click `Fetch MLB Data`
3. Click `Load Games`
4. Optionally use `Bulk Edit Lines`
5. Click `Run All Sims`
6. Export `Predictions CSV`
7. Export `Results CSV`

## Automation Layer

The repo now includes a shared automation foundation outside the React UI:

- `server/`
  shared config, persistence, export, and automation services
- `cli.ts`
  operational CLI for scheduled jobs and fallback manual runs
- `api.ts`
  lightweight API for DB-backed runs, exports, and evaluation
- `prisma/`
  Postgres schema plus initial migration scaffold
- `airflow/dags/`
  Airflow DAG scaffold that shells out to the CLI

Current status:

- standalone/manual predictor mode remains fully supported
- automation foundation is implemented
- local Postgres setup plus Prisma migration is the next required step for persistent automation history
- React `Automation` tab can consume the API when available

### CLI Commands

```bash
npm run cli -- fetch-team-stats --date 2026-03-31
```

```bash
npm run cli -- load-slate --date 2026-03-31
```

```bash
npm run cli -- run-predictions --date 2026-03-31
```

```bash
npm run cli -- export-predictions-csv --date 2026-03-31
```

```bash
npm run cli -- ingest-results --date 2026-03-30
```

```bash
npm run cli -- export-results-csv --date 2026-03-30
```

```bash
npm run cli -- evaluate --from 2026-03-01 --to 2026-03-30
```

### Local Config

- copy `.env.example` to `.env`
- set `DATABASE_URL` when Postgres persistence is available
- leave `DATABASE_URL` unset to run in fallback non-persistent mode

### Prisma

Generate the Prisma client:

```bash
npm run prisma:generate
```

Apply migrations against your Postgres instance:

```bash
npm run prisma:migrate:dev
```

## Odds Behavior

The app supports three odds states:

- `ESPN live`
- `Manual`
- `Model default`

`Odds live` remains satisfied for both `ESPN live` and `Manual`.

`Market fallback active` means the game is still using `Model default` odds.

Live schedule chip behavior:

- gray before a live slate load attempt
- green when all eligible games are updated
- yellow when only some eligible games are updated
- red when the live load fails or the updated count remains `0`
- already-started games are excluded from the chip denominator

Game card header behavior:

- projected score now appears in the header as `Proj Score: AWAY x.xx - HOME y.yy`
- composite recommendation now appears as `Comp Rec: ...`
- totals can include the market and price, for example `Comp Rec: OVER 8.5 -115`

## Grading Files

`Predictions` export contains:

- model recommendations
- edge percentages
- moneyline / run line / total odds
- `LookupKey`

`Results` export contains:

- final scores
- `LookupKey`

These two files are now used in two separate places:

- `Results Tracker` for a persistent import-and-grade workflow
- `Model Eval` for threshold tuning and ROI analysis

## CI

GitHub Actions now runs automated CI for the MLB app on pushes to `main` / `master` and on pull requests.

The workflow runs:

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run test:e2e`
