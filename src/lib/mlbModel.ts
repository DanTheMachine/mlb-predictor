import type {
  BullpenFatigue,
  BullpenWorkload,
  GameType,
  LineupConfidence,
  PredictGameInput,
  PredictionFeature,
  PredictionResult,
  RunCalcSteps,
  StarterStats,
  TeamAbbr,
  TeamStats,
  WindDirection,
} from './mlbTypes'

export const GAME_TYPES: readonly GameType[] = ['Regular Season', 'Postseason']
export const BULLPEN_FATIGUE_OPTIONS: readonly BullpenFatigue[] = ['Fresh', 'Used', 'Taxed']
export const LINEUP_CONFIDENCE_OPTIONS: readonly LineupConfidence[] = ['Confirmed', 'Projected', 'Thin']
export const WIND_DIRECTION_OPTIONS: readonly WindDirection[] = ['Out', 'In', 'Cross', 'Neutral']

const TEAM_SEEDS: Array<
  [
    TeamAbbr,
    string,
    string,
    string,
    'AL' | 'NL',
    string,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ]
> = [
  ['ARI', 'Diamondbacks', '#A71930', '#E3D4AD', 'NL', 'NL West', 99, 97, 99, 95, 99, 94, 100, 94, 103],
  ['ATL', 'Braves', '#CE1141', '#13274F', 'NL', 'NL East', 108, 110, 112, 104, 105, 92, 107, 107, 100],
  ['BAL', 'Orioles', '#DF4601', '#000000', 'AL', 'AL East', 99, 99, 99, 97, 98, 105, 99, 106, 99],
  ['BOS', 'Red Sox', '#BD3039', '#0C2340', 'AL', 'AL East', 102, 98, 99, 101, 107, 103, 93, 106, 106],
  ['CHC', 'Cubs', '#0E3386', '#CC3433', 'NL', 'NL Central', 101, 100, 99, 106, 102, 98, 96, 96, 101],
  ['CIN', 'Reds', '#C6011F', '#000000', 'NL', 'NL Central', 92, 92, 94, 93, 92, 97, 105, 99, 106],
  ['CLE', 'Guardians', '#0C2340', '#E31937', 'AL', 'AL Central', 99, 102, 98, 99, 102, 106, 108, 103, 97],
  ['COL', 'Rockies', '#33006F', '#C4CED4', 'NL', 'NL West', 92, 92, 92, 93, 97, 90, 101, 98, 118],
  ['CWS', 'White Sox', '#27251F', '#C4CED4', 'AL', 'AL Central', 91, 90, 92, 94, 89, 95, 92, 88, 99],
  ['DET', 'Tigers', '#0C2340', '#FA4616', 'AL', 'AL Central', 103, 102, 100, 106, 102, 94, 96, 106, 96],
  ['HOU', 'Astros', '#EB6E1F', '#002D62', 'AL', 'AL West', 97, 98, 97, 103, 99, 103, 107, 101, 101],
  ['KC', 'Royals', '#004687', '#BD9B60', 'AL', 'AL Central', 92, 91, 90, 98, 97, 104, 105, 96, 100],
  ['LAA', 'Angels', '#BA0021', '#003263', 'AL', 'AL West', 98, 97, 101, 103, 99, 104, 92, 102, 101],
  ['LAD', 'Dodgers', '#005A9C', '#EF3E42', 'NL', 'NL West', 110, 109, 110, 106, 105, 107, 106, 106, 99],
  ['MIA', 'Marlins', '#00A3E0', '#EF3340', 'NL', 'NL East', 91, 93, 92, 97, 103, 103, 95, 105, 95],
  ['MIL', 'Brewers', '#12284B', '#FFC52F', 'NL', 'NL Central', 110, 110, 109, 110, 110, 101, 106, 107, 98],
  ['MIN', 'Twins', '#002B5C', '#D31145', 'AL', 'AL Central', 96, 95, 96, 101, 96, 102, 92, 103, 98],
  ['NYM', 'Mets', '#002D72', '#FF5910', 'NL', 'NL East', 111, 112, 110, 111, 105, 108, 104, 97, 98],
  ['NYY', 'Yankees', '#0C2340', '#C4CED4', 'AL', 'AL East', 106, 105, 106, 101, 101, 104, 100, 110, 102],
  ['OAK', 'Athletics', '#003831', '#EFB21E', 'AL', 'AL West', 93, 93, 95, 90, 91, 97, 103, 97, 100],
  ['PHI', 'Phillies', '#E81828', '#002D72', 'NL', 'NL East', 106, 103, 108, 96, 102, 105, 95, 104, 101],
  ['PIT', 'Pirates', '#FDB827', '#27251F', 'NL', 'NL Central', 102, 102, 104, 90, 100, 100, 92, 90, 98],
  ['SD', 'Padres', '#2F241D', '#FFC425', 'NL', 'NL West', 98, 98, 97, 97, 99, 98, 101, 96, 96],
  ['SEA', 'Mariners', '#0C2C56', '#005C5C', 'AL', 'AL West', 100, 101, 104, 101, 93, 93, 109, 104, 95],
  ['SF', 'Giants', '#FD5A1E', '#27251F', 'NL', 'NL West', 91, 92, 91, 93, 92, 95, 102, 100, 94],
  ['STL', 'Cardinals', '#C41E3A', '#0C2340', 'NL', 'NL Central', 107, 108, 107, 99, 110, 108, 103, 93, 100],
  ['TB', 'Rays', '#092C5C', '#8FBCE6', 'AL', 'AL East', 104, 103, 102, 109, 109, 101, 94, 93, 97],
  ['TEX', 'Rangers', '#003278', '#C0111F', 'AL', 'AL West', 99, 100, 101, 92, 99, 97, 104, 98, 104],
  ['TOR', 'Blue Jays', '#134A8E', '#1D2D5C', 'AL', 'AL East', 99, 97, 98, 103, 104, 96, 105, 104, 101],
  ['WSH', 'Nationals', '#AB0003', '#14225A', 'NL', 'NL East', 105, 106, 105, 96, 101, 110, 90, 98, 102],
]

type StarterSeed = [
  TeamAbbr,
  string,
  string,
  'L' | 'R',
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  'Ace' | 'Mid-Rotation' | 'Back-End',
  number,
  number,
]

