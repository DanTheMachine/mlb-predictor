export type TeamAbbr =
  | 'ARI'
  | 'ATL'
  | 'BAL'
  | 'BOS'
  | 'CHC'
  | 'CIN'
  | 'CLE'
  | 'COL'
  | 'CWS'
  | 'DET'
  | 'HOU'
  | 'KC'
  | 'LAA'
  | 'LAD'
  | 'MIA'
  | 'MIL'
  | 'MIN'
  | 'NYM'
  | 'NYY'
  | 'OAK'
  | 'PHI'
  | 'PIT'
  | 'SD'
  | 'SEA'
  | 'SF'
  | 'STL'
  | 'TB'
  | 'TEX'
  | 'TOR'
  | 'WSH'

export type GameType = 'Regular Season' | 'Postseason'

export type Handedness = 'L' | 'R'

export type BullpenFatigue = 'Fresh' | 'Used' | 'Taxed'

export type LineupConfidence = 'Confirmed' | 'Projected' | 'Thin'

export type WindDirection = 'In' | 'Out' | 'Cross' | 'Neutral'

export type TeamStats = {
  abbr: TeamAbbr
  name: string
  color: string
  alt: string
  league: 'AL' | 'NL'
  division: string
  offenseVsR: number
  offenseVsL: number
  power: number
  discipline: number
  contact: number
  baserunning: number
  defense: number
  bullpen: number
  parkFactor: number
  recentRunsPerGame?: number
}

export type StarterStats = {
  id: string
  team: TeamAbbr
  name: string
  hand: Handedness
  era: number
  fip: number
  whip: number
  kRate: number
  bbRate: number
  hr9: number
  inningsPerStart: number
  pitchingRating: number
  role: 'Ace' | 'Mid-Rotation' | 'Back-End'
  recentPitchCount: number
  daysRest: number
}

export type BullpenWorkload = {
  last3DaysPitchCount: number
  highLeverageUsage: number
  closerAvailable: boolean
}

export type OddsInput = {
  source: 'manual' | 'espn' | 'model'
  homeMoneyline: number
  awayMoneyline: number
  runLine: number
  runLineHomeOdds: number
  runLineAwayOdds: number
  overUnder: number
  overOdds: number
  underOdds: number
}

export type ManualOddsForm = {
  homeMoneyline: string
  awayMoneyline: string
  runLine: string
  runLineHomeOdds: string
  runLineAwayOdds: string
  overUnder: string
  overOdds: string
  underOdds: string
}

export type PredictionFeature = {
  label: string
  good: boolean
  detail: string
}

export type PredictionResult = {
  projectedHomeRuns: number
  projectedAwayRuns: number
  projectedTotal: number
  projectedMargin: number
  homeWinProb: number
  awayWinProb: number
  homeRunLineCoverProb: number
  awayRunLineCoverProb: number
  overProb: number
  underProb: number
  homeStarterInnings: number
  awayStarterInnings: number
  modelLean: string
  features: PredictionFeature[]
}

export type BettingAnalysis = {
  homeImpliedProb: number
  awayImpliedProb: number
  homeEdge: number
  awayEdge: number
  mlValueSide: 'home' | 'away' | 'none'
  mlValuePct: number
  runLineRec: string
  runLineEdge: number
  ouRec: 'over' | 'under' | 'pass'
  ouEdge: number
  ouEdgePct: number
  homeCoverProb: number
  awayCoverProb: number
  pOver: number
  pUnder: number
  kellyHome: number
  kellyAway: number
  kellyRunLine: number
  kellyOU: number
}

export type AvailabilityNote = {
  team: TeamAbbr
  note: string
  impact: 'low' | 'medium' | 'high'
  lastUpdated: string
}

export type RecentFormSummary = {
  team: TeamAbbr
  last10Record: string
  runsScoredPerGame: number
  runsAllowedPerGame: number
  bullpenTrend: string
  lastUpdated: string
}

export type SharpSignalInput = {
  source: string
  lastUpdated: string
  openingHomeMoneyline: number | null
  openingAwayMoneyline: number | null
  openingTotal: number | null
  moneylineHomeBetsPct: number | null
  moneylineHomeMoneyPct: number | null
  totalOverBetsPct: number | null
  totalOverMoneyPct: number | null
  steamLean: 'home' | 'away' | 'over' | 'under' | 'none'
  reverseLean: 'home' | 'away' | 'over' | 'under' | 'none'
}

export type CompositeRecommendation = {
  primaryMarket: 'ML' | 'RL' | 'OU' | 'PASS'
  pick: string
  score: number
  tier: 'A' | 'B' | 'C' | 'PASS'
  pass: boolean
  reasons: string[]
}

export type ScheduleGame = {
  awayTeam: TeamAbbr
  homeTeam: TeamAbbr
  gameTime: string
  gameDateIso?: string
}

export type ScheduleRow = {
  game: ScheduleGame
  awayStarter: StarterStats
  homeStarter: StarterStats
  starterLastUpdated: string
  awayBullpenFatigue: BullpenFatigue
  homeBullpenFatigue: BullpenFatigue
  awayBullpenWorkload: BullpenWorkload
  homeBullpenWorkload: BullpenWorkload
  awayLineupConfidence: LineupConfidence
  homeLineupConfidence: LineupConfidence
  lineupLastUpdated: string
  temperature: number
  windMph: number
  windDirection: WindDirection
  weatherLastUpdated: string
  availabilityNotes: AvailabilityNote[]
  recentForm: {
    away: RecentFormSummary
    home: RecentFormSummary
  }
  sharpInput: SharpSignalInput | null
  compositeRecommendation: CompositeRecommendation | null
  odds: OddsInput
  result: PredictionResult | null
}

export type PredictGameInput = {
  homeTeam: TeamStats
  awayTeam: TeamStats
  homeStarter: StarterStats
  awayStarter: StarterStats
  gameType: GameType
  temperature: number
  windMph: number
  windDirection: WindDirection
  homeBullpenFatigue: BullpenFatigue
  awayBullpenFatigue: BullpenFatigue
  homeBullpenWorkload: BullpenWorkload
  awayBullpenWorkload: BullpenWorkload
  homeLineupConfidence: LineupConfidence
  awayLineupConfidence: LineupConfidence
  leagueAvgRunsPerGame?: number
}
