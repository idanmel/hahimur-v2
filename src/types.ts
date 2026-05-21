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

export interface ThirdPlaceStanding extends Standing {
  group: string
}

export type ThirdPlaceQualification =
  | { resolved: true;  all: ThirdPlaceStanding[]; qualifiers: ThirdPlaceStanding[] }
  | { resolved: false; all: ThirdPlaceStanding[]; tied: ThirdPlaceStanding[] }

export interface R32Match {
  matchNum: number
  home: string
  away: string
  resolved: boolean
}

export interface KnockoutMatch {
  matchNum: number
  matchId: string
  home: string
  away: string
  resolved: boolean
}