const STARTER_SEEDS: StarterSeed[] = [
  // ARI
  ['ARI', 'ARI-1', 'Eduardo Rodriguez', 'L', 2.24, 3.74, 1.19, 17.6, 8.8, 0.62, 6.0, 115, 'Ace', 88, 5],
  ['ARI', 'ARI-2', 'Michael Soroka', 'R', 3.49, 2.87, 1.19, 23.6, 5.4, 0.67, 5.6, 107, 'Ace', 85, 5],
  ['ARI', 'ARI-3', 'Ryne Nelson', 'R', 4.82, 5.47, 1.19, 18.7, 6.8, 2.07, 5.4, 93, 'Back-End', 84, 5],
  ['ARI', 'ARI-4', 'Zac Gallen', 'R', 5.16, 4.89, 1.47, 16.1, 6.9, 1.52, 4.9, 91, 'Back-End', 82, 4],
  ['ARI', 'ARI-5', 'Merrill Kelly', 'R', 5.06, 5.64, 1.46, 14.1, 9.4, 1.69, 5.9, 88, 'Back-End', 84, 5],
  // ATL
  ['ATL', 'ATL-1', 'Chris Sale', 'L', 2.01, 2.74, 0.94, 30.2, 6.4, 0.81, 6.1, 118, 'Ace', 90, 5],
  ['ATL', 'ATL-2', 'Bryce Elder', 'R', 2.63, 3.37, 1.08, 20.9, 7.2, 0.69, 6.1, 113, 'Ace', 88, 5],
  ['ATL', 'ATL-3', 'Martín Pérez', 'L', 2.79, 4.13, 1.06, 20.5, 8.8, 1.05, 6.5, 112, 'Ace', 84, 5],
  ['ATL', 'ATL-4', 'Grant Holmes', 'R', 3.95, 5.16, 1.33, 21.7, 10.2, 1.74, 5.2, 99, 'Mid-Rotation', 83, 5],
  ['ATL', 'ATL-5', 'Spencer Strider', 'R', 3.77, 4.78, 1.26, 31.5, 13.4, 1.74, 5.2, 106, 'Mid-Rotation', 80, 5],
  // BAL
  ['BAL', 'BAL-1', 'Kyle Bradish', 'R', 3.44, 4.12, 1.42, 23.1, 11.7, 0.96, 5.4, 106, 'Mid-Rotation', 85, 5],
  ['BAL', 'BAL-2', 'Shane Baz', 'R', 4.29, 3.93, 1.37, 20.7, 9.5, 0.88, 5.9, 99, 'Mid-Rotation', 83, 5],
  ['BAL', 'BAL-3', 'Brandon Young', 'R', 3.35, 4.36, 1.37, 17.5, 9.0, 1.05, 5.4, 104, 'Mid-Rotation', 82, 5],
  ['BAL', 'BAL-4', 'Chris Bassitt', 'R', 5.06, 4.19, 1.58, 14.7, 8.2, 0.84, 5.9, 91, 'Back-End', 86, 5],
  ['BAL', 'BAL-5', 'Trevor Rogers', 'L', 6.84, 4.88, 1.56, 17.3, 8.2, 1.48, 4.9, 84, 'Back-End', 82, 4],
  // BOS
  ['BOS', 'BOS-1', 'Sonny Gray', 'R', 3.06, 3.44, 1.20, 19.9, 6.8, 0.72, 5.0, 109, 'Ace', 87, 5],
  ['BOS', 'BOS-2', 'Ranger Suarez', 'L', 3.38, 3.11, 1.16, 23.9, 8.0, 0.61, 5.3, 108, 'Ace', 86, 5],
  ['BOS', 'BOS-3', 'Connelly Early', 'R', 3.26, 4.50, 1.18, 22.7, 8.3, 1.49, 5.5, 108, 'Ace', 84, 5],
  ['BOS', 'BOS-4', 'Payton Tolle', 'R', 2.61, 2.72, 0.90, 28.6, 6.8, 0.65, 5.9, 114, 'Ace', 82, 5],
  ['BOS', 'BOS-5', 'Brayan Bello', 'R', 5.63, 5.22, 1.64, 15.6, 8.2, 1.61, 8.0, 88, 'Back-End', 88, 5],
  // CHC
  ['CHC', 'CHC-1', 'Shota Imanaga', 'L', 4.37, 4.41, 1.07, 24.3, 6.3, 1.67, 5.8, 100, 'Mid-Rotation', 87, 5],
  ['CHC', 'CHC-2', 'Edward Cabrera', 'R', 4.00, 4.50, 1.35, 20.7, 8.8, 1.33, 5.4, 102, 'Mid-Rotation', 84, 5],
  ['CHC', 'CHC-3', 'Colin Rea', 'R', 4.70, 4.53, 1.37, 19.1, 7.8, 1.37, 6.6, 96, 'Back-End', 86, 5],
  ['CHC', 'CHC-4', 'Jameson Taillon', 'R', 5.13, 6.33, 1.26, 20.4, 7.5, 2.70, 5.6, 93, 'Back-End', 84, 5],
  ['CHC', 'CHC-5', 'Ben Brown', 'R', 1.92, 2.27, 0.93, 26.4, 7.5, 0.17, 5.8, 118, 'Ace', 80, 5],
  // CIN
  ['CIN', 'CIN-1', 'Chase Burns', 'R', 1.96, 3.51, 0.96, 28.9, 8.0, 1.12, 5.8, 118, 'Ace', 85, 5],
  ['CIN', 'CIN-2', 'Andrew Abbott', 'R', 4.06, 4.89, 1.44, 15.8, 10.4, 1.18, 5.3, 99, 'Mid-Rotation', 82, 5],
  ['CIN', 'CIN-3', 'Rhett Lowder', 'R', 5.40, 3.88, 1.41, 16.3, 10.8, 0.47, 4.8, 92, 'Back-End', 80, 4],
  ['CIN', 'CIN-4', 'Chris Paddack', 'R', 6.90, 4.78, 1.71, 16.3, 7.9, 1.38, 5.1, 84, 'Back-End', 83, 5],
  ['CIN', 'CIN-5', 'Brady Singer', 'R', 6.18, 6.81, 1.69, 15.1, 6.7, 2.82, 4.6, 84, 'Back-End', 83, 4],
  // CLE
  ['CLE', 'CLE-1', 'Parker Messick', 'L', 2.21, 3.10, 1.07, 27.2, 7.7, 0.78, 5.8, 118, 'Ace', 87, 5],
  ['CLE', 'CLE-2', 'Gavin Williams', 'R', 3.07, 3.37, 1.09, 29.0, 7.9, 1.06, 6.4, 112, 'Ace', 89, 5],
  ['CLE', 'CLE-3', 'Joey Cantillo', 'L', 3.92, 4.72, 1.45, 21.1, 12.8, 1.16, 4.8, 102, 'Mid-Rotation', 82, 5],
  ['CLE', 'CLE-4', 'Tanner Bibee', 'R', 4.57, 4.87, 1.30, 20.7, 7.6, 1.70, 5.3, 97, 'Back-End', 86, 5],
  ['CLE', 'CLE-5', 'Slade Cecconi', 'R', 5.25, 4.45, 1.49, 18.4, 7.4, 1.31, 5.1, 91, 'Back-End', 83, 5],
  // COL
  ['COL', 'COL-1', 'Tomoyuki Sugano', 'R', 3.98, 5.17, 1.26, 13.6, 6.8, 1.56, 5.3, 100, 'Mid-Rotation', 84, 5],
  ['COL', 'COL-2', 'Ryan Feltner', 'R', 4.85, 5.16, 1.31, 17.6, 7.4, 1.73, 4.3, 91, 'Back-End', 80, 4],
  ['COL', 'COL-3', 'Jose Quintana', 'L', 5.27, 5.37, 1.51, 11.0, 9.4, 1.32, 4.6, 88, 'Back-End', 83, 4],
  ['COL', 'COL-4', 'Michael Lorenzen', 'R', 7.22, 5.01, 1.90, 15.4, 7.2, 1.57, 4.8, 84, 'Back-End', 83, 4],
  ['COL', 'COL-5', 'Kyle Freeland', 'L', 8.06, 5.87, 1.71, 18.7, 6.5, 2.44, 4.8, 84, 'Back-End', 80, 4],
  // CWS
  ['CWS', 'CWS-1', 'Davis Martin', 'R', 2.61, 2.43, 1.11, 25.3, 5.9, 0.37, 6.0, 114, 'Ace', 87, 5],
  ['CWS', 'CWS-2', 'Sean Burke', 'R', 3.72, 3.18, 1.13, 22.2, 6.7, 0.69, 6.5, 104, 'Mid-Rotation', 86, 5],
  ['CWS', 'CWS-3', 'Anthony Kay', 'L', 3.77, 4.80, 1.40, 16.3, 9.3, 1.26, 5.7, 100, 'Mid-Rotation', 83, 5],
  ['CWS', 'CWS-4', 'Noah Schultz', 'L', 5.82, 4.54, 1.34, 19.6, 13.1, 0.93, 4.8, 91, 'Back-End', 81, 4],
  ['CWS', 'CWS-5', 'Erick Fedde', 'R', 5.40, 6.39, 1.48, 14.4, 9.7, 2.19, 7.6, 88, 'Back-End', 85, 5],
  // DET
  ['DET', 'DET-1', 'Tarik Skubal', 'L', 2.70, 2.14, 0.95, 27.1, 3.6, 0.42, 6.2, 114, 'Ace', 90, 5],
  ['DET', 'DET-2', 'Casey Mize', 'R', 2.27, 2.44, 0.97, 26.5, 6.5, 0.38, 5.3, 117, 'Ace', 87, 5],
  ['DET', 'DET-3', 'Keider Montero', 'R', 3.69, 4.02, 1.00, 17.8, 6.2, 1.03, 5.5, 103, 'Mid-Rotation', 84, 5],
  ['DET', 'DET-4', 'Framber Valdez', 'L', 4.39, 4.06, 1.32, 18.3, 8.5, 0.93, 5.6, 98, 'Mid-Rotation', 88, 5],
  ['DET', 'DET-5', 'Jack Flaherty', 'R', 5.31, 4.24, 1.60, 25.8, 11.8, 1.25, 4.4, 92, 'Back-End', 88, 5],
  // HOU
  ['HOU', 'HOU-1', 'Spencer Arrighetti', 'R', 1.34, 3.58, 1.13, 21.7, 13.1, 0.38, 5.9, 118, 'Ace', 84, 5],
  ['HOU', 'HOU-2', 'Peter Lambert', 'R', 3.77, 3.27, 1.21, 22.6, 11.1, 0.40, 5.7, 104, 'Mid-Rotation', 84, 5],
  ['HOU', 'HOU-3', 'Mike Burrows', 'R', 5.66, 5.53, 1.54, 19.0, 8.7, 1.98, 5.7, 89, 'Back-End', 85, 5],
  ['HOU', 'HOU-4', 'Tatsuya Imai', 'R', 5.52, 5.55, 1.36, 22.2, 15.9, 1.53, 4.2, 88, 'Back-End', 82, 4],
  ['HOU', 'HOU-5', 'Lance McCullers Jr.', 'R', 6.86, 5.01, 1.53, 25.0, 12.8, 1.60, 4.9, 84, 'Back-End', 83, 4],
  // KC
  ['KC', 'KC-1', 'Michael Wacha', 'R', 3.23, 3.89, 1.12, 21.5, 8.6, 0.96, 6.3, 108, 'Ace', 87, 5],
  ['KC', 'KC-2', 'Seth Lugo', 'R', 3.55, 3.21, 1.35, 20.1, 7.7, 0.51, 5.9, 105, 'Mid-Rotation', 88, 5],
  ['KC', 'KC-3', 'Noah Cameron', 'R', 4.22, 3.48, 1.26, 22.2, 6.7, 0.91, 5.4, 101, 'Mid-Rotation', 84, 5],
  ['KC', 'KC-4', 'Kris Bubic', 'L', 4.11, 3.76, 1.23, 24.6, 12.6, 0.72, 5.6, 101, 'Mid-Rotation', 84, 5],
  ['KC', 'KC-5', 'Cole Ragans', 'L', 4.84, 6.28, 1.42, 29.8, 15.2, 2.55, 4.4, 97, 'Back-End', 83, 5],
  // LAA
  ['LAA', 'LAA-1', 'José Soriano', 'R', 2.72, 3.66, 1.21, 27.1, 12.1, 0.83, 5.8, 113, 'Ace', 85, 5],
  ['LAA', 'LAA-2', 'Walbert Ureña', 'R', 2.44, 3.92, 1.38, 21.1, 12.9, 0.61, 5.5, 114, 'Ace', 82, 5],
  ['LAA', 'LAA-3', 'Reid Detmers', 'L', 4.63, 2.91, 1.18, 28.5, 7.6, 0.79, 5.7, 99, 'Mid-Rotation', 86, 5],
  ['LAA', 'LAA-4', 'Jack Kochanowicz', 'R', 5.23, 4.63, 1.48, 16.0, 12.2, 0.85, 5.3, 91, 'Back-End', 83, 5],
  ['LAA', 'LAA-5', 'Yusei Kikuchi', 'L', 5.81, 3.68, 1.58, 23.2, 9.9, 0.87, 4.4, 90, 'Back-End', 82, 4],
  // LAD
  ['LAD', 'LAD-1', 'Shohei Ohtani', 'L', 0.82, 2.38, 0.82, 28.6, 8.0, 0.33, 6.1, 118, 'Ace', 92, 5],
  ['LAD', 'LAD-2', 'Yoshinobu Yamamoto', 'R', 2.86, 3.55, 1.00, 25.6, 5.6, 1.17, 6.3, 112, 'Ace', 90, 5],
  ['LAD', 'LAD-3', 'Tyler Glasnow', 'R', 2.72, 3.35, 0.83, 33.1, 8.8, 1.13, 5.7, 115, 'Ace', 86, 5],
  ['LAD', 'LAD-4', 'Justin Wrobleski', 'L', 2.87, 3.42, 1.01, 16.0, 5.6, 0.57, 7.0, 109, 'Ace', 88, 5],
  ['LAD', 'LAD-5', 'Emmet Sheehan', 'R', 4.50, 4.25, 1.16, 25.9, 5.9, 1.71, 5.3, 100, 'Mid-Rotation', 84, 5],
  // MIA
  ['MIA', 'MIA-1', 'Max Meyer', 'R', 2.97, 3.08, 1.10, 26.7, 9.0, 0.67, 5.6, 112, 'Ace', 86, 5],
  ['MIA', 'MIA-2', 'Sandy Alcantara', 'R', 4.59, 4.16, 1.30, 16.3, 6.0, 1.09, 6.3, 96, 'Back-End', 89, 5],
  ['MIA', 'MIA-3', 'Eury Pérez', 'R', 4.60, 4.52, 1.26, 27.2, 10.6, 1.58, 5.2, 99, 'Mid-Rotation', 82, 5],
  ['MIA', 'MIA-4', 'Janson Junk', 'R', 4.80, 4.15, 1.30, 16.9, 5.1, 1.20, 5.5, 96, 'Back-End', 83, 5],
  ['MIA', 'MIA-5', 'Tyler Phillips', 'R', 1.63, 3.30, 1.27, 20.0, 11.5, 0.23, 5.0, 107, 'Ace', 82, 5],
  // MIL
  ['MIL', 'MIL-1', 'Jacob Misiorowski', 'R', 1.65, 1.69, 0.79, 39.6, 7.0, 0.51, 5.9, 118, 'Ace', 87, 5],
  ['MIL', 'MIL-2', 'Kyle Harrison', 'L', 1.57, 2.40, 1.03, 31.9, 7.0, 0.63, 5.2, 118, 'Ace', 86, 5],
  ['MIL', 'MIL-3', 'Chad Patrick', 'R', 2.54, 3.46, 1.20, 18.4, 9.7, 0.39, 7.7, 112, 'Ace', 85, 5],
  ['MIL', 'MIL-4', 'Brandon Woodruff', 'R', 3.60, 3.97, 1.03, 20.7, 5.8, 1.20, 5.0, 105, 'Mid-Rotation', 82, 5],
  ['MIL', 'MIL-5', 'Brandon Sproat', 'R', 6.24, 5.38, 1.53, 24.0, 12.4, 1.84, 5.4, 93, 'Back-End', 82, 4],
  // MIN
  ['MIN', 'MIN-1', 'Joe Ryan', 'R', 3.20, 2.66, 0.97, 28.0, 5.0, 0.77, 5.4, 111, 'Ace', 88, 5],
  ['MIN', 'MIN-2', 'Taj Bradley', 'R', 3.21, 3.40, 1.21, 27.5, 8.9, 0.96, 5.6, 110, 'Ace', 86, 5],
  ['MIN', 'MIN-3', 'Bailey Ober', 'R', 4.59, 4.97, 1.22, 16.4, 6.4, 1.62, 5.6, 96, 'Back-End', 84, 5],
  ['MIN', 'MIN-4', 'Connor Prielipp', 'L', 5.26, 3.68, 1.35, 24.3, 9.8, 0.92, 4.9, 93, 'Back-End', 80, 4],
  ['MIN', 'MIN-5', 'Simeon Woods Richardson', 'R', 7.74, 6.14, 1.89, 11.5, 11.0, 1.70, 4.8, 84, 'Back-End', 82, 4],
  // NYM
  ['NYM', 'NYM-1', 'Clay Holmes', 'R', 2.39, 3.26, 1.10, 20.9, 8.4, 0.51, 5.9, 115, 'Ace', 87, 5],
  ['NYM', 'NYM-2', 'Freddy Peralta', 'R', 3.55, 3.99, 1.30, 23.9, 9.8, 1.09, 5.5, 106, 'Mid-Rotation', 86, 5],
  ['NYM', 'NYM-3', 'Christian Scott', 'R', 2.97, 2.71, 1.38, 28.1, 11.9, 0.30, 4.3, 109, 'Ace', 80, 5],
  ['NYM', 'NYM-4', 'Nolan McLean', 'R', 4.21, 3.53, 1.12, 27.9, 8.7, 1.09, 5.5, 102, 'Mid-Rotation', 84, 5],
  ['NYM', 'NYM-5', 'David Peterson', 'L', 5.18, 2.96, 1.59, 21.1, 9.0, 0.31, 5.3, 94, 'Back-End', 85, 5],
  // NYY
  ['NYY', 'NYY-1', 'Cam Schlittler', 'R', 1.89, 2.19, 0.86, 28.5, 4.4, 0.47, 5.9, 118, 'Ace', 88, 5],
  ['NYY', 'NYY-2', 'Max Fried', 'L', 3.21, 2.71, 1.01, 20.8, 7.9, 0.15, 6.2, 108, 'Ace', 89, 5],
  ['NYY', 'NYY-3', 'Will Warren', 'R', 3.22, 3.32, 1.20, 25.8, 7.0, 0.98, 5.4, 109, 'Ace', 86, 5],
  ['NYY', 'NYY-4', 'Ryan Weathers', 'L', 3.52, 3.98, 1.14, 29.0, 7.3, 1.55, 5.8, 109, 'Ace', 84, 5],
  ['NYY', 'NYY-5', 'Gerrit Cole', 'R', 3.20, 3.15, 1.05, 30.5, 6.0, 0.85, 6.2, 112, 'Ace', 94, 5],
  // OAK
  ['OAK', 'OAK-1', 'J.T. Ginn', 'R', 2.87, 4.07, 1.14, 21.6, 10.8, 0.91, 6.0, 111, 'Ace', 84, 5],
  ['OAK', 'OAK-2', 'Jeffrey Springs', 'L', 4.07, 4.74, 1.19, 20.6, 7.2, 1.63, 5.5, 101, 'Mid-Rotation', 84, 5],
  ['OAK', 'OAK-3', 'Luis Severino', 'R', 4.16, 4.48, 1.47, 24.0, 11.4, 1.29, 5.2, 101, 'Mid-Rotation', 83, 5],
  ['OAK', 'OAK-4', 'Aaron Civale', 'R', 4.20, 5.52, 1.47, 15.9, 6.9, 1.94, 5.1, 97, 'Back-End', 83, 5],
  ['OAK', 'OAK-5', 'Jacob Lopez', 'R', 6.75, 6.48, 1.84, 15.6, 13.6, 1.95, 5.1, 84, 'Back-End', 82, 4],
  // PHI
  ['PHI', 'PHI-1', 'Cristopher Sánchez', 'L', 1.47, 1.90, 1.12, 29.4, 5.0, 0.34, 6.6, 118, 'Ace', 89, 5],
  ['PHI', 'PHI-2', 'Zack Wheeler', 'R', 2.27, 3.47, 0.85, 24.4, 5.5, 1.03, 6.2, 117, 'Ace', 91, 5],
  ['PHI', 'PHI-3', 'Jesús Luzardo', 'L', 4.30, 2.69, 1.31, 27.4, 6.7, 0.67, 5.6, 101, 'Mid-Rotation', 86, 5],
  ['PHI', 'PHI-4', 'Aaron Nola', 'R', 5.55, 4.32, 1.39, 24.2, 6.8, 1.61, 5.1, 90, 'Back-End', 89, 5],
  ['PHI', 'PHI-5', 'Andrew Painter', 'R', 5.74, 4.74, 1.52, 18.2, 7.2, 1.52, 5.3, 88, 'Back-End', 82, 5],
  // PIT
  ['PIT', 'PIT-1', 'Paul Skenes', 'R', 2.89, 2.65, 0.86, 29.4, 4.7, 0.83, 5.4, 113, 'Ace', 90, 5],
  ['PIT', 'PIT-2', 'Braxton Ashcraft', 'R', 2.77, 2.93, 1.03, 27.3, 5.7, 0.84, 6.2, 114, 'Ace', 87, 5],
  ['PIT', 'PIT-3', 'Carmen Mlodzinski', 'R', 3.76, 3.33, 1.42, 19.3, 8.4, 0.49, 6.1, 103, 'Mid-Rotation', 85, 5],
  ['PIT', 'PIT-4', 'Mitch Keller', 'R', 4.35, 3.35, 1.17, 18.2, 7.1, 0.53, 5.7, 98, 'Mid-Rotation', 88, 5],
  ['PIT', 'PIT-5', 'Bubba Chandler', 'R', 4.89, 5.09, 1.51, 21.2, 14.7, 1.26, 4.8, 93, 'Back-End', 82, 4],
  // SD
  ['SD', 'SD-1', 'Michael King', 'R', 3.18, 3.71, 1.13, 23.8, 10.6, 0.79, 5.7, 109, 'Ace', 86, 5],
  ['SD', 'SD-2', 'Randy Vásquez', 'R', 3.31, 4.29, 1.22, 18.6, 6.7, 1.24, 5.4, 107, 'Ace', 85, 5],
  ['SD', 'SD-3', 'Walker Buehler', 'R', 4.88, 3.59, 1.32, 19.5, 8.2, 0.70, 4.7, 94, 'Back-End', 83, 5],
  ['SD', 'SD-4', 'Nick Pivetta', 'R', 4.50, 1.33, 1.13, 36.4, 9.1, 0.00, 4.0, 99, 'Mid-Rotation', 83, 5],
  ['SD', 'SD-5', 'Germán Márquez', 'R', 5.76, 6.64, 1.45, 14.8, 9.4, 2.43, 4.9, 87, 'Back-End', 82, 4],
  // SEA
  ['SEA', 'SEA-1', 'Emerson Hancock', 'R', 2.80, 3.70, 0.95, 25.8, 5.5, 1.27, 5.9, 113, 'Ace', 88, 5],
  ['SEA', 'SEA-2', 'Bryan Woo', 'R', 3.44, 2.97, 0.96, 24.4, 5.0, 0.76, 5.9, 108, 'Ace', 88, 5],
  ['SEA', 'SEA-3', 'George Kirby', 'R', 3.77, 3.52, 1.22, 19.7, 5.7, 0.85, 6.2, 103, 'Mid-Rotation', 88, 5],
  ['SEA', 'SEA-4', 'Logan Gilbert', 'R', 3.79, 4.10, 1.10, 25.8, 5.7, 1.59, 5.7, 105, 'Mid-Rotation', 90, 5],
  ['SEA', 'SEA-5', 'Luis Castillo', 'R', 5.53, 4.01, 1.45, 22.4, 8.8, 1.14, 5.5, 91, 'Back-End', 88, 5],
  // SF
  ['SF', 'SF-1', 'Landen Roupp', 'R', 4.22, 2.83, 1.31, 26.6, 10.0, 0.42, 5.3, 101, 'Mid-Rotation', 84, 5],
  ['SF', 'SF-2', 'Logan Webb', 'R', 4.82, 3.43, 1.39, 20.6, 7.9, 0.69, 5.8, 95, 'Back-End', 87, 5],
  ['SF', 'SF-3', 'Robbie Ray', 'L', 4.45, 5.50, 1.40, 21.9, 11.5, 1.87, 5.2, 98, 'Mid-Rotation', 84, 5],
  ['SF', 'SF-4', 'Adrian Houser', 'R', 5.59, 5.15, 1.56, 13.6, 8.2, 1.44, 5.1, 87, 'Back-End', 83, 5],
  ['SF', 'SF-5', 'Tyler Mahle', 'R', 6.04, 4.98, 1.54, 22.9, 9.6, 1.75, 5.2, 88, 'Back-End', 83, 5],
  // STL
  ['STL', 'STL-1', 'Michael McGreevy', 'R', 2.98, 4.21, 1.10, 16.8, 6.5, 1.09, 5.5, 109, 'Ace', 86, 5],
  ['STL', 'STL-2', 'Andre Pallante', 'R', 4.19, 4.49, 1.34, 18.3, 8.4, 1.24, 5.3, 99, 'Mid-Rotation', 85, 5],
  ['STL', 'STL-3', 'Kyle Leahy', 'R', 4.25, 4.62, 1.56, 18.4, 8.8, 1.31, 5.0, 99, 'Mid-Rotation', 83, 5],
  ['STL', 'STL-4', 'Matthew Liberatore', 'L', 4.35, 4.57, 1.50, 21.3, 8.6, 1.45, 5.2, 99, 'Mid-Rotation', 84, 5],
  ['STL', 'STL-5', 'Dustin May', 'R', 4.59, 3.23, 1.29, 21.5, 6.8, 0.67, 5.6, 96, 'Back-End', 84, 5],
  // TB
  ['TB', 'TB-1', 'Nick Martinez', 'R', 1.62, 3.29, 1.11, 15.2, 4.5, 0.54, 6.1, 118, 'Ace', 88, 5],
  ['TB', 'TB-2', 'Shane McClanahan', 'L', 2.45, 2.78, 1.02, 23.9, 8.6, 0.33, 5.0, 115, 'Ace', 87, 5],
  ['TB', 'TB-3', 'Drew Rasmussen', 'R', 3.36, 3.71, 1.02, 23.3, 5.1, 1.22, 5.4, 108, 'Ace', 86, 5],
  ['TB', 'TB-4', 'Griffin Jax', 'R', 4.76, 5.41, 1.47, 21.8, 10.9, 1.85, 4.9, 94, 'Back-End', 82, 5],
  ['TB', 'TB-5', 'Steven Matz', 'L', 5.48, 5.24, 1.33, 19.0, 8.7, 1.76, 4.6, 89, 'Back-End', 83, 4],
  // TEX
  ['TEX', 'TEX-1', 'Jacob deGrom', 'R', 3.48, 4.00, 1.01, 30.1, 5.0, 1.81, 5.4, 109, 'Ace', 88, 5],
  ['TEX', 'TEX-2', 'Kumar Rocker', 'R', 3.54, 4.13, 1.32, 18.3, 10.4, 0.80, 5.6, 104, 'Mid-Rotation', 85, 5],
  ['TEX', 'TEX-3', 'MacKenzie Gore', 'L', 3.96, 3.67, 1.19, 25.3, 10.5, 0.88, 5.1, 103, 'Mid-Rotation', 85, 5],
  ['TEX', 'TEX-4', 'Nathan Eovaldi', 'R', 4.10, 4.34, 1.18, 23.6, 5.4, 1.69, 6.2, 101, 'Mid-Rotation', 88, 5],
  ['TEX', 'TEX-5', 'Jack Leiter', 'R', 4.34, 4.00, 1.33, 25.8, 9.8, 1.22, 5.5, 99, 'Mid-Rotation', 84, 5],
  // TOR
  ['TOR', 'TOR-1', 'Dylan Cease', 'R', 3.05, 2.54, 1.21, 35.7, 10.1, 0.73, 5.6, 114, 'Ace', 89, 5],
  ['TOR', 'TOR-2', 'Kevin Gausman', 'R', 3.36, 3.00, 1.09, 24.3, 4.6, 0.84, 5.8, 108, 'Ace', 90, 5],
  ['TOR', 'TOR-3', 'Trey Yesavage', 'R', 2.19, 2.47, 1.16, 26.2, 11.4, 0.00, 5.3, 112, 'Ace', 80, 5],
  ['TOR', 'TOR-4', 'Patrick Corbin', 'L', 3.65, 3.91, 1.36, 17.1, 6.6, 0.91, 4.9, 103, 'Mid-Rotation', 84, 5],
  ['TOR', 'TOR-5', 'Carlos Rodón', 'L', 3.32, 3.83, 1.32, 24.7, 16.0, 0.47, 4.8, 108, 'Ace', 82, 5],
  // WSH
  ['WSH', 'WSH-1', 'Cade Cavalli', 'R', 3.62, 2.63, 1.42, 25.4, 8.2, 0.42, 5.0, 106, 'Mid-Rotation', 86, 5],
  ['WSH', 'WSH-2', 'Foster Griffin', 'L', 3.76, 4.72, 1.15, 23.2, 7.5, 1.75, 5.6, 104, 'Mid-Rotation', 85, 5],
  ['WSH', 'WSH-3', 'Jake Irvin', 'R', 5.23, 3.99, 1.35, 25.4, 9.6, 1.22, 4.7, 93, 'Back-End', 83, 5],
  ['WSH', 'WSH-4', 'Zack Littell', 'R', 5.01, 6.27, 1.37, 13.5, 7.3, 2.28, 7.4, 91, 'Back-End', 84, 5],
  ['WSH', 'WSH-5', 'PJ Poulin', 'R', 3.28, 5.88, 1.46, 16.0, 15.1, 1.46, 3.5, 100, 'Mid-Rotation', 78, 4],
]

