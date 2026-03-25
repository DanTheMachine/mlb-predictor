import type { TeamAbbr, TeamStats } from './mlbTypes'

export type TeamStatMap = Partial<Record<TeamAbbr, Record<string, number>>>

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value))
}

function asNumber(value: number | string | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function metricFor(
  source: TeamStatMap,
  team: TeamAbbr,
  names: string[],
  fallback = 0,
) {
  const stats = source[team]
  if (!stats) return fallback

  for (const name of names) {
    if (name in stats) {
      return asNumber(stats[name])
    }
  }

  return fallback
}

function normalizedScore(values: Partial<Record<TeamAbbr, number>>, team: TeamAbbr, center = 100, scale = 12) {
  const series = Object.values(values).filter((value): value is number => Number.isFinite(value))
  const value = values[team]
  if (!series.length || value == null) return center

  const mean = series.reduce((sum, entry) => sum + entry, 0) / series.length
  const variance = series.reduce((sum, entry) => sum + (entry - mean) ** 2, 0) / series.length
  const stdDev = Math.sqrt(variance) || 1
  return clamp(center + ((value - mean) / stdDev) * scale, 84, 118)
}

function roundRating(value: number) {
  return Math.round(clamp(value, 84, 118))
}

export function buildTeamRatingsFromStats(args: {
  baseTeams: Record<TeamAbbr, TeamStats>
  hitting: TeamStatMap
  hittingVsR?: TeamStatMap
  hittingVsL?: TeamStatMap
  pitching: TeamStatMap
  fielding: TeamStatMap
}): Record<TeamAbbr, TeamStats> {
  const { baseTeams, hitting, hittingVsR = {}, hittingVsL = {}, pitching, fielding } = args
  const teams = Object.keys(baseTeams) as TeamAbbr[]

  const offenseVsRInputs: Partial<Record<TeamAbbr, number>> = {}
  const offenseVsLInputs: Partial<Record<TeamAbbr, number>> = {}
  const powerInputs: Partial<Record<TeamAbbr, number>> = {}
  const disciplineInputs: Partial<Record<TeamAbbr, number>> = {}
  const contactInputs: Partial<Record<TeamAbbr, number>> = {}
  const baserunningInputs: Partial<Record<TeamAbbr, number>> = {}
  const defenseInputs: Partial<Record<TeamAbbr, number>> = {}
  const bullpenInputs: Partial<Record<TeamAbbr, number>> = {}

  for (const team of teams) {
    const overallOps = metricFor(hitting, team, ['ops'], 0.72)
    const overallRuns = metricFor(hitting, team, ['runs'], 650)
    const overallGames = metricFor(hitting, team, ['gamesPlayed', 'games'], 162)
    const runsPerGame = overallGames > 0 ? overallRuns / overallGames : 4.2
    const overallObp = metricFor(hitting, team, ['obp'], 0.315)
    const overallAvg = metricFor(hitting, team, ['avg'], 0.245)
    const overallSlg = metricFor(hitting, team, ['slg', 'slugging'], 0.39)
    const overallBb = metricFor(hitting, team, ['baseOnBalls', 'walks'], 500)
    const overallSo = metricFor(hitting, team, ['strikeOuts'], 1350)
    const plateAppearances = metricFor(hitting, team, ['plateAppearances'], 6200)
    const steals = metricFor(hitting, team, ['stolenBases'], 90)
    const stealPct = metricFor(hitting, team, ['stolenBasePercentage'], 0.74)

    const splitVsR =
      metricFor(hittingVsR, team, ['ops'], 0) ||
      overallOps - 0.01 + (overallObp - 0.315) * 0.08
    const splitVsL =
      metricFor(hittingVsL, team, ['ops'], 0) ||
      overallOps + 0.005 + (overallSlg - 0.39) * 0.05

    const walkRate = plateAppearances > 0 ? overallBb / plateAppearances : 0.08
    const strikeoutRate = plateAppearances > 0 ? overallSo / plateAppearances : 0.22

    const pitchingEra = metricFor(pitching, team, ['era'], 4.25)
    const pitchingWhip = metricFor(pitching, team, ['whip'], 1.28)
    const pitchingSo = metricFor(pitching, team, ['strikeOuts'], 1350)
    const pitchingBb = metricFor(pitching, team, ['baseOnBalls', 'walks'], 520)
    const pitchingHr = metricFor(pitching, team, ['homeRuns'], 180)
    const saves = metricFor(pitching, team, ['saves'], 38)
    const saveOpportunities = metricFor(pitching, team, ['saveOpportunities'], 60)
    const holds = metricFor(pitching, team, ['holds'], 70)
    const inningsPitched = metricFor(pitching, team, ['inningsPitched'], 1450)
    const strikeoutRatePitch = inningsPitched > 0 ? pitchingSo / inningsPitched : 0.93
    const walkRatePitch = inningsPitched > 0 ? pitchingBb / inningsPitched : 0.36

    const fieldingPct = metricFor(fielding, team, ['fielding', 'fieldingPercentage'], 0.985)
    const errors = metricFor(fielding, team, ['errors'], 85)
    const doublePlays = metricFor(fielding, team, ['doublePlays'], 135)

    offenseVsRInputs[team] = splitVsR * 0.7 + runsPerGame * 0.3
    offenseVsLInputs[team] = splitVsL * 0.7 + runsPerGame * 0.3
    powerInputs[team] = overallSlg * 0.72 + (overallSlg - overallAvg) * 0.6 + runsPerGame * 0.08
    disciplineInputs[team] = overallObp * 0.7 + walkRate * 1.7 - strikeoutRate * 0.3
    contactInputs[team] = overallAvg * 0.8 + (1 - strikeoutRate) * 0.4
    baserunningInputs[team] = steals * 0.01 + stealPct * 0.7 + runsPerGame * 0.02
    defenseInputs[team] = fieldingPct * 0.7 - errors * 0.002 + doublePlays * 0.002
    bullpenInputs[team] =
      -pitchingEra * 0.5 -
      pitchingWhip * 0.32 -
      pitchingHr * 0.002 +
      strikeoutRatePitch * 0.9 -
      walkRatePitch * 0.8 +
      (saveOpportunities > 0 ? saves / saveOpportunities : 0.6) * 0.8 +
      holds * 0.006
  }

  return Object.fromEntries(
    teams.map((team) => {
      const base = baseTeams[team]
      return [
        team,
        {
          ...base,
          offenseVsR: roundRating(normalizedScore(offenseVsRInputs, team)),
          offenseVsL: roundRating(normalizedScore(offenseVsLInputs, team)),
          power: roundRating(normalizedScore(powerInputs, team)),
          discipline: roundRating(normalizedScore(disciplineInputs, team)),
          contact: roundRating(normalizedScore(contactInputs, team)),
          baserunning: roundRating(normalizedScore(baserunningInputs, team)),
          defense: roundRating(normalizedScore(defenseInputs, team)),
          bullpen: roundRating(normalizedScore(bullpenInputs, team)),
        } satisfies TeamStats,
      ]
    }),
  ) as Record<TeamAbbr, TeamStats>
}
