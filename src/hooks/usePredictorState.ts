import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import { fetchEspnGameOdds } from '../lib/mlbApi'
import {
  BULLPEN_FATIGUE_OPTIONS,
  createDefaultBullpenWorkload,
  GAME_TYPES,
  getDefaultStarter,
  getStarterById,
  getStartersForTeam,
  LINEUP_CONFIDENCE_OPTIONS,
  predictGame,
  TEAMS,
  TEAM_ORDER,
  WIND_DIRECTION_OPTIONS,
} from '../lib/mlbModel'
import type {
  BullpenFatigue,
  BullpenWorkload,
  GameType,
  LineupConfidence,
  ManualOddsForm,
  OddsInput,
  PredictionResult,
  TeamAbbr,
  TeamStats,
  WindDirection,
} from '../lib/mlbTypes'

export type PredictorState = {
  teams: Record<TeamAbbr, TeamStats>
  teamOrder: TeamAbbr[]
  homeTeam: TeamAbbr
  setHomeTeam: Dispatch<SetStateAction<TeamAbbr>>
  awayTeam: TeamAbbr
  setAwayTeam: Dispatch<SetStateAction<TeamAbbr>>
  homeStarterId: string
  setHomeStarterId: Dispatch<SetStateAction<string>>
  awayStarterId: string
  setAwayStarterId: Dispatch<SetStateAction<string>>
  homeStarterOptions: ReturnType<typeof getStartersForTeam>
  awayStarterOptions: ReturnType<typeof getStartersForTeam>
  gameType: GameType
  setGameType: Dispatch<SetStateAction<GameType>>
  temperature: number
  setTemperature: Dispatch<SetStateAction<number>>
  windMph: number
  setWindMph: Dispatch<SetStateAction<number>>
  windDirection: WindDirection
  setWindDirection: Dispatch<SetStateAction<WindDirection>>
  homeBullpenFatigue: BullpenFatigue
  setHomeBullpenFatigue: Dispatch<SetStateAction<BullpenFatigue>>
  awayBullpenFatigue: BullpenFatigue
  setAwayBullpenFatigue: Dispatch<SetStateAction<BullpenFatigue>>
  homeBullpenWorkload: BullpenWorkload
  setHomeBullpenWorkload: Dispatch<SetStateAction<BullpenWorkload>>
  awayBullpenWorkload: BullpenWorkload
  setAwayBullpenWorkload: Dispatch<SetStateAction<BullpenWorkload>>
  homeLineupConfidence: LineupConfidence
  setHomeLineupConfidence: Dispatch<SetStateAction<LineupConfidence>>
  awayLineupConfidence: LineupConfidence
  setAwayLineupConfidence: Dispatch<SetStateAction<LineupConfidence>>
  gameTypes: readonly GameType[]
  bullpenOptions: readonly BullpenFatigue[]
  lineupOptions: readonly LineupConfidence[]
  windOptions: readonly WindDirection[]
  manualOdds: ManualOddsForm
  setManualOdds: Dispatch<SetStateAction<ManualOddsForm>>
  odds: OddsInput
  oddsSource: 'manual' | 'espn' | 'fetching'
  oddsStatus: string
  homeStarterName: string
  awayStarterName: string
  result: PredictionResult
  status: string
  fetchEspnData: () => Promise<void>
  runProjection: () => void
}

const DEFAULT_ODDS: ManualOddsForm = {
  homeMoneyline: '-145',
  awayMoneyline: '+125',
  runLine: '-1.5',
  runLineHomeOdds: '+135',
  runLineAwayOdds: '-160',
  overUnder: '8.0',
  overOdds: '-110',
  underOdds: '-110',
}

function parseOdds(form: ManualOddsForm): OddsInput {
  return {
    source: 'manual',
    homeMoneyline: Number(form.homeMoneyline),
    awayMoneyline: Number(form.awayMoneyline),
    runLine: Number(form.runLine),
    runLineHomeOdds: Number(form.runLineHomeOdds),
    runLineAwayOdds: Number(form.runLineAwayOdds),
    overUnder: Number(form.overUnder),
    overOdds: Number(form.overOdds),
    underOdds: Number(form.underOdds),
  }
}

function toManualOddsForm(odds: OddsInput): ManualOddsForm {
  return {
    homeMoneyline: String(odds.homeMoneyline),
    awayMoneyline: String(odds.awayMoneyline),
    runLine: String(odds.runLine),
    runLineHomeOdds: String(odds.runLineHomeOdds > 0 ? `+${odds.runLineHomeOdds}` : odds.runLineHomeOdds),
    runLineAwayOdds: String(odds.runLineAwayOdds > 0 ? `+${odds.runLineAwayOdds}` : odds.runLineAwayOdds),
    overUnder: String(odds.overUnder),
    overOdds: String(odds.overOdds > 0 ? `+${odds.overOdds}` : odds.overOdds),
    underOdds: String(odds.underOdds > 0 ? `+${odds.underOdds}` : odds.underOdds),
  }
}