export const TEAM_ORDER = TEAM_SEEDS.map(([abbr]) => abbr)

export const TEAMS: Record<TeamAbbr, TeamStats> = Object.fromEntries(
  TEAM_SEEDS.map(
    ([
      abbr,
      name,
      color,
      alt,
      league,
      division,
      offenseVsR,
      offenseVsL,
      power,
      discipline,
      contact,
      baserunning,
      defense,
      bullpen,
      parkFactor,
    ]) => [
      abbr,
      { abbr, name, color, alt, league, division, offenseVsR, offenseVsL, power, discipline, contact, baserunning, defense, bullpen, parkFactor } satisfies TeamStats,
    ],
  ),
) as Record<TeamAbbr, TeamStats>

export const STARTERS_BY_TEAM: Record<TeamAbbr, StarterStats[]> = Object.fromEntries(
  TEAM_ORDER.map((team) => [team, [] as StarterStats[]]),
) as Record<TeamAbbr, StarterStats[]>

for (const [team, id, name, hand, era, fip, whip, kRate, bbRate, hr9, inningsPerStart, pitchingRating, role, recentPitchCount, daysRest] of STARTER_SEEDS) {
  STARTERS_BY_TEAM[team].push({
    id,
    team,
    name,
    hand,
    era,
    fip,
    whip,
    kRate,
    bbRate,
    hr9,
    inningsPerStart,
    pitchingRating,
    role,
    recentPitchCount,
    daysRest,
  })
}

