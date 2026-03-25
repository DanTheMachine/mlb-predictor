# MLB Predictor Build Plan

## Goal
Build a new `mlb_predictor` app in the same overall stack and workflow family as the existing predictors:

- React
- TypeScript
- Vite
- Vitest
- Playwright
- ESLint

The MLB app should feel familiar next to the NBA, NHL, and NCAAM tools, but the prediction engine, data model, and intelligence features should be baseball-specific rather than copied from basketball logic.

## Product Direction
The MLB predictor should support two related use cases:

1. Single-game simulation and wagering analysis
2. Daily schedule intelligence with per-game cards, model recommendations, and post-bet evaluation

The best baseline to follow is the NBA app's structure and workflow, with MLB-specific modeling similar in spirit to how NHL and NCAAM adapted the shared pattern to their sports.

## Core MLB Differences From NBA/NCAAM
Baseball should not be modeled around pace, possession, or efficiency margin the way basketball is. The MLB model should instead center on run creation, run prevention, bullpen context, and starting pitching.

Most important MLB factors to include:

- starting pitcher quality
- projected innings from the starter
- bullpen quality and recent bullpen workload
- offense split strength versus pitcher handedness
- team strikeout and walk profile
- power and extra-base-hit profile
- contact quality proxies
- defensive efficiency or run-prevention support
- park factors
- weather effects when available
- lineup strength and confirmed lineup status
- travel/rest context

## Recommended App Shape
Use the NBA predictor as the main structure reference.

Recommended top-level app areas:

- `Single Game Tools`
- `Daily Schedule`
- `Model Evaluation`
- `Results Tracker`
- optional later: `Stat Import / Data Refresh`

Recommended `src` layout:

- `src/App.tsx`
- `src/main.tsx`
- `src/index.css`
- `src/App.css`
- `src/MLBPredictor.tsx`
- `src/lib/mlbTypes.ts`
- `src/lib/mlbModel.ts`
- `src/lib/betting.ts`
- `src/lib/mlbApi.ts`
- `src/lib/bulkOddsParser.ts`
- `src/lib/modelEvaluation.ts`
- `src/lib/resultsTracker.ts`
- `src/hooks/usePredictorState.ts`
- `src/hooks/useResultsTracker.ts`
- `src/components/SingleGameControls.tsx`
- `src/components/SingleGameResults.tsx`
- `src/components/ScheduleAnalysis.tsx`
- `src/components/ModelEvaluation.tsx`
- `src/components/ResultsTracker.tsx`
- `src/components/TeamCard.tsx`
- `src/test/setup.ts`

## Phase 1 Scope
Phase 1 should produce a usable MLB predictor without overreaching.

### Phase 1 user-facing goals
- simulate one MLB game from team and pitcher inputs
- project runs for both teams
- project game total
- estimate Money Line win probabilities
- estimate run line cover probabilities
- estimate over/under probabilities
- compare model outputs to sportsbook odds
- export predictions for later grading
- grade exported predictions against game results

### Phase 1 modeling goals
- baseline team offense and defense tables
- baseline starting pitcher table
- baseline bullpen table
- offense splits versus left-handed and right-handed starters
- park factor adjustment
- starter-to-bullpen run allocation
- simple rest/workload adjustments

### Phase 1 non-goals
- pitch-by-pitch simulation
- player-level WAR-based roster model
- automated lineup scraping from many providers
- same-game parlay logic
- prop betting
- advanced live in-game modeling

## MLB Domain Model
The app should define explicit baseball types early so the UI and model can grow cleanly.

Recommended core types:

- `TeamAbbr`
- `GameType`
  - `Regular Season`
  - `Postseason`
- `Handedness`
  - `L`
  - `R`
- `TeamStats`
- `StarterStats`
- `BullpenStats`
- `LineupSummary`
- `WeatherContext`
- `ParkFactor`
- `OddsInput`
- `PredictionResult`
- `BettingAnalysis`
- `ScheduleRow`
- `InjuryInfo`
- `RecentFormSummary`
- `SharpSignalInput`
- `SharpMarketContext`
- `CompositeRecommendation`

Recommended `TeamStats` fields:

- team name, colors, league/division
- runs scored per game
- runs allowed per game
- team OPS or wRC+-style offense proxy
- isolated power or slugging proxy
- walk rate
- strikeout rate
- stolen-base pressure or baserunning value proxy
- defensive efficiency proxy
- offense split vs LHP
- offense split vs RHP
- bullpen ERA/FIP-style proxy
- bullpen strikeout and walk profile
- home park identifier

Recommended `StarterStats` fields:

- pitcher name
- team
- handedness
- ERA
- FIP or xFIP proxy
- WHIP
- strikeout rate
- walk rate
- HR/9 or hard-contact proxy
- average innings per start
- projected pitch count bucket
- recent form indicator

## Prediction Engine Design
The first MLB engine should be transparent and hand-built like the other apps.

### 1. Inputs
For each matchup, the engine should start with:

- home team baseline
- away team baseline
- home starting pitcher
- away starting pitcher
- handedness-aware offense splits
- bullpen ratings
- park factor
- weather context
- game odds

### 2. Offensive expectation
Each team's run expectation should blend:

- that offense's split-adjusted run creation level
- opposing starter run prevention
- opposing bullpen run prevention
- park factor
- weather factor
- lineup confirmation/confidence

### 3. Starter vs bullpen allocation
Unlike the basketball apps, MLB needs time-segment logic.

Recommended approach:

- estimate starter innings from pitcher baseline
- adjust expected starter innings for efficiency/workload
- allocate remaining innings to bullpen
- compute separate expected runs versus starter and bullpen
- sum them into full-game projected runs

### 4. Run environment adjustments
Recommended additive or multiplicative adjustments:

- hitter-friendly or pitcher-friendly park
- wind in/out
- temperature
- travel disadvantage
- bullpen fatigue
- lineup missing key hitters
- catcher/rest day or defensive downgrade later if supported

### 5. Win probability
Convert projected run differential into win probability with an MLB-specific variance assumption.

Good initial direction:

- derive projected margin from home runs minus away runs
- use a calibrated normal or logistic transformation
- bound probabilities to avoid unrealistic extremes

### 6. Run line probability
Estimate probability of covering `-1.5` or `+1.5` using projected run differential and an MLB run-margin standard deviation.

### 7. Total probability
Estimate over/under probability from projected total and a total-runs standard deviation.

### 8. Betting analysis
Reuse the same shared concepts from the other apps:

- American odds to implied probability
- vig removal
- model edge versus market
- threshold-based recommendations
- optional fractional Kelly sizing

## Recommended Initial MLB Factors And Weights
These are planning targets, not final numeric commitments.

Highest-priority v1 factors:

- starter quality
- offense split vs pitcher handedness
- bullpen quality
- park factor
- lineup confirmation status

Medium-priority v1.5 factors:

- bullpen fatigue from prior 2 to 3 days
- weather
- defensive support
- stolen-base / catcher control pressure
- recent team form

Later factors:

- umpire run environment
- catcher framing
- platoon-heavy lineup composition
- player-level injury impact scoring
- market-closing-line calibration features

## Data Strategy
Start with a reliable hybrid approach rather than waiting for perfect automation.

### Phase 1 data sources
- hardcoded baseline team table
- hardcoded baseline starting pitcher table
- manual pitcher override input
- manual lineup-quality adjustment
- ESPN or scoreboard-style schedule and odds feed if practical
- manual odds entry fallback
- bulk odds paste parser

### Phase 2 data expansion
- API-based daily probable starters
- lineup confirmation fetch
- bullpen workload snapshot
- weather fetch
- injuries / player status feed

## UI Plan
The UI should look and feel consistent with the other predictors, especially NBA.

### Single-game panel
Controls should include:

- away team
- home team
- away starter
- home starter
- pitcher handedness display
- game type
- park
- weather toggle or inputs
- bullpen fatigue toggle or numeric adjustment
- lineup confidence toggle
- odds fetch and manual odds inputs

Results should display:

- projected runs
- projected total
- Money Line probabilities
- run line recommendation
- total recommendation
- feature explanations
- starter edge summary
- bullpen edge summary
- park/weather context