export function usePredictorState(teams: Record<TeamAbbr, TeamStats>): PredictorState {
  const [homeTeam, setHomeTeam] = useState<TeamAbbr>('LAD')
  const [awayTeam, setAwayTeam] = useState<TeamAbbr>('ATL')
  const [homeStarterId, setHomeStarterId] = useState(getDefaultStarter('LAD').id)
  const [awayStarterId, setAwayStarterId] = useState(getDefaultStarter('ATL').id)
  const [gameType, setGameType] = useState<GameType>('Regular Season')
  const [temperature, setTemperature] = useState(74)
  const [windMph, setWindMph] = useState(8)
  const [windDirection, setWindDirection] = useState<WindDirection>('Out')
  const [homeBullpenFatigue, setHomeBullpenFatigue] = useState<BullpenFatigue>('Fresh')
  const [awayBullpenFatigue, setAwayBullpenFatigue] = useState<BullpenFatigue>('Used')
  const [homeBullpenWorkload, setHomeBullpenWorkload] = useState<BullpenWorkload>(() => createDefaultBullpenWorkload('Fresh'))
  const [awayBullpenWorkload, setAwayBullpenWorkload] = useState<BullpenWorkload>(() => createDefaultBullpenWorkload('Used'))
  const [homeLineupConfidence, setHomeLineupConfidence] = useState<LineupConfidence>('Confirmed')
  const [awayLineupConfidence, setAwayLineupConfidence] = useState<LineupConfidence>('Projected')
  const [manualOdds, setManualOdds] = useState<ManualOddsForm>(DEFAULT_ODDS)
  const [oddsSource, setOddsSource] = useState<'manual' | 'espn' | 'fetching'>('manual')
  const [oddsStatus, setOddsStatus] = useState('Manual odds loaded. Fetch ESPN data to refresh the market.')

  const homeStarterOptions = useMemo(() => getStartersForTeam(homeTeam), [homeTeam])
  const awayStarterOptions = useMemo(() => getStartersForTeam(awayTeam), [awayTeam])
  const homeStarter = getStarterById(homeTeam, homeStarterId)
  const awayStarter = getStarterById(awayTeam, awayStarterId)

  useEffect(() => {
    setHomeStarterId(getDefaultStarter(homeTeam).id)
  }, [homeTeam])

  useEffect(() => {
    setAwayStarterId(getDefaultStarter(awayTeam).id)
  }, [awayTeam])

  const [result, setResult] = useState<PredictionResult>(() =>
      predictGame({
      homeTeam: teams.LAD,
      awayTeam: teams.ATL,
      homeStarter: getDefaultStarter('LAD'),
      awayStarter: getDefaultStarter('ATL'),
      gameType: 'Regular Season',
      temperature: 74,
      windMph: 8,
      windDirection: 'Out',
      homeBullpenFatigue: 'Fresh',
      awayBullpenFatigue: 'Used',
      homeBullpenWorkload: createDefaultBullpenWorkload('Fresh'),
      awayBullpenWorkload: createDefaultBullpenWorkload('Used'),
      homeLineupConfidence: 'Confirmed',
      awayLineupConfidence: 'Projected',
    }),
  )

  const odds = useMemo(() => parseOdds(manualOdds), [manualOdds])

  const fetchEspnData = async () => {
    setOddsSource('fetching')
    setOddsStatus(`Checking ESPN for ${awayTeam} at ${homeTeam}...`)

    try {
      const fetchedOdds = await fetchEspnGameOdds(homeTeam, awayTeam)
      if (!fetchedOdds) {
        setOddsSource('manual')
        setOddsStatus(`ESPN did not have odds posted yet for ${awayTeam} at ${homeTeam}.`)
        return
      }

      setManualOdds(toManualOddsForm(fetchedOdds))
      setOddsSource('espn')
      setOddsStatus(`Loaded ESPN odds for ${awayTeam} at ${homeTeam}.`)
    } catch (error) {
      setOddsSource('manual')
      setOddsStatus(error instanceof Error ? error.message : 'Unable to fetch ESPN data right now.')
    }
  }

  const runProjection = () => {
    setResult(
      predictGame({
        awayTeam: teams[awayTeam],
        homeTeam: teams[homeTeam],
        homeStarter,
        awayStarter,
        gameType,
        temperature,
        windMph,
        windDirection,
        homeBullpenFatigue,
        awayBullpenFatigue,
        homeBullpenWorkload,
        awayBullpenWorkload,
        homeLineupConfidence,
        awayLineupConfidence,
      }),
    )
  }

  return {
    teams,
    teamOrder: [...TEAM_ORDER],
    homeTeam,
    setHomeTeam,
    awayTeam,
    setAwayTeam,
    homeStarterId,
    setHomeStarterId,
    awayStarterId,
    setAwayStarterId,
    homeStarterOptions,
    awayStarterOptions,
    gameType,
    setGameType,
    temperature,
    setTemperature,
    windMph,
    setWindMph,
    windDirection,
    setWindDirection,
    homeBullpenFatigue,
    setHomeBullpenFatigue,
    awayBullpenFatigue,
    setAwayBullpenFatigue,
    homeBullpenWorkload,
    setHomeBullpenWorkload,
    awayBullpenWorkload,
    setAwayBullpenWorkload,
    homeLineupConfidence,
    setHomeLineupConfidence,
    awayLineupConfidence,
    setAwayLineupConfidence,
    gameTypes: GAME_TYPES,
    bullpenOptions: BULLPEN_FATIGUE_OPTIONS,
    lineupOptions: LINEUP_CONFIDENCE_OPTIONS,
    windOptions: WIND_DIRECTION_OPTIONS,
    manualOdds,
    setManualOdds,
    odds,
    oddsSource,
    oddsStatus,
    homeStarterName: homeStarter.name,
    awayStarterName: awayStarter.name,
    result,
    status: `${teams[awayTeam].name} at ${teams[homeTeam].name} with ${awayStarter.name} vs ${homeStarter.name}`,
    fetchEspnData,
    runProjection,
  }
}