export function getDefaultStarter(team: TeamAbbr): StarterStats {
  const starter = STARTERS_BY_TEAM[team][0]
  if (!starter) {
    throw new Error(`Missing starter seed for ${team}`)
  }
  return starter
}

export function getStartersForTeam(team: TeamAbbr): StarterStats[] {
  return STARTERS_BY_TEAM[team]
}

export function getStarterById(team: TeamAbbr, starterId: string): StarterStats {
  return STARTERS_BY_TEAM[team].find((starter) => starter.id === starterId) ?? getDefaultStarter(team)
}

export function createDefaultBullpenWorkload(fatigue: BullpenFatigue): BullpenWorkload {
  switch (fatigue) {
    case 'Fresh':
      return { last3DaysPitchCount: 46, highLeverageUsage: 1, closerAvailable: true }
    case 'Used':
      return { last3DaysPitchCount: 74, highLeverageUsage: 2, closerAvailable: true }
    case 'Taxed':
      return { last3DaysPitchCount: 104, highLeverageUsage: 3, closerAvailable: false }
  }
}

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value))
}

function fatiguePenalty(level: BullpenFatigue) {
  switch (level) {
    case 'Fresh':
      return 0
    case 'Used':
      return 4
    case 'Taxed':
      return 8
  }
}