### Daily schedule panel
This should follow the NBA intelligence-card pattern.

Each game card should show:

- matchup and start time
- probable starters
- projected score and total
- market lines
- model-vs-market edges
- lineup/injury notes
- recent form
- bullpen workload
- weather and park notes
- composite recommendation area

## Model Evaluation Plan
Keep this very close to the NBA workflow.

The app should:

- export predictions CSV
- import results CSV
- match by lookup key
- grade Money Line plays
- grade run line plays
- grade totals
- compute win/loss/push
- compute ROI using exported prices

Recommended export fields:

- date
- away team
- home team
- away starter
- home starter
- projected away runs
- projected home runs
- projected total
- projected margin
- home win probability
- away win probability
- Money Line recommendation
- run line recommendation
- total recommendation
- market odds fields
- edge fields
- Kelly fields if enabled
- park
- weather summary
- lineup confidence
- lookup key

## Testing Plan
The MLB app should launch with tests from the start rather than adding them later.

Recommended coverage:

- `mlbModel.test.ts`
  - projection math
  - handedness split logic
  - starter/bullpen allocation
  - park and weather adjustments
- `betting.test.ts`
  - vig removal
  - Money Line edge selection
  - run line logic
  - total logic
- `bulkOddsParser.test.ts`
  - sportsbook paste parsing
  - alias handling
- `usePredictorState.test.ts`
  - schedule load behavior
  - manual odds application
  - state reset behavior
- `SingleGameResults.test.tsx`
  - recommendation rendering
  - feature explanation rendering
- `ModelEvaluation.test.tsx`
  - grading summaries

## Suggested Rollout Phases
### Phase 0: Scaffold
- initialize the Vite React TypeScript app in `mlb_predictor`
- align scripts with NBA where practical
- add lint, test, and e2e structure
- create core folders and empty modules

### Phase 1: Single-game engine
- create MLB domain types
- add baseline teams, starters, and bullpens
- implement `predictGame(...)`
- implement single-game UI
- add manual odds entry and recommendations

### Phase 2: Daily schedule workflow
- add schedule loading
- add probable starter resolution
- add bulk odds import
- add schedule table/cards
- add CSV export

### Phase 3: Evaluation and tracking
- add results import
- add grading logic
- add ROI summaries
- add results tracker

### Phase 4: Intelligence layer
- add lineup status
- add injuries
- add bullpen workload
- add weather
- add sharp-market inputs
- add composite recommendation scoring

### Phase 5: Calibration
- compare projections with actual results
- tune run variance assumptions
- tune recommendation thresholds
- evaluate performance by market and confidence tier

## Recommended First Build Order
If we want the safest path, we should build in this order:

1. App scaffold and MLB types
2. Baseline team and pitcher data
3. Core projection engine
4. Betting math
5. Single-game UI
6. Tests around the engine
7. Daily schedule cards
8. Export/evaluation
9. Intelligence overlays

## Decisions To Preserve From Existing Apps
These patterns are worth carrying over:

- hand-built transparent model instead of opaque black-box v1
- manual override paths whenever live data is missing
- sportsbook normalization and de-vig workflow
- export-first evaluation loop
- modular `lib`, `hooks`, and `components` split
- schedule-level workflow plus single-game workflow

## MLB-Specific Risks
The biggest implementation risks are:

- probable starters change frequently
- lineups are often unconfirmed until close to game time
- bullpen availability matters a lot and can go stale quickly
- weather can materially shift totals
- baseball variance is high, so thresholds should be conservative

## Success Criteria
The first MLB release is successful if it:

- feels consistent with the existing predictor family
- uses baseball-native factors instead of recycled basketball logic
- supports both single-game and daily slate analysis
- exports evaluation-ready predictions
- leaves clean extension points for lineup, bullpen, weather, and sharp-market intelligence

## Recommended Next Step
After plan approval, the first coding task should be:

1. scaffold the `mlb_predictor` React + TypeScript app to match the shared stack
2. create `mlbTypes.ts`
3. create baseline team, starter, and bullpen datasets
4. implement a transparent v1 `predictGame(...)` engine
