import type { Match } from '../types'

export const TEAM_ISO: Record<string, string> = {
  'Mexico':                  'mx',
  'South Africa':            'za',
  'South Korea':             'kr',
  'Czech Republic':          'cz',
  'Canada':                  'ca',
  'Bosnia and Herzegovina':  'ba',
  'Qatar':                   'qa',
  'Switzerland':             'ch',
}

export const TEAM_NAMES_HE: Record<string, string> = {
  'Mexico':                  'מקסיקו',
  'South Africa':            'דרום אפריקה',
  'South Korea':             'דרום קוריאה',
  'Czech Republic':          'צ׳כיה',
  'Canada':                  'קנדה',
  'Bosnia and Herzegovina':  'בוסניה והרצגובינה',
  'Qatar':                   'קטר',
  'Switzerland':             'שווייץ',
}

export const GROUP_A_MATCHES: Match[] = [
  { id: 'A1', homeTeam: 'Mexico',         awayTeam: 'South Africa',   matchDate: '11 ביוני', kickoffIST: '22:00' },
  { id: 'A2', homeTeam: 'South Korea',    awayTeam: 'Czech Republic', matchDate: '12 ביוני', kickoffIST: '05:00' },
  { id: 'A3', homeTeam: 'Czech Republic', awayTeam: 'South Africa',   matchDate: '18 ביוני', kickoffIST: '19:00' },
  { id: 'A4', homeTeam: 'Mexico',         awayTeam: 'South Korea',    matchDate: '19 ביוני', kickoffIST: '04:00' },
  { id: 'A5', homeTeam: 'Czech Republic', awayTeam: 'Mexico',         matchDate: '25 ביוני', kickoffIST: '04:00' },
  { id: 'A6', homeTeam: 'South Africa',   awayTeam: 'South Korea',    matchDate: '25 ביוני', kickoffIST: '04:00' },
]

export const GROUP_B_MATCHES: Match[] = [
  { id: 'B1', homeTeam: 'Canada',                 awayTeam: 'Bosnia and Herzegovina', matchDate: '12 ביוני', kickoffIST: '22:00' },
  { id: 'B2', homeTeam: 'Qatar',                  awayTeam: 'Switzerland',            matchDate: '13 ביוני', kickoffIST: '22:00' },
  { id: 'B3', homeTeam: 'Switzerland',            awayTeam: 'Bosnia and Herzegovina', matchDate: '18 ביוני', kickoffIST: '22:00' },
  { id: 'B4', homeTeam: 'Canada',                 awayTeam: 'Qatar',                  matchDate: '19 ביוני', kickoffIST: '01:00' },
  { id: 'B5', homeTeam: 'Switzerland',            awayTeam: 'Canada',                 matchDate: '24 ביוני', kickoffIST: '22:00' },
  { id: 'B6', homeTeam: 'Bosnia and Herzegovina', awayTeam: 'Qatar',                  matchDate: '24 ביוני', kickoffIST: '22:00' },
]