function workloadPenalty(workload: BullpenWorkload) {
  const pitchPenalty = clamp((workload.last3DaysPitchCount - 50) * 0.12, -3, 8)
  const leveragePenalty = workload.highLeverageUsage * 1.8
  const closerPenalty = workload.closerAvailable ? 0 : 2.5
  return pitchPenalty + leveragePenalty + closerPenalty
}

function lineupMultiplier(confidence: LineupConfidence) {
  switch (confidence) {
    case 'Confirmed':
      return 1
    case 'Projected':
      return 0.986
    case 'Thin':
      return 0.956
  }
}

function weatherMultiplier(temperature: number, windMph: number, windDirection: WindDirection) {
  const tempAdj = clamp((temperature - 72) * 0.0024, -0.07, 0.07)
  const windAdj =
    windDirection === 'Out'
      ? clamp(windMph * 0.009, 0, 0.14)
      : windDirection === 'In'
        ? clamp(-windMph * 0.008, -0.12, 0)
        : windDirection === 'Cross'
          ? clamp(windMph * 0.002, -0.02, 0.04)
          : 0
  return 1 + tempAdj + windAdj
}

function estimateStarterInnings(starter: StarterStats) {
  const roleAdj = starter.role === 'Ace' ? 0.25 : starter.role === 'Mid-Rotation' ? 0 : -0.22
  const workloadAdj = clamp((starter.recentPitchCount - 88) * 0.015, -0.45, 0.35)
  const restAdj = clamp((starter.daysRest - 4) * 0.12, -0.35, 0.4)
  const adjusted =
    starter.inningsPerStart +
    (starter.kRate - 24) * 0.03 -
    (starter.bbRate - 7) * 0.04 +
    roleAdj +
    workloadAdj +
    restAdj
  return clamp(adjusted, 4.2, 7.4)
}

