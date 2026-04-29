# Multi-Sport Database Architecture Plan

This document captures the current MLB database layout and provides a step-by-step blueprint for adding a new sport (e.g. NBA or NHL) to the same Prisma/PostgreSQL database without disrupting the existing MLB pipeline.

---

## 1. Current Architecture Overview

### 1.1 Database

PostgreSQL (Prisma 6), single `DATABASE_URL`. Three named databases exist on the host:

| Database | Purpose |
|---|---|
| `mlb_predictor` | Production predictions |
| `mlb_sandbox` | Testing / manual runs |
| `airflow` | Airflow metadata (scheduler replaced by launchd) |

### 1.2 Sport Enum

The `Sport` enum is already defined and already includes all planned sports:

```prisma
enum Sport {
  MLB
  NBA
  NHL
  NCAAM
  NFL
  NCAAF
}
```

### 1.3 Shared / Sport-Aware Tables

These tables carry a `sport` field and are already designed to be reused across sports:

| Prisma Model | Postgres Table | Key Fields | Notes |
|---|---|---|---|
| `PredictionRun` | `PredictionRun` | sport, businessDate, modelVersion, status, exportPath, resultsPath | Root record; all sport-specific detail tables FK into it |
| `MlbOddsOverride` | `OddsOverride` (rename recommended — see §4) | sport, businessDate, lookupKey, awayTeam, homeTeam, source, status, odds (JSON) | Bulk-paste overrides pipeline |
| `EvaluationSummary` | `EvaluationSummary` | sport, fromDate, toDate, modelVersion, summary (JSON) | Model eval results |
| `ModelVersion` | `ModelVersion` | sport, version, description, parameters (JSON), status | Unique per (sport, version) |
| `CalibrationRun` | `CalibrationRun` | sport, modelVersion, status, output (JSON) | |
| `PredictionFile` | `PredictionFile` | sport, businessDate, source, path, fileRole | Export/import file metadata |
| `ResultFile` | `ResultFile` | sport, businessDate, source, path, fileRole | |

### 1.4 MLB-Specific Tables

These are MLB-only with `Mlb` prefixes (Prisma model name) mapped to shorter Postgres table names via `@@map`:

| Prisma Model | Postgres Table | Purpose |
|---|---|---|
| `MlbTeamStatSnapshot` | `TeamStatSnapshot` | Fetched team stats JSON payload |
| `MlbSlateGame` | `SlateGame` | Daily schedule / slate rows |
| `MlbMarketOddsSnapshot` | `MarketOddsSnapshot` | Live ESPN odds snapshots |
| `MlbSharpSignalRaw` | `SharpSignalRaw` | Raw sharp-signal provider payload |
| `MlbSharpSignalNormalized` | `SharpSignalNormalized` | Normalized sharp signals |
| `MlbPrediction` | `Prediction` | Per-game prediction output; FK → PredictionRun |
| `MlbGameResult` | `GameResult` | Ingested final scores |

### 1.5 Key Service Files

| File | Role |
|---|---|
| `server/db/client.ts` | Prisma singleton factory (returns null when DB disabled) |
| `server/db/repositories.ts` | All DB read/write helpers |
| `server/services/mlbAutomation.ts` | Pipeline orchestration — fetch → slate → predict → export → ingest results → evaluate |
| `server/services/csv.ts` | Prediction + results CSV builders |
| `server/services/oddsCapture.ts` | Playwright-based odds scraper |
| `server/services/oddsOverrides.ts` | Bulk override import/approve/reject |
| `server/services/sharpProvider.ts` | ESPN-derived sharp signal ingestion |
| `server/services/historicalImport.ts` | Historical TSV/CSV importer |

### 1.6 Automation

macOS **launchd** (not Airflow scheduler) runs the full pipeline daily at 9 AM Pacific via `airflow/run-pipeline.sh`. The CLI command sequence is:

```
fetch-team-stats → capture-odds-overrides → approve-odds-overrides
→ load-slate → run-predictions → export-predictions-csv
→ ingest-results → export-results-csv
```

---

## 2. Design Principles for Multi-Sport Expansion

