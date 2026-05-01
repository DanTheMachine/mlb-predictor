# Odds Capture Plan — Multi-Sport (NBA / NHL)

This document is a self-contained reference for building a Playwright-based odds capture and override system for any new sport (NBA, NHL, etc.). It is derived from the working MLB implementation in this repo. A Claude instance in another repo can follow this plan verbatim.

---

## What this system does

1. **Playwright scraper** logs into a sportsbook, navigates to the target sport page, grabs the raw odds text, and saves it to the DB as *staged* overrides.
2. **Approval step** promotes staged overrides to *active* so the prediction pipeline can consume them.
3. **Manual fallback** allows the same import via a pasted text file (no browser required).
4. **Debug artifacts** are written on every run — raw text, parsed JSON, screenshot on failure — to a sport-scoped subdirectory under `EXPORT_DIR`.

The scraper is fully config-driven; no sportsbook credentials or selectors are hardcoded. All browser behavior is controlled by `ODDS_CAPTURE_*` env vars (see section below).

---

## Core concepts to carry over

### Lookup key format

Every override row is keyed by:

```
YYYYMMDD + HOME_ABBR + AWAY_ABBR          → e.g. 20261030BOS LAL
YYYYMMDD + HOME_ABBR + AWAY_ABBR + _2     → doubleheader / back-to-back game 2 (if applicable)
```

The lookup key must match the format used by the slate/prediction layer of the consuming app so the override can be joined at query time.

### Two-step flow: staged → approved

All imports land in `status = 'staged'`. Nothing is consumed until `approve-odds-overrides` is run. This lets you inspect the capture before it affects predictions. The `source` label (e.g. `betlotus-nba`) travels through both steps and can be used to filter approvals.

### Override priority

When building a game row for prediction, odds are resolved in this order:
1. Live API odds (ESPN or equivalent)
2. Approved manual override (from this system)
3. Model-derived default

The odds override layer only overrides when `status = 'approved'` for the matching `(sport, businessDate, lookupKey)`.

### Parser contract

The scraper calls `parseBulkOdds(rawText)` after capture. The parser returns an array of `ParsedBulkGame`:

```ts
type ParsedBulkGame = {
  awayAbbr: string          // short team abbreviation
  homeAbbr: string
  odds: OddsInput           // moneyline, spread, total, over/under odds
  awayStarter?: string      // NBA/NHL: not applicable, omit
  homeStarter?: string
  gameTime?: string         // extracted from header line, e.g. "7:30 PM"
}

type OddsInput = {
  source: string
  awayMoneyline: number     // American odds, e.g. +120 or -110
  homeMoneyline: number
  runLine: number           // spread (use puckLine for NHL, spread for NBA)
  runLineAwayOdds: number   // odds on the away spread
  runLineHomeOdds: number   // odds on the home spread
  overUnder: number         // total points/goals
  overOdds: number
  underOdds: number
}
```

The field called `runLine` in the MLB model is the spread concept. For NBA/NHL rename it semantically in your types (e.g. `spread` / `puckLine`) but keep the same JSON shape so the override table and parser stay sport-agnostic.

---

## Files to create

### 1. `server/services/oddsCapture.ts` — Playwright scraper

Copy from the MLB repo verbatim. The only MLB-specific artifact is `waitForPostLoginTransition`, which checks for betlotus-specific URL patterns. Replace that function's URL strings with the equivalent patterns for your sportsbook, or make it a no-op that always returns `true` if the sportsbook doesn't require special post-login detection.

Also replace `getNavFallbackSelectors`: the MLB version has hardcoded XPath fallbacks for betlotus's MLB nav. For NBA/NHL, either remove the fallback list or add sport-specific selectors you discover during sportsbook inspection.

Everything else — login flow, modal handling, content extraction, debug artifacts — is generic and carries over unchanged.

**Key function signatures (do not change):**

```ts
export async function captureOddsOverrides(args?: { date?: string; source?: string }): Promise<CaptureResult>
```

### 2. `server/services/oddsOverrides.ts` — Import / list / approve / reject

Copy verbatim. The only change needed is the import of the sport-specific types. If your app has a unified `OddsInput` type shared across sports, no change is needed at all.

**Key function signatures:**

