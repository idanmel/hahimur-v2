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
  { id: 'A1', homeTeam: 'Mexico',         awayTeam: 'South Africa',   matchDate: '11 ביוני', kickoffIST: '22:00' },
  { id: 'A2', homeTeam: 'South Korea',    awayTeam: 'Czech Republic', matchDate: '12 ביוני', kickoffIST: '05:00' },
  { id: 'A3', homeTeam: 'Czech Republic', awayTeam: 'South Africa',   matchDate: '18 ביוני', kickoffIST: '19:00' },
  { id: 'A4', homeTeam: 'Mexico',         awayTeam: 'South Korea',    matchDate: '19 ביוני', kickoffIST: '04:00' },
  { id: 'A5', homeTeam: 'Czech Republic', awayTeam: 'Mexico',         matchDate: '25 ביוני', kickoffIST: '04:00' },
  { id: 'A6', homeTeam: 'South Africa',   awayTeam: 'South Korea',    matchDate: '25 ביוני', kickoffIST: '04:00' },
]