1. **Shared tables stay shared** — `PredictionRun`, `EvaluationSummary`, `ModelVersion`, etc. are the single source of truth for pipeline runs regardless of sport. Never duplicate them.
2. **Sport-specific tables get a sport prefix** — new tables for NBA use an `Nba` Prisma model prefix. The `@@map` name may drop the prefix (e.g. `NbaSlateGame` → `@@map("NbaSlateGame")` so Postgres table names stay readable).
3. **Lookup key format is sport-specific** — MLB uses `AWAY@HOME_YYYY-MM-DD`. NBA/NHL can define their own format; just stay consistent within the sport.
4. **Services stay isolated** — each sport gets its own service directory (`server/services/nba/` or `server/services/nhl/`). The shared `repositories.ts` gains sport-scoped helper functions rather than becoming a monolith.
5. **CLI commands are sport-prefixed** — e.g. `nba:run-daily-pipeline`, `nba:load-slate`. This avoids flag proliferation and keeps scripts readable.
6. **Odds override table should be renamed** — the current Prisma model `MlbOddsOverride` maps to a generic `OddsOverride`-like pattern but still has `Mlb` in the model name. A clean migration renames it to `OddsOverride` with `sport` filtering, making it truly shared.

---

## 3. Adding NBA (Step-by-Step Blueprint)

### Step 0 — Prerequisites

- Confirm `prisma/schema.prisma` has `NBA` in the `Sport` enum (it already does).
- Identify the data sources: team stats API, schedule API, odds source, results source.
- Define the NBA lookup key format (e.g. `AWAY@HOME_YYYY-MM-DD` — same pattern is fine).

---

### Step 1 — Prisma Schema: Add NBA-Specific Tables

Add the following models to `prisma/schema.prisma`. Pattern mirrors the MLB models.

```prisma
model NbaTeamStatSnapshot {
  id           String   @id @default(cuid())
  businessDate DateTime
  sourceSeason Int
  fetchedAt    DateTime
  payload      Json
  createdAt    DateTime @default(now())

  @@unique([businessDate, sourceSeason])
  @@map("NbaTeamStatSnapshot")
}

model NbaSlateGame {
  id           String   @id @default(cuid())
  businessDate DateTime
  lookupKey    String
  awayTeam     String
  homeTeam     String
  gameTime     DateTime
  gameDateIso  String
  status       String   @default("scheduled")
  context      Json?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([businessDate, lookupKey])
  @@map("NbaSlateGame")
}

model NbaMarketOddsSnapshot {
  id           String   @id @default(cuid())
  businessDate DateTime
  lookupKey    String
  source       String
  odds         Json
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([businessDate, lookupKey, source])
  @@map("NbaMarketOddsSnapshot")
}

model NbaPrediction {
  id            String        @id @default(cuid())
  predictionRun PredictionRun @relation(fields: [predictionRunId], references: [id])
  predictionRunId String
  businessDate  DateTime
  lookupKey     String
  awayTeam      String
  homeTeam      String
  payload       Json
  createdAt     DateTime      @default(now())

  @@unique([predictionRunId, lookupKey])
  @@map("NbaPrediction")
}

model NbaGameResult {
  id           String   @id @default(cuid())
  businessDate DateTime
  lookupKey    String
  awayTeam     String
  homeTeam     String
  awayScore    Int?
  homeScore    Int?
  payload      Json?
  createdAt    DateTime @default(now())

  @@unique([businessDate, lookupKey])
  @@map("NbaGameResult")
}
```

Also update `PredictionRun` to add the relation back-reference (if not already done generically):

```prisma
// In model PredictionRun, add:
nbaPredictions NbaPrediction[]
```

Run the migration:

```bash
npm run prisma:migrate:dev --name add_nba_tables
```

---

### Step 2 — Repository Layer

In `server/db/repositories.ts`, add NBA-scoped functions following the exact pattern of the existing MLB functions. Group them clearly:

```ts
// ─── NBA Repositories ─────────────────────────────────────────────

export async function saveNbaTeamStatSnapshot(...) { ... }
export async function saveNbaSlateRows(...) { ... }
export async function saveNbaMarketOddsSnapshot(...) { ... }
export async function saveNbaPredictions(...) { ... }
export async function saveNbaResults(...) { ... }
export async function getNbaPredictionsByRunOrDate(...) { ... }
export async function getNbaResultsByDate(...) { ... }
```

