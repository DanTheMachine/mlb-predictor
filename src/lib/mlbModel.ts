import type {
  BullpenFatigue,
  BullpenWorkload,
  GameType,
  LineupConfidence,
  PredictGameInput,
  PredictionFeature,
  PredictionResult,
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
  ['ARI', 'Diamondbacks', '#A71930', '#E3D4AD', 'NL', 'NL West', 101, 99, 101, 99, 101, 103, 100, 99, 103],
  ['ATL', 'Braves', '#CE1141', '#13274F', 'NL', 'NL East', 108, 110, 111, 101, 101, 99, 100, 102, 100],
  ['BAL', 'Orioles', '#DF4601', '#000000', 'AL', 'AL East', 107, 104, 109, 98, 101, 103, 100, 101, 99],
  ['BOS', 'Red Sox', '#BD3039', '#0C2340', 'AL', 'AL East', 103, 101, 104, 98, 100, 98, 97, 96, 106],
  ['CHC', 'Cubs', '#0E3386', '#CC3433', 'NL', 'NL Central', 102, 103, 101, 101, 102, 100, 101, 100, 101],
  ['CIN', 'Reds', '#C6011F', '#000000', 'NL', 'NL Central', 99, 100, 103, 95, 98, 103, 97, 95, 106],
  ['CLE', 'Guardians', '#0C2340', '#E31937', 'AL', 'AL Central', 100, 102, 96, 102, 104, 102, 104, 103, 97],
  ['COL', 'Rockies', '#33006F', '#C4CED4', 'NL', 'NL West', 95, 94, 98, 94, 96, 96, 93, 92, 118],
  ['CWS', 'White Sox', '#27251F', '#C4CED4', 'AL', 'AL Central', 90, 89, 90, 93, 94, 95, 92, 91, 99],
  ['DET', 'Tigers', '#0C2340', '#FA4616', 'AL', 'AL Central', 98, 97, 96, 100, 101, 99, 102, 101, 96],
  ['HOU', 'Astros', '#EB6E1F', '#002D62', 'AL', 'AL West', 106, 105, 104, 104, 104, 99, 101, 102, 101],
  ['KC', 'Royals', '#004687', '#BD9B60', 'AL', 'AL Central', 99, 97, 96, 99, 100, 103, 100, 98, 100],
  ['LAA', 'Angels', '#BA0021', '#003263', 'AL', 'AL West', 94, 95, 97, 95, 96, 97, 95, 93, 101],
  ['LAD', 'Dodgers', '#005A9C', '#EF3E42', 'NL', 'NL West', 112, 110, 111, 104, 103, 101, 101, 105, 99],
  ['MIA', 'Marlins', '#00A3E0', '#EF3340', 'NL', 'NL East', 91, 92, 91, 95, 97, 99, 98, 95, 95],
  ['MIL', 'Brewers', '#12284B', '#FFC52F', 'NL', 'NL Central', 101, 102, 100, 101, 101, 102, 102, 102, 98],
  ['MIN', 'Twins', '#002B5C', '#D31145', 'AL', 'AL Central', 102, 101, 104, 100, 99, 98, 99, 100, 98],
  ['NYM', 'Mets', '#002D72', '#FF5910', 'NL', 'NL East', 103, 105, 102, 103, 100, 97, 98, 99, 98],
  ['NYY', 'Yankees', '#0C2340', '#C4CED4', 'AL', 'AL East', 109, 108, 111, 103, 100, 97, 101, 104, 102],
  ['OAK', 'Athletics', '#003831', '#EFB21E', 'AL', 'AL West', 94, 95, 95, 96, 97, 100, 95, 94, 100],
  ['PHI', 'Phillies', '#E81828', '#002D72', 'NL', 'NL East', 107, 106, 109, 100, 100, 98, 99, 101, 101],
  ['PIT', 'Pirates', '#FDB827', '#27251F', 'NL', 'NL Central', 93, 94, 94, 96, 97, 100, 99, 96, 98],
  ['SD', 'Padres', '#2F241D', '#FFC425', 'NL', 'NL West', 104, 103, 102, 102, 102, 102, 100, 101, 96],
  ['SEA', 'Mariners', '#0C2C56', '#005C5C', 'AL', 'AL West', 97, 99, 99, 100, 98, 100, 104, 105, 95],
  ['SF', 'Giants', '#FD5A1E', '#27251F', 'NL', 'NL West', 98, 99, 98, 102, 99, 98, 101, 99, 94],
  ['STL', 'Cardinals', '#C41E3A', '#0C2340', 'NL', 'NL Central', 99, 98, 97, 100, 101, 98, 97, 96, 100],
  ['TB', 'Rays', '#092C5C', '#8FBCE6', 'AL', 'AL East', 97, 96, 96, 101, 100, 101, 103, 102, 97],
  ['TEX', 'Rangers', '#003278', '#C0111F', 'AL', 'AL West', 104, 103, 106, 99, 100, 98, 98, 97, 104],
  ['TOR', 'Blue Jays', '#134A8E', '#1D2D5C', 'AL', 'AL East', 101, 100, 100, 100, 101, 97, 99, 99, 101],
  ['WSH', 'Nationals', '#AB0003', '#14225A', 'NL', 'NL East', 92, 93, 92, 96, 98, 101, 96, 94, 102],
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
  ['ARI', 'ARI-1', 'Zac Gallen', 'R', 3.68, 3.61, 1.18, 26.4, 6.3, 0.94, 6.1, 107, 'Ace', 94, 5],
  ['ARI', 'ARI-2', 'Merrill Kelly', 'R', 3.97, 3.89, 1.23, 23.5, 6.8, 1.03, 5.8, 101, 'Mid-Rotation', 88, 5],
  ['ARI', 'ARI-3', 'Brandon Pfaadt', 'R', 4.31, 4.18, 1.29, 24.4, 7.2, 1.12, 5.4, 96, 'Back-End', 84, 4],
  ['ATL', 'ATL-1', 'Chris Sale', 'L', 3.42, 3.35, 1.14, 28.8, 6.0, 0.83, 6.3, 111, 'Ace', 96, 5],
  ['ATL', 'ATL-2', 'Max Fried', 'L', 3.61, 3.57, 1.17, 24.8, 7.1, 0.90, 6.1, 107, 'Mid-Rotation', 91, 5],
  ['ATL', 'ATL-3', 'Charlie Morton', 'R', 4.14, 4.02, 1.29, 25.5, 9.1, 1.05, 5.5, 99, 'Back-End', 87, 4],
  ['BAL', 'BAL-1', 'Corbin Burnes', 'R', 3.57, 3.49, 1.17, 27.0, 6.8, 0.89, 6.0, 108, 'Ace', 95, 5],
  ['BAL', 'BAL-2', 'Grayson Rodriguez', 'R', 3.85, 3.74, 1.22, 26.1, 7.4, 0.96, 5.8, 104, 'Mid-Rotation', 90, 5],
  ['BAL', 'BAL-3', 'Dean Kremer', 'R', 4.26, 4.17, 1.31, 22.8, 7.9, 1.14, 5.4, 97, 'Back-End', 84, 4],
  ['BOS', 'BOS-1', 'Brayan Bello', 'R', 3.91, 3.84, 1.24, 25.3, 7.2, 1.01, 5.8, 103, 'Ace', 91, 5],
  ['BOS', 'BOS-2', 'Tanner Houck', 'R', 3.98, 3.92, 1.25, 24.6, 7.4, 0.99, 5.9, 102, 'Mid-Rotation', 89, 5],
  ['BOS', 'BOS-3', 'Kutter Crawford', 'R', 4.22, 4.11, 1.28, 23.9, 7.8, 1.09, 5.4, 98, 'Back-End', 83, 4],
  ['CHC', 'CHC-1', 'Justin Steele', 'L', 3.75, 3.69, 1.2, 26.1, 6.7, 0.96, 5.9, 106, 'Ace', 92, 5],
  ['CHC', 'CHC-2', 'Shota Imanaga', 'L', 3.83, 3.7, 1.16, 25.7, 5.8, 0.92, 6.0, 107, 'Mid-Rotation', 90, 5],
  ['CHC', 'CHC-3', 'Jameson Taillon', 'R', 4.18, 4.09, 1.24, 20.8, 5.6, 1.17, 5.5, 98, 'Back-End', 84, 4],
  ['CIN', 'CIN-1', 'Hunter Greene', 'R', 4.18, 4.06, 1.29, 24.0, 8.0, 1.10, 5.6, 98, 'Ace', 93, 5],
  ['CIN', 'CIN-2', 'Nick Lodolo', 'L', 4.09, 4.01, 1.27, 25.1, 8.6, 1.00, 5.5, 99, 'Mid-Rotation', 88, 5],
  ['CIN', 'CIN-3', 'Andrew Abbott', 'L', 4.43, 4.3, 1.34, 23.0, 9.2, 1.09, 5.2, 95, 'Back-End', 82, 4],
  ['CLE', 'CLE-1', 'Shane Bieber', 'R', 3.49, 3.44, 1.12, 27.4, 5.8, 0.85, 6.2, 110, 'Ace', 94, 5],
  ['CLE', 'CLE-2', 'Tanner Bibee', 'R', 3.71, 3.62, 1.17, 25.7, 6.5, 0.94, 5.9, 106, 'Mid-Rotation', 90, 5],
  ['CLE', 'CLE-3', 'Triston McKenzie', 'R', 4.28, 4.15, 1.3, 24.0, 8.9, 1.04, 5.2, 97, 'Back-End', 81, 4],
  ['COL', 'COL-1', 'Kyle Freeland', 'L', 4.76, 4.58, 1.38, 22.1, 8.4, 1.22, 5.4, 92, 'Ace', 86, 5],
  ['COL', 'COL-2', 'Cal Quantrill', 'R', 4.91, 4.7, 1.41, 17.2, 8.1, 1.21, 5.5, 90, 'Mid-Rotation', 84, 5],
  ['COL', 'COL-3', 'Ryan Feltner', 'R', 5.04, 4.86, 1.43, 20.5, 8.3, 1.31, 5.0, 88, 'Back-End', 80, 4],
  ['CWS', 'CWS-1', 'Garrett Crochet', 'L', 4.88, 4.75, 1.4, 21.8, 8.8, 1.24, 5.2, 90, 'Ace', 88, 5],
  ['CWS', 'CWS-2', 'Erick Fedde', 'R', 4.55, 4.38, 1.33, 22.4, 7.7, 1.15, 5.5, 94, 'Mid-Rotation', 85, 5],
  ['CWS', 'CWS-3', 'Chris Flexen', 'R', 5.09, 4.92, 1.44, 17.9, 7.4, 1.34, 5.0, 87, 'Back-End', 79, 4],
  ['DET', 'DET-1', 'Tarik Skubal', 'R', 3.63, 3.55, 1.16, 27.2, 6.5, 0.9, 6.1, 108, 'Ace', 95, 5],
  ['DET', 'DET-2', 'Jack Flaherty', 'R', 3.88, 3.79, 1.22, 28.0, 7.2, 0.98, 5.8, 104, 'Mid-Rotation', 90, 5],
  ['DET', 'DET-3', 'Casey Mize', 'R', 4.31, 4.19, 1.28, 21.5, 7.1, 1.10, 5.4, 97, 'Back-End', 84, 4],
  ['HOU', 'HOU-1', 'Framber Valdez', 'R', 3.51, 3.46, 1.15, 28.1, 6.1, 0.87, 6.2, 109, 'Ace', 94, 5],
  ['HOU', 'HOU-2', 'Cristian Javier', 'R', 3.86, 3.79, 1.19, 27.2, 8.7, 0.96, 5.7, 103, 'Mid-Rotation', 89, 5],
  ['HOU', 'HOU-3', 'Hunter Brown', 'R', 4.26, 4.18, 1.31, 24.1, 9.1, 1.08, 5.2, 97, 'Back-End', 83, 4],
  ['KC', 'KC-1', 'Cole Ragans', 'L', 3.98, 3.89, 1.24, 24.8, 7.0, 1.02, 5.7, 101, 'Ace', 92, 5],
  ['KC', 'KC-2', 'Seth Lugo', 'R', 3.91, 3.83, 1.21, 21.3, 5.1, 0.97, 5.9, 102, 'Mid-Rotation', 88, 5],
  ['KC', 'KC-3', 'Brady Singer', 'R', 4.33, 4.24, 1.3, 22.7, 8.0, 1.11, 5.4, 96, 'Back-End', 83, 4],
  ['LAA', 'LAA-1', 'Tyler Anderson', 'R', 4.51, 4.37, 1.33, 23.0, 8.3, 1.14, 5.4, 95, 'Ace', 86, 5],
  ['LAA', 'LAA-2', 'Griffin Canning', 'R', 4.62, 4.45, 1.34, 22.8, 8.0, 1.18, 5.2, 94, 'Mid-Rotation', 83, 5],
  ['LAA', 'LAA-3', 'Patrick Sandoval', 'L', 4.78, 4.61, 1.39, 23.5, 10.2, 1.12, 5.0, 91, 'Back-End', 80, 4],
  ['LAD', 'LAD-1', 'Tyler Glasnow', 'R', 3.29, 3.22, 1.08, 29.2, 5.5, 0.79, 6.4, 114, 'Ace', 95, 5],
  ['LAD', 'LAD-2', 'Yoshinobu Yamamoto', 'R', 3.48, 3.36, 1.11, 27.8, 5.9, 0.84, 6.0, 110, 'Mid-Rotation', 91, 5],
  ['LAD', 'LAD-3', 'Bobby Miller', 'R', 4.01, 3.89, 1.24, 24.8, 7.3, 1.00, 5.5, 101, 'Back-End', 84, 4],
  ['MIA', 'MIA-1', 'Jesus Luzardo', 'L', 4.21, 4.05, 1.28, 24.5, 7.4, 1.04, 5.8, 99, 'Ace', 90, 5],
  ['MIA', 'MIA-2', 'Eury Perez', 'R', 3.95, 3.82, 1.19, 29.1, 7.9, 0.89, 5.5, 104, 'Mid-Rotation', 88, 5],
  ['MIA', 'MIA-3', 'Trevor Rogers', 'L', 4.59, 4.42, 1.34, 23.2, 9.0, 1.07, 5.1, 93, 'Back-End', 80, 4],
  ['MIL', 'MIL-1', 'Freddy Peralta', 'R', 3.62, 3.57, 1.17, 27.3, 6.7, 0.91, 6.0, 107, 'Ace', 93, 5],
  ['MIL', 'MIL-2', 'DL Hall', 'L', 4.11, 4.02, 1.3, 24.7, 9.3, 1.00, 5.4, 98, 'Mid-Rotation', 85, 5],
  ['MIL', 'MIL-3', 'Colin Rea', 'R', 4.37, 4.22, 1.3, 19.8, 6.0, 1.16, 5.3, 95, 'Back-End', 82, 4],
  ['MIN', 'MIN-1', 'Pablo Lopez', 'R', 3.84, 3.75, 1.21, 25.9, 6.6, 0.99, 5.9, 105, 'Ace', 93, 5],
  ['MIN', 'MIN-2', 'Joe Ryan', 'R', 3.98, 3.86, 1.17, 27.5, 5.5, 1.11, 5.7, 104, 'Mid-Rotation', 90, 5],
  ['MIN', 'MIN-3', 'Bailey Ober', 'R', 4.16, 4.03, 1.2, 24.0, 5.8, 1.08, 5.8, 101, 'Back-End', 86, 4],
  ['NYM', 'NYM-1', 'Kodai Senga', 'L', 3.67, 3.59, 1.18, 27.0, 6.1, 0.9, 6.1, 108, 'Ace', 91, 5],
  ['NYM', 'NYM-2', 'Jose Quintana', 'L', 4.07, 3.98, 1.27, 21.4, 7.4, 1.06, 5.6, 99, 'Mid-Rotation', 86, 5],
  ['NYM', 'NYM-3', 'Luis Severino', 'R', 4.38, 4.24, 1.33, 22.2, 8.1, 1.14, 5.2, 95, 'Back-End', 82, 4],
  ['NYY', 'NYY-1', 'Gerrit Cole', 'R', 3.33, 3.28, 1.11, 28.7, 5.9, 0.84, 6.1, 112, 'Ace', 94, 5],
  ['NYY', 'NYY-2', 'Carlos Rodon', 'L', 3.82, 3.74, 1.2, 27.9, 7.9, 0.95, 5.8, 104, 'Mid-Rotation', 89, 5],
  ['NYY', 'NYY-3', 'Nestor Cortes', 'L', 4.09, 4.0, 1.23, 23.7, 6.8, 1.07, 5.5, 100, 'Back-End', 84, 4],
  ['OAK', 'OAK-1', 'JP Sears', 'L', 4.43, 4.29, 1.31, 23.7, 8.0, 1.1, 5.5, 96, 'Ace', 86, 5],
  ['OAK', 'OAK-2', 'Paul Blackburn', 'R', 4.54, 4.39, 1.32, 18.4, 6.2, 1.16, 5.4, 94, 'Mid-Rotation', 84, 5],
  ['OAK', 'OAK-3', 'Joe Boyle', 'R', 4.88, 4.71, 1.39, 27.0, 13.1, 1.12, 4.9, 91, 'Back-End', 80, 4],
  ['PHI', 'PHI-1', 'Zack Wheeler', 'R', 3.45, 3.39, 1.13, 28.2, 5.9, 0.86, 6.2, 110, 'Ace', 95, 5],
  ['PHI', 'PHI-2', 'Aaron Nola', 'R', 3.79, 3.71, 1.15, 24.9, 5.8, 1.03, 6.0, 105, 'Mid-Rotation', 91, 5],
  ['PHI', 'PHI-3', 'Ranger Suarez', 'L', 4.02, 3.91, 1.22, 22.9, 6.9, 0.98, 5.7, 101, 'Back-End', 87, 4],
  ['PIT', 'PIT-1', 'Mitch Keller', 'R', 4.12, 4.01, 1.27, 24.4, 7.6, 1.05, 5.7, 99, 'Ace', 90, 5],
  ['PIT', 'PIT-2', 'Martin Perez', 'L', 4.28, 4.13, 1.34, 18.9, 8.2, 1.11, 5.5, 95, 'Mid-Rotation', 84, 5],
  ['PIT', 'PIT-3', 'Jared Jones', 'R', 4.36, 4.17, 1.25, 28.4, 8.8, 1.01, 5.1, 98, 'Back-End', 81, 4],
  ['SD', 'SD-1', 'Joe Musgrove', 'R', 3.56, 3.47, 1.16, 27.6, 6.2, 0.88, 6.1, 109, 'Ace', 92, 5],
  ['SD', 'SD-2', 'Yu Darvish', 'R', 3.74, 3.63, 1.12, 26.0, 6.0, 0.92, 5.8, 106, 'Mid-Rotation', 88, 5],
  ['SD', 'SD-3', 'Michael King', 'R', 4.02, 3.88, 1.21, 28.3, 7.4, 0.95, 5.5, 103, 'Back-End', 85, 4],
  ['SEA', 'SEA-1', 'Luis Castillo', 'R', 3.34, 3.3, 1.09, 29.0, 5.8, 0.82, 6.3, 113, 'Ace', 95, 5],
  ['SEA', 'SEA-2', 'Logan Gilbert', 'R', 3.56, 3.47, 1.09, 27.2, 4.8, 0.89, 6.1, 109, 'Mid-Rotation', 91, 5],
  ['SEA', 'SEA-3', 'George Kirby', 'R', 3.78, 3.66, 1.05, 25.7, 3.0, 0.94, 6.0, 108, 'Back-End', 90, 4],
  ['SF', 'SF-1', 'Logan Webb', 'L', 3.95, 3.83, 1.22, 25.5, 6.9, 0.97, 5.8, 104, 'Ace', 93, 5],
  ['SF', 'SF-2', 'Jordan Hicks', 'R', 4.06, 3.98, 1.25, 22.0, 8.2, 0.94, 5.5, 99, 'Mid-Rotation', 87, 5],
  ['SF', 'SF-3', 'Kyle Harrison', 'L', 4.29, 4.13, 1.31, 24.4, 8.7, 1.03, 5.2, 96, 'Back-End', 82, 4],
  ['STL', 'STL-1', 'Sonny Gray', 'R', 4.09, 3.99, 1.25, 24.6, 7.1, 1.06, 5.7, 100, 'Ace', 91, 5],
  ['STL', 'STL-2', 'Miles Mikolas', 'R', 4.23, 4.12, 1.27, 17.1, 4.8, 1.18, 5.8, 97, 'Mid-Rotation', 87, 5],
  ['STL', 'STL-3', 'Lance Lynn', 'R', 4.57, 4.38, 1.36, 24.2, 8.7, 1.28, 5.3, 93, 'Back-End', 83, 4],
  ['TB', 'TB-1', 'Zach Eflin', 'L', 3.71, 3.65, 1.18, 26.8, 6.5, 0.93, 5.9, 107, 'Ace', 91, 5],
  ['TB', 'TB-2', 'Aaron Civale', 'R', 4.01, 3.93, 1.2, 21.7, 6.2, 1.04, 5.8, 101, 'Mid-Rotation', 87, 5],
  ['TB', 'TB-3', 'Taj Bradley', 'R', 4.24, 4.05, 1.27, 28.8, 8.9, 1.06, 5.1, 98, 'Back-End', 82, 4],
  ['TEX', 'TEX-1', 'Nathan Eovaldi', 'R', 4.0, 3.91, 1.23, 25.2, 7.0, 1.03, 5.8, 102, 'Ace', 90, 5],
  ['TEX', 'TEX-2', 'Jon Gray', 'R', 4.12, 4.01, 1.25, 24.1, 7.5, 1.11, 5.6, 99, 'Mid-Rotation', 86, 5],
  ['TEX', 'TEX-3', 'Dane Dunning', 'R', 4.41, 4.24, 1.34, 20.3, 7.8, 1.13, 5.3, 95, 'Back-End', 82, 4],
  ['TOR', 'TOR-1', 'Kevin Gausman', 'R', 3.9, 3.82, 1.22, 25.8, 6.8, 0.98, 5.9, 104, 'Ace', 92, 5],
  ['TOR', 'TOR-2', 'Jose Berrios', 'R', 4.05, 3.96, 1.24, 23.6, 6.5, 1.08, 5.8, 100, 'Mid-Rotation', 88, 5],
  ['TOR', 'TOR-3', 'Chris Bassitt', 'R', 4.16, 4.04, 1.25, 23.0, 7.1, 1.07, 5.7, 99, 'Back-End', 86, 4],
  ['WSH', 'WSH-1', 'MacKenzie Gore', 'L', 4.32, 4.18, 1.29, 23.8, 7.9, 1.08, 5.6, 97, 'Ace', 89, 5],
  ['WSH', 'WSH-2', 'Josiah Gray', 'R', 4.41, 4.28, 1.33, 22.7, 8.6, 1.12, 5.3, 95, 'Mid-Rotation', 84, 5],
  ['WSH', 'WSH-3', 'Trevor Williams', 'R', 4.62, 4.43, 1.37, 18.8, 7.2, 1.18, 5.2, 92, 'Back-End', 81, 4],
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
}) {
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

  const runs =
    4.35 * splitIndex * styleAdj * blendedPrevention * defenseAdj * parkFactor * weather * lineupAdj * playoffAdj

  return {
    runs: clamp(runs, 2.3, 8.7),
    opposingStarterInnings: starterInnings,
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
  })

  const projectedHomeRuns = clamp(homeProjection.runs + 0.18, 2.4, 8.8)
  const projectedAwayRuns = clamp(awayProjection.runs, 2.2, 8.6)
  const projectedTotal = projectedHomeRuns + projectedAwayRuns
  const projectedMargin = projectedHomeRuns - projectedAwayRuns

  const winProb = clamp(1 / (1 + Math.exp(-(projectedMargin / 1.82))), 0.09, 0.91)
  const homeRunLineCoverProb = clamp(1 - normCDF((1.5 - projectedMargin) / 2.45), 0.08, 0.86)
  const awayRunLineCoverProb = 1 - homeRunLineCoverProb
  const totalStdDev = 2.05 + Math.abs(weather - 1) * 2.8
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
  }
}

export function normCDF(z: number): number {
  return 0.5 * (1 + Math.sign(z) * (1 - Math.exp(-0.7071 * z * z * (1 + 0.2316419 * Math.abs(z)))))
}
