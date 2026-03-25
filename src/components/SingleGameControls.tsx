import type { ChangeEvent, Dispatch, SetStateAction } from 'react'

import type { PredictorState } from '../hooks/usePredictorState'
import type { BullpenWorkload } from '../lib/mlbTypes'

type ManualOddsField = keyof PredictorState['manualOdds']

const MANUAL_ODDS_FIELDS: Array<[string, ManualOddsField]> = [
  ['Home ML', 'homeMoneyline'],
  ['Away ML', 'awayMoneyline'],
  ['Run Line', 'runLine'],
  ['Home RL Odds', 'runLineHomeOdds'],
  ['Away RL Odds', 'runLineAwayOdds'],
  ['Total', 'overUnder'],
  ['Over Odds', 'overOdds'],
  ['Under Odds', 'underOdds'],
]

type WorkloadField = keyof BullpenWorkload

export function SingleGameControls({ state }: { state: PredictorState }) {
  const handleNumericChange =
    (setter: Dispatch<SetStateAction<number>>) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setter(Number(event.target.value))
    }

  const handleWorkloadChange =
    (setter: Dispatch<SetStateAction<BullpenWorkload>>, field: WorkloadField) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = field === 'closerAvailable' ? event.target.checked : Number(event.target.value)
      setter((prev) => ({ ...prev, [field]: value }))
    }

  return (
    <section className="panel">
      <h2>Single Game Tools</h2>
      <p>Build a deeper MLB projection from team context, probable starters, weather, bullpen fatigue/workload, lineup certainty, and market odds.</p>

      <div className="fetch-panel-row">
        <div>
          <strong className="fetch-panel-title">ESPN Data</strong>
          <p className="fetch-panel-copy">Pull the latest posted market odds for the selected matchup before running the projection.</p>
        </div>
        <div className="fetch-panel-actions">
          <span className={`meta-chip ${state.oddsSource === 'espn' ? 'live-chip' : state.oddsSource === 'fetching' ? 'pending-chip' : ''}`}>{state.oddsStatus}</span>
          <button className="secondary-button" onClick={() => void state.fetchEspnData()} disabled={state.oddsSource === 'fetching'}>
            {state.oddsSource === 'fetching' ? 'Fetching ESPN...' : 'Fetch Data'}
          </button>
        </div>
      </div>

      <div className="controls-grid">
        <label className="field">
          <span>Away Team</span>
          <select value={state.awayTeam} onChange={(event) => state.setAwayTeam(event.target.value as typeof state.awayTeam)}>
            {state.teamOrder.filter((abbr) => abbr !== state.homeTeam).map((abbr) => (
              <option key={abbr} value={abbr}>
                {abbr} · {state.teams[abbr].name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Home Team</span>
          <select value={state.homeTeam} onChange={(event) => state.setHomeTeam(event.target.value as typeof state.homeTeam)}>
            {state.teamOrder.filter((abbr) => abbr !== state.awayTeam).map((abbr) => (
              <option key={abbr} value={abbr}>
                {abbr} · {state.teams[abbr].name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Away Probable Starter</span>
          <select value={state.awayStarterId} onChange={(event) => state.setAwayStarterId(event.target.value)}>
            {state.awayStarterOptions.map((starter) => (
              <option key={starter.id} value={starter.id}>
                {starter.name} · {starter.role} · {starter.hand}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Home Probable Starter</span>
          <select value={state.homeStarterId} onChange={(event) => state.setHomeStarterId(event.target.value)}>
            {state.homeStarterOptions.map((starter) => (
              <option key={starter.id} value={starter.id}>
                {starter.name} · {starter.role} · {starter.hand}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Game Type</span>
          <select value={state.gameType} onChange={(event) => state.setGameType(event.target.value as typeof state.gameType)}>
            {state.gameTypes.map((gameType) => (
              <option key={gameType} value={gameType}>
                {gameType}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Wind Direction</span>
          <select value={state.windDirection} onChange={(event) => state.setWindDirection(event.target.value as typeof state.windDirection)}>
            {state.windOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Temperature</span>
          <input type="range" min="45" max="100" value={state.temperature} onChange={handleNumericChange(state.setTemperature)} />
          <strong>{state.temperature}F</strong>
        </label>

        <label className="field">
          <span>Wind Speed</span>
          <input type="range" min="0" max="20" value={state.windMph} onChange={handleNumericChange(state.setWindMph)} />
          <strong>{state.windMph} mph</strong>
        </label>

        <label className="field">
          <span>Away Bullpen Fatigue</span>
          <select value={state.awayBullpenFatigue} onChange={(event) => state.setAwayBullpenFatigue(event.target.value as typeof state.awayBullpenFatigue)}>
            {state.bullpenOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Home Bullpen Fatigue</span>
          <select value={state.homeBullpenFatigue} onChange={(event) => state.setHomeBullpenFatigue(event.target.value as typeof state.homeBullpenFatigue)}>
            {state.bullpenOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Away Lineup</span>
          <select value={state.awayLineupConfidence} onChange={(event) => state.setAwayLineupConfidence(event.target.value as typeof state.awayLineupConfidence)}>
            {state.lineupOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Home Lineup</span>
          <select value={state.homeLineupConfidence} onChange={(event) => state.setHomeLineupConfidence(event.target.value as typeof state.homeLineupConfidence)}>
            {state.lineupOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="subsection">
        <h3>Bullpen Workload</h3>
        <div className="controls-grid">
          <label className="field">
            <span>Away Last 3 Days Pitches</span>
            <input
              type="range"
              min="20"
              max="130"
              value={state.awayBullpenWorkload.last3DaysPitchCount}
              onChange={handleWorkloadChange(state.setAwayBullpenWorkload, 'last3DaysPitchCount')}
            />
            <strong>{state.awayBullpenWorkload.last3DaysPitchCount}</strong>
          </label>
          <label className="field">
            <span>Home Last 3 Days Pitches</span>
            <input
              type="range"
              min="20"
              max="130"
              value={state.homeBullpenWorkload.last3DaysPitchCount}
              onChange={handleWorkloadChange(state.setHomeBullpenWorkload, 'last3DaysPitchCount')}
            />
            <strong>{state.homeBullpenWorkload.last3DaysPitchCount}</strong>
          </label>
          <label className="field">
            <span>Away High-Leverage Appearances</span>
            <input
              type="range"
              min="0"
              max="4"
              value={state.awayBullpenWorkload.highLeverageUsage}
              onChange={handleWorkloadChange(state.setAwayBullpenWorkload, 'highLeverageUsage')}
            />
            <strong>{state.awayBullpenWorkload.highLeverageUsage}</strong>
          </label>
          <label className="field">
            <span>Home High-Leverage Appearances</span>
            <input
              type="range"
              min="0"
              max="4"
              value={state.homeBullpenWorkload.highLeverageUsage}
              onChange={handleWorkloadChange(state.setHomeBullpenWorkload, 'highLeverageUsage')}
            />
            <strong>{state.homeBullpenWorkload.highLeverageUsage}</strong>
          </label>
          <label className="field checkbox-field">
            <span>Away Closer Available</span>
            <input
              type="checkbox"
              checked={state.awayBullpenWorkload.closerAvailable}
              onChange={handleWorkloadChange(state.setAwayBullpenWorkload, 'closerAvailable')}
            />
          </label>
          <label className="field checkbox-field">
            <span>Home Closer Available</span>
            <input
              type="checkbox"
              checked={state.homeBullpenWorkload.closerAvailable}
              onChange={handleWorkloadChange(state.setHomeBullpenWorkload, 'closerAvailable')}
            />
          </label>
        </div>
      </div>

      <div className="meta-chip-row">
        <span className="meta-chip">Away Starter: {state.awayStarterName}</span>
        <span className="meta-chip">Home Starter: {state.homeStarterName}</span>
        <span className="meta-chip">Park Factor: {state.teams[state.homeTeam].parkFactor}</span>
        <span className="meta-chip">Odds Source: {state.oddsSource === 'espn' ? 'ESPN' : 'Manual'}</span>
      </div>

      <div className="subsection">
        <h3>Manual Odds</h3>
        <div className="controls-grid odds-grid">
          {MANUAL_ODDS_FIELDS.map(([label, field]) => (
            <label key={field} className="field">
              <span>{label}</span>
              <input
                type="text"
                value={state.manualOdds[field]}
                onChange={(event) => state.setManualOdds((prev) => ({ ...prev, [field]: event.target.value }))}
              />
            </label>
          ))}
        </div>
      </div>

      <button className="primary-button" onClick={state.runProjection}>
        Run MLB Projection
      </button>

      <div className="meta-chip-row">
        <span className="meta-chip">{state.status}</span>
      </div>
    </section>
  )
}
