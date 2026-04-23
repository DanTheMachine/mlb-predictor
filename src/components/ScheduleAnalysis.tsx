import { useEffect, useMemo, useState } from 'react'

import { analyzeBetting } from '../lib/betting'
import { parseBulkOdds } from '../lib/bulkOddsParser'
import { buildCompositeRecommendation, buildCompositeRecommendations } from '../lib/compositeRecommendation'
import { fetchCompletedGameResults, fetchLiveScheduleRows } from '../lib/mlbApi'
import { fetchStoredPredictions } from '../lib/automationApi'
import type { StoredPredictionRow } from '../lib/automationApi'
import {
  createDefaultBullpenWorkload,
  getDefaultStarter,
  getStartersForTeam,
  predictGame,
} from '../lib/mlbModel'
import type { CompositeRecommendation, OddsInput, ScheduleRow, TeamAbbr, TeamStats, WindDirection } from '../lib/mlbTypes'

const SAMPLE_SLATE: Array<{ awayTeam: TeamAbbr; homeTeam: TeamAbbr; gameTime: string }> = [
  { awayTeam: 'ATL', homeTeam: 'LAD', gameTime: '7:10 PM' },
  { awayTeam: 'NYY', homeTeam: 'BOS', gameTime: '7:15 PM' },
  { awayTeam: 'SEA', homeTeam: 'HOU', gameTime: '8:10 PM' },
  { awayTeam: 'PHI', homeTeam: 'SD', gameTime: '9:40 PM' },
]

type ScheduleAnalysisProps = {
  teams: Record<TeamAbbr, TeamStats>
  leagueAvgRunsPerGame?: number
  teamDataTone: 'neutral' | 'success' | 'error'
  teamDataStatus: string
  teamsUpdated: boolean
  teamsUpdatedAt: string | null
  loadedSeason: number | null
  // eslint-disable-next-line no-unused-vars
  fetchTeamData: (...args: [string]) => Promise<void>
}