```ts
export async function importBulkOddsOverrides(args: { date: string; raw: string; source?: string; metadata?: Record<string, unknown> }): Promise<ImportResult>
export async function importBulkOddsOverridesFromFile(args: { date?: string; file: string; source?: string }): Promise<ImportResult>
export async function listOddsOverrides(dateInput?: string): Promise<PersistedOddsOverride[]>
export async function approveOddsOverrides(args: { date?: string; source?: string; lookupKeys?: string[] }): Promise<StatusResult>
export async function rejectOddsOverrides(args: { date?: string; source?: string; lookupKeys?: string[] }): Promise<StatusResult>
```

### 3. `src/lib/bulkOddsParser.ts` — Raw text → structured odds

This is the most sport-specific piece. It needs a team name map for your sport. The parser architecture (line-block mode vs. inline regex mode) is generic and carries over unchanged.

**Steps to adapt:**

1. Replace `BULK_NAME_MAP` with your sport's teams. Key = any name the sportsbook prints (full name, city, nickname, short forms), value = your canonical abbreviation. Sort longer strings first in the regex (the existing code does this automatically via `.sort((l, r) => r.length - l.length)`).

2. For NBA/NHL there are no starting pitchers. Remove `STARTER_HEADER_REGEX` from `parseLineBlocks` (or leave it — it simply won't match).

3. The `GAME_TIME_REGEX` extracts a 12-hour time from header lines. This works for any sport's sportsbook format and should be kept as-is.

4. Default odds fallback values in `buildParsedGame` are currently MLB-calibrated (`runLine: -1.5`, `overUnder: 8`). Update to sport-appropriate defaults:
   - NBA: `spread: -5.5`, `overUnder: 220`
   - NHL: `puckLine: -1.5`, `overUnder: 5.5`

5. The error message `'Could not find recognizable MLB team names...'` should be updated to name your sport.

**Example NBA team name map (partial):**

```ts
const BULK_NAME_MAP: Record<string, string> = {
  'BOSTON CELTICS': 'BOS',
  BOSTON: 'BOS',
  'LOS ANGELES LAKERS': 'LAL',
  'LA LAKERS': 'LAL',
  LAKERS: 'LAL',
  'LOS ANGELES CLIPPERS': 'LAC',
  'LA CLIPPERS': 'LAC',
  CLIPPERS: 'LAC',
  'GOLDEN STATE WARRIORS': 'GSW',
  'GOLDEN STATE': 'GSW',
  WARRIORS: 'GSW',
  // ... all 30 NBA teams
}
```

**Example NHL team name map (partial):**

```ts
const BULK_NAME_MAP: Record<string, string> = {
  'BOSTON BRUINS': 'BOS',
  BOSTON: 'BOS',
  'TORONTO MAPLE LEAFS': 'TOR',
  TORONTO: 'TOR',
  'NEW YORK RANGERS': 'NYR',
  RANGERS: 'NYR',
  'NEW YORK ISLANDERS': 'NYI',
  ISLANDERS: 'NYI',
  // ... all 32 NHL teams
}
```

### 4. DB schema — `OddsOverride` table

The MLB repo uses a single `MlbOddsOverride` model with a `sport Sport` column. This is already multi-sport in the MLB schema — the table is `@@map("OddsOverride")` and has `sport Sport @default(MLB)`. If your new repo shares this DB, you just write rows with `sport = NBA` or `sport = NHL` and the existing table handles it. If it's a separate DB, define:

```prisma
enum Sport {
  MLB
  NBA
  NHL
  NCAAM
  NFL
  NCAAF
}

model OddsOverride {
  id           String   @id @default(cuid())
  sport        Sport
  businessDate DateTime
  lookupKey    String
  awayTeam     String
  homeTeam     String
  awayStarter  String?
  homeStarter  String?
  source       String
  status       String   @default("staged")
  odds         Json
  metadata     Json?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([sport, businessDate, lookupKey, source])
  @@index([sport, businessDate, status])
  @@map("OddsOverride")
}
```

The `odds` column is `Json` — it stores the `OddsInput` struct. This is intentionally sport-agnostic; the JSON shape can differ between sports without a schema migration.

### 5. DB repository layer — `server/db/repositories.ts`

Three functions are needed. Copy from the MLB repo and add a `sport` parameter:

```ts
// Save (upsert) staged override rows
export async function saveOddsOverrides(
  date: string,
  sport: Sport,
  rows: OddsOverrideRow[],
): Promise<void>

// List all overrides for a date + sport
export async function listOddsOverridesByDate(
  date: string,
  sport: Sport,
): Promise<OddsOverride[]>

// Bulk status update (approve or reject)
export async function updateOddsOverrideStatus(args: {
  date: string
  sport: Sport
  source?: string
  lookupKeys?: string[]
  status: 'approved' | 'rejected'
}): Promise<{ count: number }>
```

The upsert key in `saveOddsOverrides` must include `sport` to avoid cross-sport collisions:

```ts
prisma.oddsOverride.upsert({
  where: {
    sport_businessDate_lookupKey_source: { sport, businessDate, lookupKey, source }
  },
  ...
})
```

### 6. `server/config.ts` — Env var parsing

Copy the `ODDS_CAPTURE_*` block verbatim. No sport-specific changes are needed — the config is fully generic. Key vars:

```
ODDS_CAPTURE_LOGIN_URL          required  — sportsbook login page
ODDS_CAPTURE_PAGE_URL           optional  — if different from login page, navigate here after login
ODDS_CAPTURE_USERNAME           required
ODDS_CAPTURE_PASSWORD           required
ODDS_CAPTURE_USERNAME_SELECTOR  required  — CSS or XPath selector for username field
ODDS_CAPTURE_PASSWORD_SELECTOR  required  — CSS or XPath selector for password field
ODDS_CAPTURE_SUBMIT_SELECTOR    required  — CSS or XPath selector for login button
ODDS_CAPTURE_CONTENT_SELECTOR   required  — CSS or XPath selector wrapping all game odds text
ODDS_CAPTURE_MODAL_CLOSE_SELECTOR optional — selector for any post-login modal dismiss button
ODDS_CAPTURE_NAV_SELECTORS      optional  — pipe-separated (||) list of selectors to click to reach the sport page
ODDS_CAPTURE_SUCCESS_SELECTOR   optional  — element that confirms successful login
ODDS_CAPTURE_LOGIN_FRAME_SELECTOR optional — if login form is in an iframe
ODDS_CAPTURE_POST_LOGIN_SCRIPT  optional  — inline JS to eval after login (leave blank unless needed)
ODDS_CAPTURE_HEADLESS           default true
ODDS_CAPTURE_TIMEOUT_MS         default 45000
ODDS_CAPTURE_STEP_DELAY_MS      default 1000
ODDS_CAPTURE_TYPE_DELAY_MS      default 75
ODDS_CAPTURE_BROWSER_CHANNEL    optional  — e.g. "chrome" to use installed Chrome instead of bundled Chromium
ODDS_CAPTURE_USER_AGENT         optional  — spoofed UA string
ODDS_CAPTURE_PROVIDER           optional  — label stored on imported rows, e.g. "betlotus-nba"
```

**Nav selectors** (`ODDS_CAPTURE_NAV_SELECTORS`) are a `||`-delimited list of selectors clicked in order. For betlotus NBA this might be a single XPath for the NBA nav link. Inspect the sportsbook DOM to find the right selector.

### 7. CLI commands — `cli.ts`

Add these commands (sport-prefixed or use a `--sport` flag):

```
capture-odds-overrides --date YYYY-MM-DD [--source LABEL]
import-odds-overrides  --date YYYY-MM-DD --file PATH [--source LABEL]
list-odds-overrides    --date YYYY-MM-DD
approve-odds-overrides --date YYYY-MM-DD [--source LABEL] [--lookupKeys KEY1,KEY2]
reject-odds-overrides  --date YYYY-MM-DD [--source LABEL] [--lookupKeys KEY1,KEY2]
```

If the app is single-sport, these map directly. If multi-sport in one CLI, add `--sport nba|nhl` and thread it through to the service layer.

---

## Sportsbook DOM inspection checklist

Before wiring up the env vars, open the sportsbook in a browser with DevTools and record:

| Env var | How to find it |
|---|---|
| `ODDS_CAPTURE_USERNAME_SELECTOR` | Inspect username input → copy selector or XPath |
| `ODDS_CAPTURE_PASSWORD_SELECTOR` | Same for password input |
| `ODDS_CAPTURE_SUBMIT_SELECTOR` | Inspect login button |
| `ODDS_CAPTURE_CONTENT_SELECTOR` | After navigating to the NBA/NHL odds page, find the outermost element that contains all game rows. `innerText` of this element must include the team names and odds. |
| `ODDS_CAPTURE_NAV_SELECTORS` | The link(s) you click to get from the post-login home to the NBA/NHL game odds page. Could be one click or a chain (e.g. sport category → games sub-tab). |
| `ODDS_CAPTURE_MODAL_CLOSE_SELECTOR` | Any modal that pops up after login. Inspect the close button. |

**Content selector tip:** Use the browser console to test: `document.querySelector('YOUR_SELECTOR').innerText` — verify it returns all the game odds rows you expect before committing the selector.

---

## How the parser handles betlotus-style text

The raw text from betlotus (and similar sportsbooks) comes in one of two formats:

**Format A — one team per line (line-block mode):**
```
Lance McCullers Jr./Brandon Young: MASN | SCHN1:05 PM
HOUSTON ASTROS
-1.5
-115
O 8
-110
+105
BALTIMORE ORIOLES
+1.5
-105
U 8
-110
-125
```

The parser detects this when it finds full team names as their own lines. It reads the 5 lines after each team name as the odds block (spread, spread odds, total, over/under odds, moneyline).

**Format B — teams inline with odds on same line (inline regex mode):**
```
GOLDEN STATE WARRIORS -5.5 -110 O 224 -110 -120 LOS ANGELES LAKERS +5.5 -110 U 224 -110 +100
```

The parser falls back to this when line-block mode doesn't match.

Both modes extract the same `OddsInput` fields. The order of tokens in the block is:

```
[0] spread (e.g. -1.5 / +1.5)
[1] spread odds (e.g. -115 / -105)
[2] total (e.g. O 8 / U 224)
[3] over or under odds
[4] moneyline
```

Line numbers that look like rotation numbers (3–4 digit integers) are skipped automatically.

---

## Daily pipeline integration

In the daily pipeline (equivalent of `run-daily-pipeline`), insert these two steps before predictions are generated:

1. `capture-odds-overrides --date DATE --source YOUR_LABEL`
2. `approve-odds-overrides --date DATE --source YOUR_LABEL`

Then in the prediction/slate-building step, pass `useOddsOverrides: true` and `overrideSource: YOUR_LABEL` so the pipeline knows to merge in the approved overrides.

---

## Applying overrides to a game row

In the prediction pipeline, when building the odds for a game, check for an approved override:

```ts
// Pseudocode — adapt to your types
const override = approvedOverrides.find(o => o.lookupKey === game.lookupKey)
const odds = override ? override.odds : liveApiOdds ?? modelDefaultOdds
```

For doubleheaders / back-to-backs (same home+away pair twice on one date), the second game's override uses a `_2` suffix on the lookup key. The import layer handles this automatically — `importBulkOddsOverrides` counts duplicate matchup keys and appends `_2`, `_3`, etc.

---

## Debug artifacts

Every capture run writes to `{EXPORT_DIR}/odds-capture-debug/`:

- `YYYY-MM-DD-{timestamp}-raw.txt` — raw text scraped from the content selector
- `YYYY-MM-DD-{timestamp}-parsed.json` — output of `parseBulkOdds`
- `YYYY-MM-DD-{timestamp}-meta.txt` — URL, capture time, counts
- On failure: `.html` (page source), `.png` (full-page screenshot), `.txt` (error + frame URLs)

These are invaluable for diagnosing selector drift (sportsbook updates their DOM) and parser failures (new text format).

---

## Known gotchas from the MLB implementation

1. **`ODDS_CAPTURE_POST_LOGIN_SCRIPT` — leave blank.** Setting this caused the scraper to evaluate JS before the page had navigated to the right sport, resulting in scraping the wrong page. Only set it if you have a confirmed need and have verified the page state at the time of eval.

2. **`waitForPostLoginTransition`** in `oddsCapture.ts` — the MLB version checks for betlotus-specific URL fragments to detect whether the login actually completed. If your sportsbook has a different URL pattern, update these strings or replace with a check for `ODDS_CAPTURE_SUCCESS_SELECTOR` being present.

3. **Modal interference** — betlotus shows an account balance modal after login. The scraper calls `closeModalIfPresent` before each nav click. The generic bootstrap modal detection (`.bootbox.modal.in`) works for betlotus. If your sportsbook uses a different modal pattern, update the selector list inside `closeModalIfPresent`.

4. **Nav selector visibility** — `findNavLocator` uses a short timeout (1.5s) with `isVisible` check before falling back to a force-click. If the nav link is present in the DOM but off-screen (e.g. in a collapsed sidebar), the force-click path will be taken. This is intentional.

5. **Selector XPath vs CSS** — selectors starting with `//` or `(` are automatically prefixed with `xpath=` by `findLocator`. Everything else is treated as a CSS selector. Both formats work in the env vars.

6. **Betlotus MLB nav fallbacks** — `getNavFallbackSelectors` has hardcoded XPath fallbacks for three known betlotus MLB nav layouts. For NBA/NHL, add equivalent fallbacks or remove the function and let the primary selector handle it.