Keep function signatures parallel to their MLB counterparts so callers are easy to read side by side.

---

### Step 3 — Prediction Model

Create `src/lib/nbaModel.ts` (or `src/lib/nba/nbaModel.ts`). It should export:

```ts
export interface NbaGameInput { ... }
export interface NbaGamePrediction { ... }
export function predictNbaGame(input: NbaGameInput): NbaGamePrediction { ... }
```

The model internals are sport-specific (team ratings, pace, offensive/defensive efficiency, etc.) but the entry-point shape mirrors `mlbModel.ts`.

---

### Step 4 — Services Layer

Create `server/services/nba/` directory with:

| File | Mirrors | Purpose |
|---|---|---|
| `nbaAutomation.ts` | `mlbAutomation.ts` | Pipeline orchestration for NBA |
| `nbaSlate.ts` | (inline in mlbAutomation) | Fetches NBA schedule for a date |
| `nbaCsv.ts` | `csv.ts` | NBA prediction + results CSV builders |
| `nbaOddsCapture.ts` | `oddsCapture.ts` | Playwright scraper configured for NBA odds source |

`nbaAutomation.ts` exports the same surface as the MLB version:

```ts
export async function runNbaDailyPipeline(date: string, opts: NbaPipelineOptions): Promise<void>
export async function ingestNbaResults(date: string): Promise<void>
export async function exportNbaPredictionsCsv(date: string): Promise<string>
export async function exportNbaResultsCsv(date: string): Promise<string>
export async function evaluateNba(from: string, to: string): Promise<void>
```

Each function creates a `PredictionRun` with `sport: Sport.NBA` before writing sport-specific records.

---

### Step 5 — CLI Commands

In `cli.ts`, add a new command group. Prefix all commands with `nba:` to avoid collisions:

```
nba:fetch-team-stats     --date YYYY-MM-DD
nba:load-slate           --date YYYY-MM-DD
nba:run-predictions      --date YYYY-MM-DD
nba:export-predictions-csv --date YYYY-MM-DD
nba:ingest-results       --date YYYY-MM-DD
nba:export-results-csv   --date YYYY-MM-DD
nba:run-daily-pipeline   --date YYYY-MM-DD
nba:evaluate             --from YYYY-MM-DD --to YYYY-MM-DD
```

Wire each to the corresponding function in `nbaAutomation.ts`.

---

### Step 6 — API Endpoints

In `api.ts`, add an `/api/nba/` prefix group mirroring the existing `/api/automation/` routes:

```
GET  /api/nba/runs/latest
GET  /api/nba/predictions?date=YYYY-MM-DD
GET  /api/nba/results?date=YYYY-MM-DD
GET  /api/nba/evaluation
GET  /api/nba/odds-overrides?date=YYYY-MM-DD
POST /api/nba/odds-overrides/approve
POST /api/nba/odds-overrides/reject
POST /api/nba/capture-odds-overrides
POST /api/nba/run-daily-pipeline
```

---

### Step 7 — launchd Automation

Create a second plist for the NBA pipeline:

```
airflow/com.mlb-predictor.nba-daily-pipeline.plist
```

Configure its `ProgramArguments` to call a new shell script:

```
airflow/run-nba-pipeline.sh
```

The script mirrors `run-pipeline.sh` but calls `nba:run-daily-pipeline`. Set the `StartCalendarInterval` to the desired run time (NBA games tip off evenings, so a morning pull + a pre-game update may be needed).

---

### Step 8 — Odds Overrides (Shared Table)

The current `MlbOddsOverride` model is already sport-aware. To make the shared odds override pipeline work for NBA:

1. In `server/services/oddsOverrides.ts`, all existing functions accept a `sport` parameter (or default to `Sport.MLB`). Verify this; if not, add the parameter.
2. The CLI command `nba:import-odds-overrides` passes `sport: Sport.NBA` when calling the shared service.
3. The `MlbOddsOverride` Prisma model should be renamed to `OddsOverride` in both the model name and `@@map`. This is a single migration + find-replace in the codebase.