function starterRunFactor(starter: StarterStats) {
  const skillBlend = ((starter.era * 0.35 + starter.fip * 0.65) / 4.2) * (100 / starter.pitchingRating)
  const shape = 1 + (starter.whip - 1.2) * 0.14 + (starter.hr9 - 1) * 0.05
  const workloadShape = 1 + clamp((starter.recentPitchCount - 92) * 0.0025, -0.03, 0.06) - clamp((starter.daysRest - 4) * 0.01, -0.03, 0.03)
  return clamp(skillBlend * shape * workloadShape, 0.72, 1.35)
}

function bullpenRunFactor(team: TeamStats, fatigue: BullpenFatigue, workload: BullpenWorkload) {
  const adjustedBullpen = Math.max(82, team.bullpen - fatiguePenalty(fatigue) - workloadPenalty(workload))
  return clamp(100 / adjustedBullpen, 0.82, 1.24)
}

function defenseRunFactor(team: TeamStats) {
  return clamp(1 - (team.defense - 100) * 0.0016, 0.93, 1.07)
}

function buildFeature(label: string, edge: number, detail: string): PredictionFeature {
  return { label, good: edge >= 0, detail }
}

function projectTeamRuns({
  battingTeam,
  battingLineup,
  opposingTeam,
  opposingStarter,
  opposingBullpenFatigue,
  opposingBullpenWorkload,
  weather,
  parkFactor,
  postseason,
  leagueAvgRunsPerGame,
}: {
  battingTeam: TeamStats
  battingLineup: LineupConfidence
  opposingTeam: TeamStats
  opposingStarter: StarterStats
  opposingBullpenFatigue: BullpenFatigue
  opposingBullpenWorkload: BullpenWorkload
  weather: number
  parkFactor: number
  postseason: boolean
  leagueAvgRunsPerGame?: number
}) {
  const leagueAvg = leagueAvgRunsPerGame ?? 4.35
  const splitIndex = (opposingStarter.hand === 'L' ? battingTeam.offenseVsL : battingTeam.offenseVsR) / 100
  const styleAdj =
    1 +
    (battingTeam.power - 100) * 0.0017 +
    (battingTeam.discipline - 100) * 0.0011 +
    (battingTeam.contact - 100) * 0.0008 +
    (battingTeam.baserunning - 100) * 0.0004

  const starterInnings = estimateStarterInnings(opposingStarter)
  const starterShare = starterInnings / 9
  const starterFactor = starterRunFactor(opposingStarter)
  const bullpenFactor = bullpenRunFactor(opposingTeam, opposingBullpenFatigue, opposingBullpenWorkload)
  const blendedPrevention = starterFactor * starterShare + bullpenFactor * (1 - starterShare)
  const defenseAdj = defenseRunFactor(opposingTeam)
  const lineupAdj = lineupMultiplier(battingLineup)
  const playoffAdj = postseason ? 0.972 : 1

  // Blend rating-based projection (85%) with team's actual season RPG (15%)
  const ratingBase = leagueAvg * splitIndex
  const recentBase = battingTeam.recentRunsPerGame ?? ratingBase
  const blendedBase = ratingBase * 0.85 + recentBase * 0.15

  const runs = blendedBase * styleAdj * blendedPrevention * defenseAdj * parkFactor * weather * lineupAdj * playoffAdj

  const calcSteps: RunCalcSteps = {
    leagueAvg,
    splitIndex,
    styleAdj,
    starterFactor,
    starterShare,
    bullpenFactor,
    blendedPrevention,
    defenseAdj,
    parkFactor,
    weather,
    lineupAdj,
    playoffAdj,
    projected: clamp(runs, 2.3, 8.7),
  }

  return {
    runs: clamp(runs, 2.3, 8.7),
    opposingStarterInnings: starterInnings,
    calcSteps,
  }
}

