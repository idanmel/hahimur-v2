export type Score = number | null

export interface Match {
  id: string
  homeTeam: string
  awayTeam: string
  matchDate?: string
  kickoffIST?: string
}

export interface MatchScores {
  home: Score
  away: Score
}

export interface Standing {
  team: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  points: number
}
