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
  drawWinner?: 'home' | 'away'
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

export interface GroupMatch extends Match {
  scores?: MatchScores
}

export interface KnockoutMatch {
  matchNum: number
  home: string
  away: string
  resolved: boolean
  scores?: MatchScores
  matchDate?: string
  kickoffIST?: string
}

export interface KnockoutStages {
  r32: KnockoutMatch[]
  r16: KnockoutMatch[]
  qf: KnockoutMatch[]
  sf: KnockoutMatch[]
  thirdPlace: KnockoutMatch[]
  final: KnockoutMatch[]
}

export type PredictionsState = Record<string, MatchScores>

export function isUnpredicted(scores: MatchScores): boolean {
  return scores.home === null || scores.away === null
}
