import type { Match } from '../types'

export const TEAM_ISO: Record<string, string> = {
  'Mexico':         'mx',
  'South Africa':   'za',
  'South Korea':    'kr',
  'Czech Republic': 'cz',
}

export const TEAM_NAMES_HE: Record<string, string> = {
  'Mexico':         'מקסיקו',
  'South Africa':   'דרום אפריקה',
  'South Korea':    'דרום קוריאה',
  'Czech Republic': 'צ׳כיה',
}

export const GROUP_A_MATCHES: Match[] = [
  { id: 'A1', homeTeam: 'Mexico',       awayTeam: 'South Africa' },
  { id: 'A2', homeTeam: 'South Korea',  awayTeam: 'Czech Republic' },
  { id: 'A3', homeTeam: 'Czech Republic', awayTeam: 'South Africa' },
  { id: 'A4', homeTeam: 'Mexico',       awayTeam: 'South Korea' },
  { id: 'A5', homeTeam: 'Czech Republic', awayTeam: 'Mexico' },
  { id: 'A6', homeTeam: 'South Africa', awayTeam: 'South Korea' },
]
