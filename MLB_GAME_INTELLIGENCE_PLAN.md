# MLB Game Intelligence Cards And Composite Recommendation Roadmap

## Summary
The MLB schedule view should center on expandable game intelligence cards in the same product family as the NBA app, but with baseball-native sections.

Each card should combine:

- model projections
- sportsbook lines
- probable starters
- lineup status
- bullpen workload
- park and weather context
- injuries / availability notes
- recent team form
- sharp-market signals

The cards should become the main output surface for the daily MLB slate, with a ranked summary above them and detailed game-by-game intelligence below.

## Product Goal
The card should answer one question quickly:

`Why does the model like or pass this MLB game?`

That explanation should be visible through a small number of structured sections instead of a loose wall of stats.

## Core Card Layout
Each MLB game card should include:

### 1. Header
- away team at home team
- start time
- probable starters
- park
- weather summary
- edited-lines badge if manual odds were changed
- lineup confirmation status

### 2. Model And Market
- projected runs for both teams
- projected total
- projected run differential
- home/away win probability
- Money Line edge
- run line edge
- total edge
- primary model recommendation

### 3. Pitching Matchup
- away starter snapshot
- home starter snapshot
- handedness
- innings expectation
- strikeout/walk profile
- recent form note
- starter edge summary

### 4. Offense And Split Context
- each offense versus the opposing starter handedness
- power profile
- contact quality or strikeout risk
- baserunning pressure if supported
- short split-based explanation tags

### 5. Bullpen Context
- bullpen quality snapshot
- recent workload or fatigue flag
- leverage arms availability note when available
- bullpen edge summary

### 6. Park And Weather
- park run factor
- home run factor if available
- temperature
- wind direction / wind speed
- weather-driven total note

### 7. Sharp Information
- opening versus current Money Line
- opening versus current total
- public bet / money splits
- reverse line movement or steam flags
- consensus lean tags

### 8. Lineups And Availability
- confirmed or projected lineup status
- missing key hitters
- catcher/rest notes if available
- player status freshness timestamp

### 9. Recent Form
- recent results
- runs scored / allowed in recent games
- starter or bullpen trend notes
- freshness timestamp

## Composite Recommendation Layer
The MLB app should follow the NBA direction of layering a composite recommendation above the raw market outputs, while still keeping the underlying model visible.

### V1 scoring inputs
Composite recommendation should combine:

- model edge strength
- starter matchup edge
- bullpen edge
- lineup confidence
- sharp-market alignment

### V1 display outputs
- primary recommended play
- numeric score
- tier label
- pass / no-play state
- short reason tags

### V1 scoring exclusions
These can be shown on the card without directly affecting the score at first:

- recent form
- injuries beyond obvious lineup-impact flags
- deeper defensive notes

## Recommended MLB Intelligence Types
Recommended additions to `src/lib/mlbTypes.ts`:

- `SharpSignalInput`
- `SharpMarketContext`
- `BullpenUsageSummary`
- `WeatherContext`
- `StarterMatchupSummary`
- `LineupStatus`
- `AvailabilityNote`
- `RecentFormSummary`
- `CompositeRecommendation`

Recommended `ScheduleRow` fields:

- `game`
- `espnOdds`
- `editedOdds`
- `simResult`
- `probableStarters`
- `bullpenUsage`
- `weather`
- `parkContext`
- `lineupStatus`
- `availabilityNotes`
- `sharpInput`
- `sharpContext`
- `recentForm`
- `compositeRecommendation`

## Source And Freshness Rules
Freshness matters more in MLB than in the season-long baseline model because probable starters, lineups, bullpen status, and weather can change fast.

The card should show freshness metadata for:

- probable starters
- lineups
- weather
- injuries / availability
- sharp inputs
- recent form

Recommended UI behavior:

- show `updated X min ago` when recent
- show absolute timestamp when older
- visually soften stale sections

## Ranked Summary Above Cards
Keep a compact ranked list above the cards, but treat it as an overview rather than the final output.

Recommended columns:

- matchup
- probable starters
- primary play
- composite tier
- Money Line edge
- run line edge
- total edge
- lineup confidence

## Export And Evaluation
Predictions export should include intelligence fields needed for later auditing.

Recommended additions:

- away starter
- home starter
- lineup confidence
- bullpen fatigue flags
- weather summary
- probable-starter freshness
- sharp-data freshness
- composite recommendation
- composite score
- composite tier
- reason tags

Evaluation should distinguish:

- raw model recommendation
- final composite recommendation

## Rollout Phases
### Phase 1
- build cards with model, market, and probable starters
- keep composite recommendation simple
- allow manual edits for missing inputs

### Phase 2
- add bullpen workload
- add weather
- add lineup confidence
- add freshness indicators

### Phase 3
- add sharp-signal normalization
- add richer composite scoring
- add ranked overview and export fields

### Phase 4
- add deeper availability notes
- add starter scratch handling
- add calibration views by recommendation tier

## MLB-Specific Card Principles
These should guide implementation decisions:

- starter information is first-class, not a footnote
- bullpen status deserves its own section
- handedness and lineup confirmation must be visible
- weather and park matter more for totals than in the other sports
- freshness must be obvious because baseball inputs move throughout the day

## Recommended Next Step
Once we start coding, the first intelligence milestone should be:

1. build the schedule card shell
2. populate it with model/market, probable starters, and park
3. add bullpen and weather next
4. layer composite recommendation after the underlying data surfaces are stable
