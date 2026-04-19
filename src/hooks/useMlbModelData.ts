import { useState } from 'react'

import { TEAMS } from '../lib/mlbModel'
import { fetchTeamRatings } from '../lib/mlbApi'
import type { TeamAbbr, TeamStats } from '../lib/mlbTypes'

export type MlbModelDataState = {
  teams: Record<TeamAbbr, TeamStats>
  leagueAvgRunsPerGame: number
  teamDataTone: 'neutral' | 'success' | 'error'
  teamDataStatus: string
  teamsUpdated: boolean
  teamsUpdatedAt: string | null
  loadedSeason: number | null
  // eslint-disable-next-line no-unused-vars
  fetchTeamData: (...args: [string]) => Promise<void>
}

export function useMlbModelData(): MlbModelDataState {
  const [teams, setTeams] = useState<Record<TeamAbbr, TeamStats>>(TEAMS)
  const [leagueAvgRunsPerGame, setLeagueAvgRunsPerGame] = useState(4.35)
  const [teamDataTone, setTeamDataTone] = useState<'neutral' | 'success' | 'error'>('neutral')
  const [teamDataStatus, setTeamDataStatus] = useState('Fetch MLB data to update the team ratings used by the model.')
  const [teamsUpdatedAt, setTeamsUpdatedAt] = useState<string | null>(null)
  const [loadedSeason, setLoadedSeason] = useState<number | null>(null)

  const fetchTeamData = async (date: string) => {
    const season = Number.parseInt(date.slice(0, 4), 10)
    setTeamDataTone('neutral')

    try {
      const snapshot = await fetchTeamRatings(season)
      setTeams(snapshot.teams)
      setLeagueAvgRunsPerGame(snapshot.leagueAvgRunsPerGame)
      setTeamsUpdatedAt(snapshot.fetchedAt)
      setLoadedSeason(snapshot.sourceSeason)
      setTeamDataTone('success')
      setTeamDataStatus(`Teams updated at ${formatTimestamp(snapshot.fetchedAt)} using ${snapshot.sourceSeason} MLB team stats.`)
    } catch (error) {
      setTeamDataTone('error')
      setTeamDataStatus(
        error instanceof Error
          ? `MLB team update failed at ${formatTimestamp(new Date().toISOString())}. ${error.message}`
          : `MLB team update failed at ${formatTimestamp(new Date().toISOString())}.`,
      )
    }
  }

  return {
    teams,
    leagueAvgRunsPerGame,
    teamDataTone,
    teamDataStatus,
    teamsUpdated: teamDataTone === 'success',
    teamsUpdatedAt,
    loadedSeason,
    fetchTeamData,
  }
}

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}