---

### Step 9 — Environment Variables

Add NBA-specific env vars to `.env.example` and `server/config.ts`:

```
NBA_ODDS_CAPTURE_LOGIN_URL=
NBA_ODDS_CAPTURE_PAGE_URL=
NBA_ODDS_CAPTURE_USERNAME=
NBA_ODDS_CAPTURE_PASSWORD=
# ... (same pattern as MLB ODDS_CAPTURE_* vars)
NBA_EXPORT_DIR=./generated/nba
```

Keep them namespaced so there's no ambiguity.

---

## 4. Technical Debt to Address Before Expanding

These items will become friction when adding a second sport. Address them first (or in parallel) to keep the expansion clean:

| Item | Current State | Recommended Fix |
|---|---|---|
| `MlbOddsOverride` model name | Uses `Mlb` prefix but is actually a shared table | Rename to `OddsOverride` in Prisma + migration |
| `@@map` names on MLB tables | `MlbSlateGame` → `SlateGame`, `MlbPrediction` → `Prediction` | These Postgres table names are now ambiguous; rename to `MlbSlateGame`, `MlbPrediction`, etc. to make room for `NbaSlateGame`, `NbaPrediction` |
| `repositories.ts` is sport-implicit | MLB functions don't take a sport param — they just write MLB tables | No change needed structurally; NBA adds its own functions. But shared functions (OddsOverride, PredictionRun) should accept sport as a required arg, not optional |
| CLI has no sport flag / namespace | All commands are MLB-only but have no prefix | MLB commands can stay as-is; new sports get the `nba:` / `nhl:` prefix treatment |
| `PredictionRun.mlbPredictions` relation | The relation accessor is named `mlbPredictions` | After adding `nbaPredictions`, rename `mlbPredictions` → generic approach: keep each named by sport for clarity |

---

## 5. Adding NHL After NBA

Follow the exact same steps in §3, substituting:

- `Nba` → `Nhl` in all model names
- `nba:` → `nhl:` in all CLI commands
- `/api/nba/` → `/api/nhl/` in all API routes
- `NBA_ODDS_CAPTURE_*` → `NHL_ODDS_CAPTURE_*` in env vars
- A new plist for the NHL pipeline

The pattern is deliberately repetitive so each sport's pipeline is independently readable and deployable.

---

## 6. Shared Infrastructure That Does NOT Need Duplication

The following already work for any sport without modification:

- `server/db/client.ts` — Prisma client singleton is sport-agnostic
- `PredictionRun` table — always the root record, keyed by `sport + businessDate`
- `ModelVersion`, `EvaluationSummary`, `CalibrationRun` — sport-filtered queries work today
- `PredictionFile`, `ResultFile` — file metadata already sport-tagged
- `EvaluationSummary` — model evaluation rollup works for any sport
- `server/config.ts` — add new env var blocks, no structural changes needed
- Prisma migration system — each sport adds its own migration, migrations are additive

---

## 7. Checklist for a New Sport Implementation

Use this as the acceptance checklist when handing this off:

- [ ] `Sport` enum contains the new sport value (already done)
- [ ] Prisma models added: `{Sport}TeamStatSnapshot`, `{Sport}SlateGame`, `{Sport}MarketOddsSnapshot`, `{Sport}Prediction`, `{Sport}GameResult`
- [ ] `PredictionRun` updated with new `{sport}Predictions` relation
- [ ] Migration created and applied to dev database
- [ ] Repository functions added in `server/db/repositories.ts`
- [ ] Prediction model created at `src/lib/{sport}Model.ts`
- [ ] Services created at `server/services/{sport}/`
- [ ] CLI commands registered with `{sport}:` prefix
- [ ] API routes registered under `/api/{sport}/`
- [ ] `.env.example` and `server/config.ts` updated with `{SPORT}_*` vars
- [ ] launchd plist + run script created for daily automation
- [ ] `CLAUDE.md` updated with new CLI commands and env vars
- [ ] Unit tests for the new prediction model
- [ ] E2E test for the daily pipeline CLI command (sandbox DB)