function leanFromMargin(projectedMargin: number) {
  if (projectedMargin >= 1.3) return 'Home side lean'
  if (projectedMargin <= -1.3) return 'Away side lean'
  return 'Tight matchup'
}

export function predictGame(input: PredictGameInput): PredictionResult {
  const weather = weatherMultiplier(input.temperature, input.windMph, input.windDirection)
  const parkFactor = input.homeTeam.parkFactor / 100
  const postseason = input.gameType === 'Postseason'
  const leagueAvgRunsPerGame = input.leagueAvgRunsPerGame

  const awayProjection = projectTeamRuns({
    battingTeam: input.awayTeam,
    battingLineup: input.awayLineupConfidence,
    opposingTeam: input.homeTeam,
    opposingStarter: input.homeStarter,
    opposingBullpenFatigue: input.homeBullpenFatigue,
    opposingBullpenWorkload: input.homeBullpenWorkload,
    weather,
    parkFactor,
    postseason,
    leagueAvgRunsPerGame,
  })

  const homeProjection = projectTeamRuns({
    battingTeam: input.homeTeam,
    battingLineup: input.homeLineupConfidence,
    opposingTeam: input.awayTeam,
    opposingStarter: input.awayStarter,
    opposingBullpenFatigue: input.awayBullpenFatigue,
    opposingBullpenWorkload: input.awayBullpenWorkload,
    weather,
    parkFactor,
    postseason,
    leagueAvgRunsPerGame,
  })

  const projectedHomeRuns = clamp(homeProjection.runs + 0.18, 2.4, 8.8)
  const projectedAwayRuns = clamp(awayProjection.runs, 2.2, 8.6)
  const projectedTotal = projectedHomeRuns + projectedAwayRuns
  const projectedMargin = projectedHomeRuns - projectedAwayRuns

  // #2: win prob sigma scales with run environment — higher-scoring games have wider margin variance
  const winProbSigma = clamp(1.82 + (projectedTotal - 9.0) * 0.055, 1.5, 2.2)
  const winProb = clamp(1 / (1 + Math.exp(-(projectedMargin / winProbSigma))), 0.09, 0.91)
  const marginSigma = clamp(2.45 + (projectedTotal - 9.0) * 0.05, 2.0, 3.0)
  const homeRunLineCoverProb = clamp(1 - normCDF((1.5 - projectedMargin) / marginSigma), 0.08, 0.86)
  const awayRunLineCoverProb = 1 - homeRunLineCoverProb
  // #1: O/U std dev scales with pitcher quality — aces suppress total variance
  const avgStarterRating = (input.homeStarter.pitchingRating + input.awayStarter.pitchingRating) / 2
  const totalStdDev = 2.05 + (100 - avgStarterRating) * 0.012 + Math.abs(weather - 1) * 2.8
  const overProb = clamp(1 - normCDF((8.0 - projectedTotal) / totalStdDev), 0.12, 0.88)
  const underProb = 1 - overProb

  const splitEdge =
    (input.homeStarter.hand === 'L' ? input.awayTeam.offenseVsL - input.homeTeam.offenseVsL : input.homeTeam.offenseVsR - input.awayTeam.offenseVsR) / 2
  const starterEdge = input.homeStarter.pitchingRating - input.awayStarter.pitchingRating
  const bullpenEdge =
    input.homeTeam.bullpen -
    fatiguePenalty(input.homeBullpenFatigue) -
    workloadPenalty(input.homeBullpenWorkload) -
    (input.awayTeam.bullpen - fatiguePenalty(input.awayBullpenFatigue) - workloadPenalty(input.awayBullpenWorkload))

  const features = [
    buildFeature(
      'Starter matchup',
      starterEdge,
      `${input.homeStarter.name} (${input.homeStarter.role}, ${input.homeStarter.daysRest}d rest) vs ${input.awayStarter.name} (${input.awayStarter.role}, ${input.awayStarter.daysRest}d rest)`,
    ),
    buildFeature(
      'Bullpen workload',
      bullpenEdge,
      `${input.homeTeam.abbr} ${input.homeBullpenWorkload.last3DaysPitchCount} pitches / ${input.awayTeam.abbr} ${input.awayBullpenWorkload.last3DaysPitchCount}`,
    ),
    buildFeature('Handedness split', splitEdge, `${input.homeTeam.abbr} vs ${input.awayStarter.hand}HP and ${input.awayTeam.abbr} vs ${input.homeStarter.hand}HP`),
    buildFeature('Run environment', parkFactor + weather - 2, `${input.homeTeam.name} park ${input.homeTeam.parkFactor} with ${input.windDirection.toLowerCase()} wind`),
    buildFeature(
      'Lineup certainty',
      lineupMultiplier(input.homeLineupConfidence) - lineupMultiplier(input.awayLineupConfidence),
      `${input.homeTeam.abbr} ${input.homeLineupConfidence}, ${input.awayTeam.abbr} ${input.awayLineupConfidence}`,
    ),
  ]

  return {
    projectedHomeRuns: Number(projectedHomeRuns.toFixed(2)),
    projectedAwayRuns: Number(projectedAwayRuns.toFixed(2)),
    projectedTotal: Number(projectedTotal.toFixed(2)),
    projectedMargin: Number(projectedMargin.toFixed(2)),
    homeWinProb: Number(winProb.toFixed(4)),
    awayWinProb: Number((1 - winProb).toFixed(4)),
    homeRunLineCoverProb: Number(homeRunLineCoverProb.toFixed(4)),
    awayRunLineCoverProb: Number(awayRunLineCoverProb.toFixed(4)),
    overProb: Number(overProb.toFixed(4)),
    underProb: Number(underProb.toFixed(4)),
    homeStarterInnings: Number(awayProjection.opposingStarterInnings.toFixed(1)),
    awayStarterInnings: Number(homeProjection.opposingStarterInnings.toFixed(1)),
    modelLean: leanFromMargin(projectedMargin),
    features,
    homeCalc: homeProjection.calcSteps,
    awayCalc: awayProjection.calcSteps,
  }
}

export function normCDF(z: number): number {
  return 0.5 * (1 + Math.sign(z) * (1 - Math.exp(-0.7071 * z * z * (1 + 0.2316419 * Math.abs(z)))))
}