export function ScheduleAnalysis({
  teams,
  leagueAvgRunsPerGame = 4.35,
  teamDataTone,
  teamDataStatus,
  teamsUpdated,
  teamsUpdatedAt,
  loadedSeason,
  fetchTeamData,
}: ScheduleAnalysisProps) {
  const [rows, setRows] = useState<ScheduleRow[]>([])
  const [bulkPaste, setBulkPaste] = useState('')
  const [bulkStatus, setBulkStatus] = useState('Load the sample slate or paste sportsbook odds to build the board.')
  const [bulkStatusTone, setBulkStatusTone] = useState<'neutral' | 'success' | 'error'>('neutral')
  const [bulkError, setBulkError] = useState('')
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [liveDate, setLiveDate] = useState(() => new Date().toISOString().slice(0, 10))

  useEffect(() => {
    const refreshDateIfStale = () => {
      const today = new Date().toISOString().slice(0, 10)
      setLiveDate((prev) => (prev < today ? today : prev))
    }
    const handleVisibility = () => {
      if (!document.hidden) refreshDateIfStale()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])
  const [gamesLoading, setGamesLoading] = useState(false)
  const [liveLoadAttempted, setLiveLoadAttempted] = useState(false)
  const [liveLoadFailed, setLiveLoadFailed] = useState(false)
  const [lastLiveRefresh, setLastLiveRefresh] = useState<string | null>(null)
  const [bulkEditorOpen, setBulkEditorOpen] = useState(false)
  const [resultsLoading, setResultsLoading] = useState(false)
  const [hasRunAllSims, setHasRunAllSims] = useState(false)

  const enrichedRows = useMemo(
    () =>
      rows.map((row) => {
        const analysis = row.result ? analyzeBetting(row.result, row.odds) : null
        const composite = row.result ? buildCompositeRecommendation(row, analysis) : null
        const compositeSet = row.result ? buildCompositeRecommendations(row, analysis) : null
        return { row: { ...row, compositeRecommendation: composite }, analysis, composite, compositeSet }
      }),
    [rows],
  )

  const bestBets = useMemo(() => {
    if (!hasRunAllSims) return []
    return enrichedRows
      .flatMap(({ row, compositeSet, analysis }) => {
        if (!compositeSet) return []
        return (['ML', 'RL', 'OU'] as const)
          .map((market) => ({
            market,
            composite: compositeSet[market],
            row,
            edgePct:
              market === 'ML' ? (analysis?.mlValuePct ?? 0)
              : market === 'RL' ? (analysis?.runLineEdge ?? 0)
              : (analysis?.ouEdgePct ?? 0),
          }))
          .filter(({ composite }) => !composite.pass)
      })
      .sort((a, b) => b.composite.score - a.composite.score)
  }, [enrichedRows, hasRunAllSims])

  const liveBoardSummary = useMemo(() => {
    const upcomingRows = rows.filter((row) => isUpcomingGame(row))
    return {
      totalGames: rows.length,
      teamsUpdated,
      oddsLiveCount: rows.filter((row) => row.odds.source !== 'model').length,
      oddsEligibleCount: upcomingRows.length,
      oddsLiveEligibleCount: upcomingRows.filter((row) => row.odds.source !== 'model').length,
      weatherLiveCount: rows.filter((row) => Boolean(row.weatherLastUpdated)).length,
      weatherEligibleCount: upcomingRows.length,
      weatherLiveEligibleCount: upcomingRows.filter((row) => Boolean(row.weatherLastUpdated)).length,
      lineupConfirmedCount: rows.filter(
        (row) => row.awayLineupConfidence === 'Confirmed' && row.homeLineupConfidence === 'Confirmed',
      ).length,
      lineupEligibleCount: upcomingRows.length,
      lineupConfirmedEligibleCount: upcomingRows.filter(
        (row) => row.awayLineupConfidence === 'Confirmed' && row.homeLineupConfidence === 'Confirmed',
      ).length,
      lineupPendingCount: rows.filter(
        (row) => row.awayLineupConfidence !== 'Confirmed' || row.homeLineupConfidence !== 'Confirmed',
      ).length,
    }
  }, [rows, teamsUpdated])

  const hasManualOdds = useMemo(() => rows.some((row) => row.odds.source === 'manual'), [rows])

  const loadSampleSlate = () => {
    setRows(
      SAMPLE_SLATE.map((game, index) => createIntelligenceRow(game.awayTeam, game.homeTeam, game.gameTime, index, defaultOddsForGame(teams, game.homeTeam, game.awayTeam))),
    )
    setHasRunAllSims(false)
    setBulkStatus('Sample MLB slate loaded with starter, lineup, weather, bullpen, and sharp-style context.')
    setBulkStatusTone('success')
    setBulkError('')
    setLiveLoadAttempted(false)
    setLiveLoadFailed(false)
    setLastLiveRefresh(null)
  }

  const handleBulkImport = () => {
    try {
      const games = parseBulkOdds(bulkPaste)
      const incomingByMatchup = new Map(games.map((game) => [`${game.awayAbbr}-${game.homeAbbr}`, game.odds]))

      setRows((prev) => {
        if (!prev.length) {
          return games.map((game, index) => createIntelligenceRow(game.awayAbbr, game.homeAbbr, `${7 + index}:10 PM`, index, game.odds))
        }

        const updated = prev.map((row) => {
          const key = `${row.game.awayTeam}-${row.game.homeTeam}`
          const importedOdds = incomingByMatchup.get(key)
          if (!importedOdds) return row

          return {
            ...row,
            odds: {
              ...importedOdds,
              source: 'manual' as const,
            },
          }
        })

        return updated
      })
      setHasRunAllSims(false)
      setBulkStatus(`Lines updated successfully at ${formatTimestamp(new Date().toISOString())}. Games Updated: ${games.length}`)
      setBulkStatusTone('success')
      setBulkError('')
      setBulkEditorOpen(false)
    } catch (error) {
      setBulkStatusTone('error')
      setBulkError(error instanceof Error ? error.message : 'Bulk import failed.')
    }
  }

  const loadGames = async () => {
    setGamesLoading(true)
    setBulkError('')
    setLiveLoadAttempted(true)
    setLiveLoadFailed(false)

    try {
      const slateRows = await fetchLiveScheduleRows(liveDate, { liveTeams: teams })
      setRows(slateRows)
      setHasRunAllSims(false)
      setExpandedIdx(null)
      const fetchedAt = new Date().toISOString()
      setLastLiveRefresh(fetchedAt)
      setBulkStatus(
        slateRows.length
          ? `Games loaded at ${formatTimestamp(fetchedAt)}. Slate: ${slateRows.length} Weather: ${slateRows.filter((row) => Boolean(row.weatherLastUpdated)).length} Odds: ${slateRows.filter((row) => row.odds.source !== 'model').length}`
          : `No live MLB games were returned for ${liveDate}.`,
      )
      setBulkStatusTone('success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Load games failed.'
      setBulkError(message)
      setBulkStatus(`Load games failed at ${formatTimestamp(new Date().toISOString())}.`)
      setBulkStatusTone('error')
      setLiveLoadFailed(true)
    } finally {
      setGamesLoading(false)
    }
  }

  const runAllProjections = () => {
    setRows((prev) =>
      prev.map((row) => {
        const result = predictGame({
          homeTeam: teams[row.game.homeTeam],
          awayTeam: teams[row.game.awayTeam],
          homeStarter: row.homeStarter,
          awayStarter: row.awayStarter,
          gameType: 'Regular Season',
          temperature: row.temperature,
          windMph: row.windMph,
          windDirection: row.windDirection,
          homeBullpenFatigue: row.homeBullpenFatigue,
          awayBullpenFatigue: row.awayBullpenFatigue,
          homeBullpenWorkload: row.homeBullpenWorkload,
          awayBullpenWorkload: row.awayBullpenWorkload,
          homeLineupConfidence: row.homeLineupConfidence,
          awayLineupConfidence: row.awayLineupConfidence,
          leagueAvgRunsPerGame,
        })
        const analysis = analyzeBetting(result, row.odds)
        return { ...row, result, compositeRecommendation: buildCompositeRecommendation({ ...row, result }, analysis) }
      }),
    )
    setHasRunAllSims(true)
    setBulkStatus('Ran projections for the current slate and refreshed composite recommendations.')
    setBulkStatusTone('success')
  }

  const exportPredictionsCsv = async () => {
    const exportDate = liveDate
    const header = [
      'Date',
      'GameTime',
      'Away',
      'Home',
      'AwayStarter',
      'HomeStarter',
      'AwayRuns',
      'HomeRuns',
      'Total',
      'Margin',
      'HomeWinProb',
      'AwayWinProb',
      'MoneylineRec',
      'MoneylineEdgePct',
      'RunLineRec',
      'RunLineEdgePct',
      'TotalRec',
      'TotalEdgePct',
      'MarketTotal',
      'HomeML',
      'AwayML',
      'RunLine',
      'RunLineHomeOdds',
      'RunLineAwayOdds',
      'OverOdds',
      'UnderOdds',
      'AwayLineupConfidence',
      'HomeLineupConfidence',
      'StarterFreshness',
      'WeatherFreshness',
      'SharpFreshness',
      'CompositeMarket',
      'CompositePick',
      'CompositeScore',
      'CompositeTier',
      'CompositeReasons',
      'LookupKey',
    ]

    // Build rows from UI state (simmed games currently loaded)
    const uiLines = enrichedRows
      .filter((entry) => entry.row.result)
      .map(({ row, analysis, composite }) => ({
        gameTime: row.game.gameTime,
        lookupKey: lookupKey(exportDate, row.game.homeTeam, row.game.awayTeam),
        line: [
          exportDate,
          row.game.gameTime,
          exportTeamLabel(row.game.awayTeam, teams),
          exportTeamLabel(row.game.homeTeam, teams),
          row.awayStarter.name,
          row.homeStarter.name,
          row.result?.projectedAwayRuns.toFixed(2) ?? '',
          row.result?.projectedHomeRuns.toFixed(2) ?? '',
          row.result?.projectedTotal.toFixed(2) ?? '',
          row.result?.projectedMargin.toFixed(2) ?? '',
          row.result ? (row.result.homeWinProb * 100).toFixed(1) : '',
          row.result ? (row.result.awayWinProb * 100).toFixed(1) : '',
          analysis?.mlValueSide === 'none' ? 'PASS' : `${analysis?.mlValueSide?.toUpperCase()} ML`,
          analysis?.mlValuePct.toFixed(1) ?? '',
          analysis?.runLineRec.toUpperCase() ?? 'PASS',
          analysis?.runLineEdge.toFixed(1) ?? '',
          analysis?.ouRec.toUpperCase() ?? 'PASS',
          analysis?.ouEdgePct.toFixed(1) ?? '',
          row.odds.overUnder.toFixed(1),
          String(row.odds.homeMoneyline),
          String(row.odds.awayMoneyline),
          String(row.odds.runLine),
          String(row.odds.runLineHomeOdds),
          String(row.odds.runLineAwayOdds),
          String(row.odds.overOdds),
          String(row.odds.underOdds),
          row.awayLineupConfidence,
          row.homeLineupConfidence,
          row.starterLastUpdated ?? 'Unknown',
          row.weatherLastUpdated ?? 'Unknown',
          row.sharpInput?.lastUpdated ?? 'Unknown',
          composite?.primaryMarket ?? 'PASS',
          composite?.pick ?? 'PASS',
          composite?.score.toFixed(1) ?? '0.0',
          composite?.tier ?? 'PASS',
          composite?.reasons.join(' | ') ?? '',
          lookupKey(exportDate, row.game.homeTeam, row.game.awayTeam),
        ].map(csvEscape).join(','),
      }))

    // Supplement with DB predictions for games not loaded in the UI (e.g. already-started games)
    const uiLookupKeys = new Set(uiLines.map((r) => r.lookupKey))
    let dbLines: Array<{ gameTime: string; lookupKey: string; line: string }> = []
    try {
      const stored = await fetchStoredPredictions(exportDate)
      dbLines = stored
        .filter((r) => !uiLookupKeys.has(r.lookupKey))
        .map((r: StoredPredictionRow) => ({
          gameTime: r.gameTime,
          lookupKey: r.lookupKey,
          line: [
            r.date,
            r.gameTime,
            exportTeamLabel(r.awayTeam as TeamAbbr, teams),
            exportTeamLabel(r.homeTeam as TeamAbbr, teams),
            r.awayStarter,
            r.homeStarter,
            r.awayRuns.toFixed(2),
            r.homeRuns.toFixed(2),
            r.total.toFixed(2),
            r.margin.toFixed(2),
            (r.homeWinProb * 100).toFixed(1),
            (r.awayWinProb * 100).toFixed(1),
            r.moneylineRec,
            r.moneylineEdgePct.toFixed(1),
            r.runLineRec,
            r.runLineEdgePct.toFixed(1),
            r.totalRec,
            r.totalEdgePct.toFixed(1),
            r.marketTotal.toFixed(1),
            String(r.homeML),
            String(r.awayML),
            String(r.runLine),
            String(r.runLineHomeOdds),
            String(r.runLineAwayOdds),
            String(r.overOdds),
            String(r.underOdds),
            r.awayLineupConfidence,
            r.homeLineupConfidence,
            r.starterFreshness,
            r.weatherFreshness,
            r.sharpFreshness,
            r.compositeMarket,
            r.compositePick,
            r.compositeScore.toFixed(1),
            r.compositeTier,
            r.compositeReasons.join(' | '),
            r.lookupKey,
          ].map(csvEscape).join(','),
        }))
    } catch {
      // API not running or no DB predictions — export UI rows only
    }

    // Merge: UI rows first (they take priority), then DB rows.
    // Deduplicate by lookupKey — first occurrence wins (UI over DB).
    const seen = new Set<string>()
    const merged = [...uiLines, ...dbLines].filter((r) => {
      if (seen.has(r.lookupKey)) return false
      seen.add(r.lookupKey)
      return true
    })

    // Sort by game time
    const allLines = merged.sort((a, b) => parseGameTime(a.gameTime) - parseGameTime(b.gameTime))

    const uiCount = uiLines.filter((r) => seen.has(r.lookupKey)).length
    const dbCount = allLines.length - uiCount

    const csv = [header.map(csvEscape).join(','), ...allLines.map((r) => r.line)].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `mlb-predictions-${exportDate}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setBulkStatus(
      dbCount > 0
        ? `Predictions exported for ${exportDate} (${allLines.length} games: ${uiCount} from UI + ${dbCount} from DB).`
        : `Predictions exported for ${exportDate}.`,
    )
    setBulkStatusTone('success')
  }

  const exportResultsCsv = async () => {
    setResultsLoading(true)
    setBulkError('')

    try {
      const resultsDate = subtractOneDay(liveDate)
      const results = await fetchCompletedGameResults(resultsDate)
      const header = ['Date', 'Home', 'Away', 'Home Score', 'Away Score', 'Winner', 'Total', 'LookupKey']
      const lines = results.map((row) =>
        [
          row.date,
          row.home,
          row.away,
          String(row.homeScore),
          String(row.awayScore),
          row.homeScore > row.awayScore ? row.home : row.away,
          String(row.homeScore + row.awayScore),
          row.lookupKey,
        ]
          .map(csvEscape)
          .join(','),
      )
      const csv = [header.map(csvEscape).join(','), ...lines].join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `mlb-results-${resultsDate}.csv`
      link.click()
      URL.revokeObjectURL(url)
      setBulkStatus(results.length ? `Results exported for ${resultsDate}.` : `No final MLB results were available for ${resultsDate}.`)
      setBulkStatusTone('success')
    } catch (error) {
      setBulkStatusTone('error')
      setBulkError(error instanceof Error ? error.message : 'Results export failed.')
    } finally {
      setResultsLoading(false)
    }
  }

  return (
    <>
      <div className="data-source-panel">
        <div>
          <p className={`subtle-copy ${teamDataTone === 'success' ? 'success-copy' : teamDataTone === 'error' ? 'error-copy' : ''}`}>{teamDataStatus}</p>
        </div>
        <div className="fetch-panel-actions">
          <button
            className={`secondary-button ${teamDataTone === 'success' ? 'secondary-button-success' : teamDataTone === 'error' ? 'secondary-button-error' : ''}`}
            onClick={() => void fetchTeamData(liveDate)}
          >
            Fetch MLB Data
          </button>
        </div>
      </div>

      <section className="panel daily-schedule-panel">
        <div className="daily-schedule-header">
          <div className="daily-schedule-header-main">
            <h2>Daily Schedule</h2>
            <div className="meta-chip-row daily-status-row">
              <span className={`meta-chip ${liveBoardSummary.teamsUpdated ? 'live-chip' : ''}`}>Teams Updated</span>
              <span
                className={`meta-chip ${feedChipClass({
                  attempted: liveLoadAttempted,
                  failed: liveLoadFailed,
                  eligibleCount: liveBoardSummary.lineupEligibleCount,
                  updatedCount: liveBoardSummary.lineupConfirmedEligibleCount,
                })}`}
              >
                Full lineups {liveBoardSummary.lineupConfirmedEligibleCount}/{liveBoardSummary.lineupEligibleCount}
              </span>
              <span
                className={`meta-chip ${feedChipClass({
                  attempted: liveLoadAttempted,
                  failed: liveLoadFailed,
                  eligibleCount: liveBoardSummary.oddsEligibleCount,
                  updatedCount: liveBoardSummary.oddsLiveEligibleCount,
                })}`}
              >
                Odds live {liveBoardSummary.oddsLiveEligibleCount}/{liveBoardSummary.oddsEligibleCount}
              </span>
              <span
                className={`meta-chip ${feedChipClass({
                  attempted: liveLoadAttempted,
                  failed: liveLoadFailed,
                  eligibleCount: liveBoardSummary.weatherEligibleCount,
                  updatedCount: liveBoardSummary.weatherLiveEligibleCount,
                })}`}
              >
                Weather live {liveBoardSummary.weatherLiveEligibleCount}/{liveBoardSummary.weatherEligibleCount}
              </span>
            </div>
          </div>
          <button className="primary-button header-load-button" onClick={() => void loadGames()} disabled={gamesLoading}>
            {gamesLoading ? 'Loading Games...' : 'Load Games'}
          </button>
        </div>

      <div className="schedule-toolbar">
        <label className="field live-date-field">
          <span>Live Slate Date</span>
          <input type="date" value={liveDate} onChange={(event) => setLiveDate(event.target.value)} />
        </label>
          <button className="secondary-button toolbar-button" onClick={loadSampleSlate}>
            Load Sample Slate
          </button>
          <button
            className={`secondary-button toolbar-button ${hasManualOdds ? 'secondary-button-success' : ''}`}
            onClick={() => setBulkEditorOpen((prev) => !prev)}
          >
            {bulkEditorOpen ? 'Hide Bulk Edit Lines' : 'Bulk Edit Lines'}
          </button>
          <button
            className={`secondary-button toolbar-button ${hasRunAllSims ? 'secondary-button-success' : ''}`}
            onClick={runAllProjections}
            disabled={!rows.length}
          >
            Run All Sims
          </button>
          <button className="primary-button toolbar-button" onClick={exportPredictionsCsv} disabled={!enrichedRows.some((entry) => entry.row.result)}>
            Predictions CSV
          </button>
          <button className="primary-button toolbar-button" onClick={() => void exportResultsCsv()} disabled={resultsLoading}>
            {resultsLoading ? 'Loading Results...' : 'Results CSV'}
          </button>
        </div>

      <p className={`subtle-copy schedule-status-line ${bulkError ? 'error-copy' : bulkStatusTone === 'success' ? 'success-copy' : ''}`}>{bulkError || bulkStatus}</p>
      {liveBoardSummary && lastLiveRefresh ? (
        <p className="subtle-copy success-copy schedule-timestamp schedule-status-line">
          Last slate refresh {freshnessLabel(lastLiveRefresh)}
          {teamsUpdatedAt ? ` · Team model ${freshnessLabel(teamsUpdatedAt)}` : ''}
          {loadedSeason ? ` · Stats season ${loadedSeason}` : ''}
        </p>
      ) : null}

      {bulkEditorOpen ? (
        <div className="subsection">
          <textarea
            className="bulk-textarea"
            value={bulkPaste}
            onChange={(event) => setBulkPaste(event.target.value)}
            placeholder="Paste sportsbook blocks here to build an MLB slate..."
          />
          <div className="action-row bulk-edit-actions">
            <button className="primary-button bulk-edit-button" onClick={handleBulkImport}>
              Import Pasted Odds
            </button>
            <button className="secondary-button bulk-edit-button" onClick={() => setBulkPaste('')} disabled={!bulkPaste.trim()}>
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {hasRunAllSims && bestBets.length > 0 ? (
        <div className="best-bets-panel">
          <div className="best-bets-header">
            <strong>Best Bets</strong>
            <span className="subtle-copy">{bestBets.length} play{bestBets.length !== 1 ? 's' : ''} · sorted by score</span>
          </div>
          <div className="best-bets-list">
            {bestBets.map(({ market, composite, row, edgePct }, idx) => (
              <div key={idx} className="best-bet-row">
                <span className={`best-bet-tier ${compositeTierClass(composite)}`}>{composite.tier}</span>
                <span className="best-bet-market">{market}</span>
                <span className="best-bet-game">
                  <span className="best-bet-matchup">{row.game.awayTeam} @ {row.game.homeTeam} · {row.game.gameTime}</span>
                  <span className="best-bet-pitching">{row.awayStarter.name} vs {row.homeStarter.name}</span>
                  {composite.reasons[0] ? <span className="best-bet-reason">{composite.reasons[0]}</span> : null}
                </span>
                <span className="best-bet-pick">{formatCompositeCardPick(row, composite)}</span>
                <span className="best-bet-meta">
                  <span className={compositeTierClass(composite)}>{composite.score.toFixed(1)}/10</span>
                  <span className="best-bet-edge">{edgePct.toFixed(1)}%</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {enrichedRows.length ? (
        <div className="schedule-list">
          {enrichedRows.map(({ row, analysis, composite, compositeSet }, idx) => {
            const expanded = expandedIdx === idx
            const headerCompositeRecommendation = formatHeaderCompositeRecommendation(row, composite)
            const feedFlags = cardFeedFlags(row)

            return (
              <article key={`${row.game.awayTeam}-${row.game.homeTeam}-${row.game.gameTime}`} className="schedule-card">
                <button className="schedule-card-header" onClick={() => setExpandedIdx(expanded ? null : idx)}>
                  <div>
                    <strong>{`${displayTeamName(row.game.awayTeam, teams)} at ${displayTeamName(row.game.homeTeam, teams)} · ${row.game.gameTime} · ${row.awayStarter.name} vs ${row.homeStarter.name}`}</strong>
                    <span>{headerOddsSummary(row.odds)}</span>
                  </div>
                  <div className="schedule-card-header-summary">
                    <span className="schedule-card-projected-score">
                      {row.result
                        ? `Proj Score: ${row.game.awayTeam} ${row.result.projectedAwayRuns.toFixed(2)} - ${row.game.homeTeam} ${row.result.projectedHomeRuns.toFixed(2)}`
                        : 'Proj Score: pending'}
                    </span>
                    <strong>{`Comp Rec: ${headerCompositeRecommendation}`}</strong>
                    <span>{composite ? `Tier ${composite.tier} · Score ${composite.score.toFixed(1)}` : 'Projection pending'}</span>
                  </div>
                </button>

                <div className="meta-chip-row">
                  <span className="meta-chip">
                    Lineups: {lineupStatusMark(row.awayLineupConfidence)} | {lineupStatusMark(row.homeLineupConfidence)}
                  </span>
                  <span className="meta-chip">Wind {row.windDirection} {row.windMph} mph</span>
                  <span className="meta-chip">{row.temperature}°F</span>
                  <span className="meta-chip">Odds {oddsSourceLabel(row.odds.source)}</span>
                  <span className="meta-chip">Starter Check: {freshnessLabel(row.starterLastUpdated)}</span>
                </div>
                {feedFlags.length ? (
                  <div className="fallback-row">
                    {feedFlags.map((flag) => (
                      <span key={flag} className="fallback-chip">
                        {flag}
                      </span>
                    ))}
                  </div>
                ) : null}

                {expanded ? (
                  <div className="schedule-card-body">
                    {compositeSet ? (
                      <div className="metric-grid">
                        <article className="mini-card">
                          <span>Composite ML Recommendation</span>
                          <strong className={compositeTierClass(compositeSet.ML)}>{formatCompositeCardPick(row, compositeSet.ML)}</strong>
                          <small>{formatCompositeTierScore(compositeSet.ML)}</small>
                          <small>{compositeSet.ML.reasons.join(' · ')}</small>
                        </article>
                        <article className="mini-card">
                          <span>Composite O/U Recommendation</span>
                          <strong className={compositeTierClass(compositeSet.OU)}>{formatCompositeCardPick(row, compositeSet.OU)}</strong>
                          <small>{formatCompositeTierScore(compositeSet.OU)}</small>
                          <small>{compositeSet.OU.reasons.join(' · ')}</small>
                        </article>
                        <article className="mini-card">
                          <span>Composite RL Recommendation</span>
                          <strong className={compositeTierClass(compositeSet.RL)}>{formatCompositeCardPick(row, compositeSet.RL)}</strong>
                          <small>{formatCompositeTierScore(compositeSet.RL)}</small>
                          <small>{compositeSet.RL.reasons.join(' · ')}</small>
                        </article>
                      </div>
                    ) : null}

                    <div className="metric-grid">
                      <article className="mini-card">
                        <span>Model And Market</span>
                        <strong>
                          {row.result
                            ? `${row.game.awayTeam} ${row.result.projectedAwayRuns.toFixed(2)} to ${row.game.homeTeam} ${row.result.projectedHomeRuns.toFixed(2)}`
                            : 'Run all projections'}
                        </strong>
                        <small className="market-edge-line">
                          <span className={compositeSet ? compositeTierClass(compositeSet.ML) : ''}>ML {analysis?.mlValuePct.toFixed(1) ?? '0.0'}%</span>
                          <span className={compositeSet ? compositeTierClass(compositeSet.RL) : ''}>RL {analysis?.runLineEdge.toFixed(1) ?? '0.0'}%</span>
                          <span className={compositeSet ? compositeTierClass(compositeSet.OU) : ''}>OU {analysis?.ouEdgePct.toFixed(1) ?? '0.0'}%</span>
                        </small>
                        <small>{feedHealthSummary(row)}</small>
                      </article>
                      <article className="mini-card">
                        <span>Home Team Ratings</span>
                        <strong>{row.game.homeTeam} split {homeSplitRating(row, teams)}</strong>
                        <small>{ratingDetailLine([
                          ['Power', teams[row.game.homeTeam].power, 'Extra-base hit and home-run profile in the run-scoring model.'],
                          ['Contact', teams[row.game.homeTeam].contact, 'How well the lineup avoids empty at-bats and puts balls in play.'],
                          ['Discipline', teams[row.game.homeTeam].discipline, 'Walks, zone control, and count leverage.'],
                        ])}</small>
                        <small>{ratingDetailLine([
                          ['Baserunning', teams[row.game.homeTeam].baserunning, 'Run creation added through steals and advancement.'],
                          ['Defense', teams[row.game.homeTeam].defense, 'Run prevention from fielding quality.'],
                          ['Bullpen', teams[row.game.homeTeam].bullpen, 'Relief run prevention quality before workload adjustments.'],
                        ])}</small>
                      </article>
                      <article className="mini-card">
                        <span>Away Team Ratings</span>
                        <strong>{row.game.awayTeam} split {awaySplitRating(row, teams)}</strong>
                        <small>{ratingDetailLine([
                          ['Power', teams[row.game.awayTeam].power, 'Extra-base hit and home-run profile in the run-scoring model.'],
                          ['Contact', teams[row.game.awayTeam].contact, 'How well the lineup avoids empty at-bats and puts balls in play.'],
                          ['Discipline', teams[row.game.awayTeam].discipline, 'Walks, zone control, and count leverage.'],
                        ])}</small>
                        <small>{ratingDetailLine([
                          ['Baserunning', teams[row.game.awayTeam].baserunning, 'Run creation added through steals and advancement.'],
                          ['Defense', teams[row.game.awayTeam].defense, 'Run prevention from fielding quality.'],
                          ['Bullpen', teams[row.game.awayTeam].bullpen, 'Relief run prevention quality before workload adjustments.'],
                        ])}</small>
                      </article>
                      <article className="mini-card">
                        <span>Rating Matchup</span>
                        <strong>{ratingEdgeSummary(row, teams)}</strong>
                        <small>Starter hand splits feed the offense side of the model.</small>
                        <small>Home park {teams[row.game.homeTeam].parkFactor} · Away defense {teams[row.game.awayTeam].defense} / Home defense {teams[row.game.homeTeam].defense}</small>
                      </article>
                    </div>

                    <div className="metric-grid">
                      <article className="mini-card">
                        <span>Pitching Matchup</span>
                        <strong>{row.awayStarter.name}</strong>
                        <small>{row.awayStarter.role} · {row.awayStarter.hand} · {row.awayStarter.daysRest} days rest · {row.awayStarter.recentPitchCount} pitches last start</small>
                        <small>{row.homeStarter.name} · {row.homeStarter.role} · {row.homeStarter.hand} · {row.homeStarter.daysRest} days rest</small>
                      </article>
                      <article className="mini-card">
                        <span>Bullpen Context</span>
                        <strong>{row.game.awayTeam} {row.awayBullpenWorkload.last3DaysPitchCount} pitches</strong>
                        <small>{row.game.homeTeam} {row.homeBullpenWorkload.last3DaysPitchCount} pitches</small>
                        <small>Closers: {row.awayBullpenWorkload.closerAvailable ? 'away ok' : 'away thin'} / {row.homeBullpenWorkload.closerAvailable ? 'home ok' : 'home thin'}</small>
                      </article>
                      <article className="mini-card">
                        <span>Park And Weather</span>
                        <strong>Park factor {teams[row.game.homeTeam].parkFactor}</strong>
                        <small>{weatherNote(row, teams)}</small>
                        <small>Updated {freshnessLabel(row.weatherLastUpdated)}</small>
                      </article>
                    </div>

                    <div className="metric-grid">
                      <article className="mini-card">
                        <span>Lineups And Availability</span>
                        <strong>{row.game.awayTeam} {row.awayLineupConfidence} / {row.game.homeTeam} {row.homeLineupConfidence}</strong>
                        <small>{row.availabilityNotes.map((note) => `${note.team}: ${note.note}`).join(' · ')}</small>
                        <small>Updated {freshnessLabel(row.lineupLastUpdated)}</small>
                      </article>
                      <article className="mini-card">
                        <span>Recent Form</span>
                        <strong>{row.recentForm.away.team} {row.recentForm.away.last10Record}</strong>
                        <small>{row.recentForm.home.team} {row.recentForm.home.last10Record}</small>
                        <small>{row.recentForm.away.bullpenTrend} / {row.recentForm.home.bullpenTrend}</small>
                      </article>
                      <article className="mini-card">
                        <span>Sharp Information</span>
                        <strong>{sharpSummary(row)}</strong>
                        <small>Open ML {formatOpeningMoneyline(row)} · Open total {row.sharpInput?.openingTotal?.toFixed(1) ?? 'N/A'}</small>
                        <small>Money split {splitLabel(row.sharpInput?.moneylineHomeMoneyPct, row.sharpInput?.moneylineHomeBetsPct)}</small>
                      </article>
                    </div>

                    {row.result && analysis ? (
                      <div className="subsection">
                        <h3>Model Drivers</h3>
                        <div className="feature-list">
                          {row.result.features.map((feature) => (
                            <div key={feature.label} className="feature-row">
                              <span>{feature.label}</span>
                              <strong className={feature.good ? 'feature-good' : 'feature-bad'}>{feature.detail}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="subtle-copy">Run all projections to populate model outputs and composite recommendations for this card.</p>
                    )}
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      ) : null}
      </section>
    </>
  )
}

function createIntelligenceRow(awayTeam: TeamAbbr, homeTeam: TeamAbbr, gameTime: string, index: number, odds: OddsInput): ScheduleRow {
  const awayStarter = getStartersForTeam(awayTeam)[index % 3] ?? getDefaultStarter(awayTeam)
  const homeStarter = getStartersForTeam(homeTeam)[(index + 1) % 3] ?? getDefaultStarter(homeTeam)
  const now = new Date(Date.now() - index * 19 * 60_000).toISOString()

  return {
    game: { awayTeam, homeTeam, gameTime },
    awayStarter,
    homeStarter,
    starterLastUpdated: now,
    awayBullpenFatigue: index % 2 === 0 ? 'Used' : 'Fresh',
    homeBullpenFatigue: index % 2 === 0 ? 'Fresh' : 'Used',
    awayBullpenWorkload: createDefaultBullpenWorkload(index % 2 === 0 ? 'Used' : 'Fresh'),
    homeBullpenWorkload: createDefaultBullpenWorkload(index % 2 === 0 ? 'Fresh' : 'Used'),
    awayLineupConfidence: index % 3 === 0 ? 'Projected' : 'Confirmed',
    homeLineupConfidence: index % 3 === 2 ? 'Thin' : 'Confirmed',
    lineupLastUpdated: new Date(Date.now() - (index * 14 + 8) * 60_000).toISOString(),
    temperature: 72 + index * 2,
    windMph: 6 + index * 2,
    windDirection: (index % 2 === 0 ? 'Out' : 'Neutral') as WindDirection,
    weatherLastUpdated: new Date(Date.now() - (index * 11 + 5) * 60_000).toISOString(),
    availabilityNotes: [
      { team: awayTeam, note: `${awayTeam} lineup still projecting one platoon spot`, impact: 'medium', lastUpdated: new Date(Date.now() - (index * 13 + 7) * 60_000).toISOString() },
      { team: homeTeam, note: `${homeTeam} has one bullpen bridge arm on limited availability`, impact: 'low', lastUpdated: new Date(Date.now() - (index * 9 + 6) * 60_000).toISOString() },
    ],
    recentForm: {
      away: {
        team: awayTeam,
        last10Record: `${6 - (index % 3)}-${4 + (index % 3)}`,
        runsScoredPerGame: Number((4.1 + index * 0.15).toFixed(1)),
        runsAllowedPerGame: Number((4.7 - index * 0.12).toFixed(1)),
        bullpenTrend: index % 2 === 0 ? 'late innings unstable' : 'bullpen holding leads',
        lastUpdated: new Date(Date.now() - (index * 22 + 9) * 60_000).toISOString(),
      },
      home: {
        team: homeTeam,
        last10Record: `${7 + (index % 2)}-${3 - (index % 2)}`,
        runsScoredPerGame: Number((4.9 + index * 0.2).toFixed(1)),
        runsAllowedPerGame: Number((3.9 + index * 0.05).toFixed(1)),
        bullpenTrend: index % 2 === 0 ? 'bullpen settling' : 'closer workload rising',
        lastUpdated: new Date(Date.now() - (index * 20 + 12) * 60_000).toISOString(),
      },
    },
    sharpInput: {
      source: 'sample',
      lastUpdated: new Date(Date.now() - (index * 10 + 3) * 60_000).toISOString(),
      openingHomeMoneyline: odds.homeMoneyline - 10,
      openingAwayMoneyline: odds.awayMoneyline + 10,
      openingTotal: odds.overUnder + (index % 2 === 0 ? 0.5 : -0.5),
      moneylineHomeBetsPct: 48 + index * 3,
      moneylineHomeMoneyPct: 54 + index * 2,
      totalOverBetsPct: 57 - index,
      totalOverMoneyPct: 52 + index,
      steamLean: index % 2 === 0 ? 'home' : 'over',
      reverseLean: index % 2 === 0 ? 'none' : 'under',
    },
    compositeRecommendation: null,
    odds,
    result: null,
  }
}

function defaultOddsForGame(teams: Record<TeamAbbr, TeamStats>, homeTeam: TeamAbbr, awayTeam: TeamAbbr): OddsInput {
  const homeStrength = teams[homeTeam].offenseVsR + teams[homeTeam].bullpen + teams[homeTeam].defense
  const awayStrength = teams[awayTeam].offenseVsR + teams[awayTeam].bullpen + teams[awayTeam].defense
  const diff = homeStrength - awayStrength
  const homeMoneyline = diff >= 0 ? -Math.max(120, 130 + Math.round(diff * 1.1)) : 110 + Math.round(Math.abs(diff) * 0.8)
  const awayMoneyline = homeMoneyline < 0 ? 100 + Math.round(Math.abs(homeMoneyline) * 0.85) : -Math.max(120, 130 + Math.round(Math.abs(diff) * 0.7))

  return {
    source: 'model',
    homeMoneyline,
    awayMoneyline,
    runLine: -1.5,
    runLineHomeOdds: 135,
    runLineAwayOdds: -160,
    overUnder: 8,
    overOdds: -110,
    underOdds: -110,
  }
}

function parseGameTime(gameTime: string): number {
  const match = gameTime.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!match || !match[1] || !match[2] || !match[3]) return 0
  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const meridiem = match[3].toUpperCase()
  if (meridiem === 'PM' && hours !== 12) hours += 12
  if (meridiem === 'AM' && hours === 12) hours = 0
  return hours * 60 + minutes
}

function csvEscape(value: string) {
  return `"${String(value).replaceAll('"', '""')}"`
}

function lookupKey(date: string, home: TeamAbbr, away: TeamAbbr) {
  return `${date.replaceAll('-', '')}${home}${away}`
}

function freshnessLabel(timestamp?: string | null) {
  if (!timestamp) return 'Unknown'
  const mins = Math.round((Date.now() - new Date(timestamp).getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}

function isUpcomingGame(row: ScheduleRow) {
  if (!row.game.gameDateIso) return true
  const firstPitch = new Date(row.game.gameDateIso).getTime()
  if (Number.isNaN(firstPitch)) return true
  return firstPitch > Date.now()
}

function feedChipClass({
  attempted,
  failed,
  eligibleCount,
  updatedCount,
}: {
  attempted: boolean
  failed: boolean
  eligibleCount: number
  updatedCount: number
}) {
  if (!attempted) return ''
  if (failed || updatedCount === 0) return 'error-chip'
  if (updatedCount === eligibleCount) return 'live-chip'
  return 'pending-chip'
}

function weatherNote(row: ScheduleRow, teams: Record<TeamAbbr, TeamStats>) {
  const park = teams[row.game.homeTeam].parkFactor
  return `${row.temperature}F with ${row.windDirection.toLowerCase()} wind at ${row.windMph} mph · park ${park}`
}

function headerOddsSummary(odds: OddsInput) {
  return `ML ${signed(odds.awayMoneyline)}/${signed(odds.homeMoneyline)} · RL ${signed(odds.runLine)} (${signed(odds.runLineAwayOdds)}/${signed(odds.runLineHomeOdds)}) · O/U ${odds.overUnder.toFixed(1)} (${signed(odds.overOdds)}/${signed(odds.underOdds)})`
}

function formatHeaderCompositeRecommendation(row: ScheduleRow, composite: CompositeRecommendation | null) {
  if (!composite || composite.pick === 'PASS' || composite.primaryMarket === 'PASS') return 'PASS'

  if (composite.primaryMarket === 'OU') {
    const price = composite.pick === 'OVER' ? row.odds.overOdds : row.odds.underOdds
    return `${composite.pick} ${row.odds.overUnder.toFixed(1)} ${signed(price)}`
  }

  if (composite.primaryMarket === 'RL') {
    const isHomeSide = composite.pick.includes(row.game.homeTeam)
    const price = isHomeSide ? row.odds.runLineHomeOdds : row.odds.runLineAwayOdds
    return `${composite.pick} ${signed(price)}`
  }

  if (composite.primaryMarket === 'ML') {
    const price = composite.pick.startsWith('HOME') ? row.odds.homeMoneyline : row.odds.awayMoneyline
    return `${composite.pick} ${signed(price)}`
  }

  return composite.pick
}

function formatCompositeCardPick(row: ScheduleRow, composite: CompositeRecommendation) {
  if (composite.pass || composite.pick === 'PASS' || composite.primaryMarket === 'PASS') return 'PASS'

  if (composite.primaryMarket === 'OU') {
    const price = composite.pick === 'OVER' ? row.odds.overOdds : row.odds.underOdds
    return `${composite.pick} ${row.odds.overUnder.toFixed(1)} ${signed(price)}`
  }

  if (composite.primaryMarket === 'RL') {
    const isHomeSide = composite.pick.includes('HOME')
    const sidePrice = isHomeSide ? row.odds.runLineHomeOdds : row.odds.runLineAwayOdds
    return `${composite.pick} ${signed(sidePrice)}`
  }

  if (composite.primaryMarket === 'ML') {
    const isHomeSide = composite.pick.startsWith('HOME')
    const moneyline = isHomeSide ? row.odds.homeMoneyline : row.odds.awayMoneyline
    return `${composite.pick} ${signed(moneyline)}`
  }

  return composite.pick
}

function formatCompositeTierScore(composite: CompositeRecommendation) {
  return composite.pass ? 'Tier PASS · Score 0.0/10' : `Tier ${composite.tier} · Score ${composite.score.toFixed(1)}/10`
}

function compositeTierClass(composite: CompositeRecommendation) {
  if (composite.pass || composite.tier === 'PASS') return 'market-edge-pass'
  if (composite.tier === 'C') return 'market-edge-c'
  if (composite.tier === 'B') return 'market-edge-b'
  return 'market-edge-a'
}

function displayTeamName(team: TeamAbbr, teams: Record<TeamAbbr, TeamStats>) {
  const cityLabel: Partial<Record<TeamAbbr, string>> = {
    NYY: 'NY',
    NYM: 'NY',
    SF: 'SF',
    SD: 'SD',
    KC: 'KC',
    TB: 'TB',
    STL: 'STL',
    LAA: 'LA',
    LAD: 'LA',
    CWS: 'Chi',
    CHC: 'Chi',
  }

  return `${cityLabel[team] ?? team} ${teams[team].name}`
}

function exportTeamLabel(team: TeamAbbr, teams: Record<TeamAbbr, TeamStats>) {
  return `${team} ${teams[team].name}`
}

function awaySplitRating(row: ScheduleRow, teams: Record<TeamAbbr, TeamStats>) {
  return row.homeStarter.hand === 'L' ? teams[row.game.awayTeam].offenseVsL : teams[row.game.awayTeam].offenseVsR
}

function homeSplitRating(row: ScheduleRow, teams: Record<TeamAbbr, TeamStats>) {
  return row.awayStarter.hand === 'L' ? teams[row.game.homeTeam].offenseVsL : teams[row.game.homeTeam].offenseVsR
}

function ratingEdgeSummary(row: ScheduleRow, teams: Record<TeamAbbr, TeamStats>) {
  const awayAttack = awaySplitRating(row, teams)
  const homeAttack = homeSplitRating(row, teams)
  const bullpenEdge = teams[row.game.homeTeam].bullpen - teams[row.game.awayTeam].bullpen
  const attackLeader = homeAttack > awayAttack ? `${row.game.homeTeam} offense edge` : awayAttack > homeAttack ? `${row.game.awayTeam} offense edge` : 'Offense ratings even'
  const bullpenLeader = bullpenEdge > 0 ? `${row.game.homeTeam} bullpen +${bullpenEdge}` : bullpenEdge < 0 ? `${row.game.awayTeam} bullpen +${Math.abs(bullpenEdge)}` : 'Bullpens even'
  return `${attackLeader} · ${bullpenLeader}`
}

function sharpSummary(row: ScheduleRow) {
  if (!row.sharpInput) return 'No sharp read'
  return `Steam ${row.sharpInput.steamLean.toUpperCase()} · Reverse ${row.sharpInput.reverseLean.toUpperCase()} · ${freshnessLabel(row.sharpInput.lastUpdated)}`
}

function formatOpeningMoneyline(row: ScheduleRow) {
  if (!row.sharpInput?.openingHomeMoneyline || !row.sharpInput?.openingAwayMoneyline) return 'N/A'
  return `${signed(row.sharpInput.openingAwayMoneyline)} / ${signed(row.sharpInput.openingHomeMoneyline)}`
}

function splitLabel(moneyPct: number | null | undefined, betsPct: number | null | undefined) {
  if (moneyPct == null || betsPct == null) return 'N/A'
  const gap = moneyPct - betsPct
  return `${moneyPct}% money vs ${betsPct}% bets (${gap > 0 ? '+' : ''}${gap}%)`
}

function signed(value: number) {
  return `${value > 0 ? '+' : ''}${value}`
}

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}

function subtractOneDay(date: string) {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() - 1)
  return value.toISOString().slice(0, 10)
}

function cardFeedFlags(row: ScheduleRow) {
  const flags: string[] = []
  if (row.odds.source === 'model') flags.push('Market fallback active')
  if (!row.weatherLastUpdated) flags.push('Weather fallback active')
  if (!row.lineupLastUpdated) flags.push('Lineups not posted')
  else if (row.awayLineupConfidence !== 'Confirmed' || row.homeLineupConfidence !== 'Confirmed') flags.push('Lineups still partial')
  return flags
}

function feedHealthSummary(row: ScheduleRow) {
  return [
    row.odds.source === 'espn' ? 'live odds attached' : row.odds.source === 'manual' ? 'manual odds loaded' : 'using model default odds',
    row.weatherLastUpdated ? 'weather feed live' : 'weather using neutral fallback',
    row.lineupLastUpdated ? 'lineup feed checked' : 'lineup feed still pending',
  ].join(' · ')
}

function oddsSourceLabel(source: OddsInput['source']) {
  if (source === 'espn') return 'ESPN live'
  if (source === 'manual') return 'Manual'
  return 'Model default'
}

function lineupStatusMark(confidence: ScheduleRow['awayLineupConfidence']) {
  return (
    <span className={confidence === 'Confirmed' ? 'status-mark-good' : 'status-mark-bad'}>
      {confidence === 'Confirmed' ? '✓' : 'x'}
    </span>
  )
}

function ratingDetailLine(items: Array<[string, number, string]>) {
  return (
    <>
      {items.map(([label, value, help], index) => (
        <span key={label} title={help} className="rating-stat" aria-label={`${label}: ${value}. ${help}`}>
          {index > 0 ? ' · ' : ''}
          {label} {value}
        </span>
      ))}
    </>
  )
}

