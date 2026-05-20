import type { Match } from '../types'

export const TEAMS: Record<string, { iso: string; he: string }> = {
  // Group A
  'Mexico':                  { iso: 'mx',     he: 'מקסיקו' },
  'South Africa':            { iso: 'za',     he: 'דרום אפריקה' },
  'South Korea':             { iso: 'kr',     he: 'דרום קוריאה' },
  'Czech Republic':          { iso: 'cz',     he: 'צ׳כיה' },
  // Group B
  'Canada':                  { iso: 'ca',     he: 'קנדה' },
  'Bosnia and Herzegovina':  { iso: 'ba',     he: 'בוסניה והרצגובינה' },
  'Qatar':                   { iso: 'qa',     he: 'קטר' },
  'Switzerland':             { iso: 'ch',     he: 'שווייץ' },
  // Group C
  'Brazil':                  { iso: 'br',     he: 'ברזיל' },
  'Morocco':                 { iso: 'ma',     he: 'מרוקו' },
  'Haiti':                   { iso: 'ht',     he: 'האיטי' },
  'Scotland':                { iso: 'gb-sct', he: 'סקוטלנד' },
  // Group D
  'United States':           { iso: 'us',     he: 'ארצות הברית' },
  'Paraguay':                { iso: 'py',     he: 'פרגוואי' },
  'Australia':               { iso: 'au',     he: 'אוסטרליה' },
  'Turkey':                  { iso: 'tr',     he: 'טורקיה' },
  // Group E
  'Germany':                 { iso: 'de',     he: 'גרמניה' },
  'Curaçao':                 { iso: 'cw',     he: 'קוראסאו' },
  'Ivory Coast':             { iso: 'ci',     he: 'חוף השנהב' },
  'Ecuador':                 { iso: 'ec',     he: 'אקוודור' },
  // Group F
  'Netherlands':             { iso: 'nl',     he: 'הולנד' },
  'Japan':                   { iso: 'jp',     he: 'יפן' },
  'Sweden':                  { iso: 'se',     he: 'שוודיה' },
  'Tunisia':                 { iso: 'tn',     he: 'תוניסיה' },
  // Group G
  'Belgium':                 { iso: 'be',     he: 'בלגיה' },
  'Egypt':                   { iso: 'eg',     he: 'מצרים' },
  'Iran':                    { iso: 'ir',     he: 'איראן' },
  'New Zealand':             { iso: 'nz',     he: 'ניו זילנד' },
  // Group H
  'Spain':                   { iso: 'es',     he: 'ספרד' },
  'Cape Verde':              { iso: 'cv',     he: 'קאבו ורדה' },
  'Saudi Arabia':            { iso: 'sa',     he: 'ערב הסעודית' },
  'Uruguay':                 { iso: 'uy',     he: 'אורוגוואי' },
  // Group I
  'France':                  { iso: 'fr',     he: 'צרפת' },
  'Senegal':                 { iso: 'sn',     he: 'סנגל' },
  'Iraq':                    { iso: 'iq',     he: 'עיראק' },
  'Norway':                  { iso: 'no',     he: 'נורווגיה' },
  // Group J
  'Argentina':               { iso: 'ar',     he: 'ארגנטינה' },
  'Austria':                 { iso: 'at',     he: 'אוסטריה' },
  'Algeria':                 { iso: 'dz',     he: 'אלג׳יריה' },
  'Jordan':                  { iso: 'jo',     he: 'ירדן' },
  // Group K
  'Portugal':                { iso: 'pt',     he: 'פורטוגל' },
  'DR Congo':                { iso: 'cd',     he: 'קונגו' },
  'Uzbekistan':              { iso: 'uz',     he: 'אוזבקיסטן' },
  'Colombia':                { iso: 'co',     he: 'קולומביה' },
  // Group L
  'England':                 { iso: 'gb-eng', he: 'אנגליה' },
  'Croatia':                 { iso: 'hr',     he: 'קרואטיה' },
  'Ghana':                   { iso: 'gh',     he: 'גאנה' },
  'Panama':                  { iso: 'pa',     he: 'פנמה' },
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

export const GROUP_C_MATCHES: Match[] = [
  { id: 'C1', homeTeam: 'Brazil',   awayTeam: 'Morocco',  matchDate: '14 ביוני', kickoffIST: '01:00' },
  { id: 'C2', homeTeam: 'Haiti',    awayTeam: 'Scotland', matchDate: '14 ביוני', kickoffIST: '04:00' },
  { id: 'C3', homeTeam: 'Scotland', awayTeam: 'Morocco',  matchDate: '20 ביוני', kickoffIST: '01:00' },
  { id: 'C4', homeTeam: 'Brazil',   awayTeam: 'Haiti',    matchDate: '20 ביוני', kickoffIST: '03:30' },
  { id: 'C5', homeTeam: 'Scotland', awayTeam: 'Brazil',   matchDate: '25 ביוני', kickoffIST: '01:00' },
  { id: 'C6', homeTeam: 'Morocco',  awayTeam: 'Haiti',    matchDate: '25 ביוני', kickoffIST: '01:00' },
]

export const GROUP_D_MATCHES: Match[] = [
  { id: 'D1', homeTeam: 'United States', awayTeam: 'Paraguay',      matchDate: '13 ביוני', kickoffIST: '04:00' },
  { id: 'D2', homeTeam: 'Australia',     awayTeam: 'Turkey',        matchDate: '14 ביוני', kickoffIST: '07:00' },
  { id: 'D3', homeTeam: 'United States', awayTeam: 'Australia',     matchDate: '19 ביוני', kickoffIST: '22:00' },
  { id: 'D4', homeTeam: 'Turkey',        awayTeam: 'Paraguay',      matchDate: '20 ביוני', kickoffIST: '06:00' },
  { id: 'D5', homeTeam: 'Turkey',        awayTeam: 'United States', matchDate: '26 ביוני', kickoffIST: '05:00' },
  { id: 'D6', homeTeam: 'Paraguay',      awayTeam: 'Australia',     matchDate: '26 ביוני', kickoffIST: '05:00' },
]

export const GROUP_E_MATCHES: Match[] = [
  { id: 'E1', homeTeam: 'Germany',     awayTeam: 'Curaçao',     matchDate: '14 ביוני', kickoffIST: '20:00' },
  { id: 'E2', homeTeam: 'Ivory Coast', awayTeam: 'Ecuador',     matchDate: '15 ביוני', kickoffIST: '02:00' },
  { id: 'E3', homeTeam: 'Germany',     awayTeam: 'Ivory Coast', matchDate: '20 ביוני', kickoffIST: '23:00' },
  { id: 'E4', homeTeam: 'Ecuador',     awayTeam: 'Curaçao',     matchDate: '21 ביוני', kickoffIST: '03:00' },
  { id: 'E5', homeTeam: 'Curaçao',    awayTeam: 'Ivory Coast', matchDate: '25 ביוני', kickoffIST: '23:00' },
  { id: 'E6', homeTeam: 'Ecuador',     awayTeam: 'Germany',     matchDate: '25 ביוני', kickoffIST: '23:00' },
]

export const GROUP_F_MATCHES: Match[] = [
  { id: 'F1', homeTeam: 'Netherlands', awayTeam: 'Japan',       matchDate: '14 ביוני', kickoffIST: '23:00' },
  { id: 'F2', homeTeam: 'Sweden',      awayTeam: 'Tunisia',     matchDate: '15 ביוני', kickoffIST: '05:00' },
  { id: 'F3', homeTeam: 'Netherlands', awayTeam: 'Sweden',      matchDate: '20 ביוני', kickoffIST: '20:00' },
  { id: 'F4', homeTeam: 'Tunisia',     awayTeam: 'Japan',       matchDate: '21 ביוני', kickoffIST: '07:00' },
  { id: 'F5', homeTeam: 'Japan',       awayTeam: 'Sweden',      matchDate: '26 ביוני', kickoffIST: '02:00' },
  { id: 'F6', homeTeam: 'Tunisia',     awayTeam: 'Netherlands', matchDate: '26 ביוני', kickoffIST: '02:00' },
]

export const GROUP_G_MATCHES: Match[] = [
  { id: 'G1', homeTeam: 'Belgium',     awayTeam: 'Egypt',       matchDate: '15 ביוני', kickoffIST: '22:00' },
  { id: 'G2', homeTeam: 'Iran',        awayTeam: 'New Zealand', matchDate: '16 ביוני', kickoffIST: '04:00' },
  { id: 'G3', homeTeam: 'Belgium',     awayTeam: 'Iran',        matchDate: '21 ביוני', kickoffIST: '22:00' },
  { id: 'G4', homeTeam: 'New Zealand', awayTeam: 'Egypt',       matchDate: '22 ביוני', kickoffIST: '04:00' },
  { id: 'G5', homeTeam: 'Egypt',       awayTeam: 'Iran',        matchDate: '27 ביוני', kickoffIST: '06:00' },
  { id: 'G6', homeTeam: 'New Zealand', awayTeam: 'Belgium',     matchDate: '27 ביוני', kickoffIST: '06:00' },
]

export const GROUP_H_MATCHES: Match[] = [
  { id: 'H1', homeTeam: 'Spain',        awayTeam: 'Cape Verde',   matchDate: '15 ביוני', kickoffIST: '19:00' },
  { id: 'H2', homeTeam: 'Saudi Arabia', awayTeam: 'Uruguay',      matchDate: '16 ביוני', kickoffIST: '01:00' },
  { id: 'H3', homeTeam: 'Spain',        awayTeam: 'Saudi Arabia', matchDate: '21 ביוני', kickoffIST: '19:00' },
  { id: 'H4', homeTeam: 'Uruguay',      awayTeam: 'Cape Verde',   matchDate: '22 ביוני', kickoffIST: '01:00' },
  { id: 'H5', homeTeam: 'Cape Verde',   awayTeam: 'Saudi Arabia', matchDate: '27 ביוני', kickoffIST: '03:00' },
  { id: 'H6', homeTeam: 'Uruguay',      awayTeam: 'Spain',        matchDate: '27 ביוני', kickoffIST: '03:00' },
]

export const GROUP_I_MATCHES: Match[] = [
  { id: 'I1', homeTeam: 'France',  awayTeam: 'Senegal', matchDate: '16 ביוני', kickoffIST: '22:00' },
  { id: 'I2', homeTeam: 'Iraq',    awayTeam: 'Norway',  matchDate: '17 ביוני', kickoffIST: '01:00' },
  { id: 'I3', homeTeam: 'France',  awayTeam: 'Iraq',    matchDate: '23 ביוני', kickoffIST: '00:00' },
  { id: 'I4', homeTeam: 'Norway',  awayTeam: 'Senegal', matchDate: '23 ביוני', kickoffIST: '03:00' },
  { id: 'I5', homeTeam: 'Norway',  awayTeam: 'France',  matchDate: '26 ביוני', kickoffIST: '22:00' },
  { id: 'I6', homeTeam: 'Senegal', awayTeam: 'Iraq',    matchDate: '26 ביוני', kickoffIST: '22:00' },
]

export const GROUP_J_MATCHES: Match[] = [
  { id: 'J1', homeTeam: 'Argentina', awayTeam: 'Algeria',   matchDate: '17 ביוני', kickoffIST: '04:00' },
  { id: 'J2', homeTeam: 'Austria',   awayTeam: 'Jordan',    matchDate: '17 ביוני', kickoffIST: '07:00' },
  { id: 'J3', homeTeam: 'Argentina', awayTeam: 'Austria',   matchDate: '22 ביוני', kickoffIST: '20:00' },
  { id: 'J4', homeTeam: 'Jordan',    awayTeam: 'Algeria',   matchDate: '23 ביוני', kickoffIST: '06:00' },
  { id: 'J5', homeTeam: 'Algeria',   awayTeam: 'Austria',   matchDate: '28 ביוני', kickoffIST: '05:00' },
  { id: 'J6', homeTeam: 'Jordan',    awayTeam: 'Argentina', matchDate: '28 ביוני', kickoffIST: '05:00' },
]

export const GROUP_K_MATCHES: Match[] = [
  { id: 'K1', homeTeam: 'Portugal',   awayTeam: 'DR Congo',   matchDate: '17 ביוני', kickoffIST: '20:00' },
  { id: 'K2', homeTeam: 'Uzbekistan', awayTeam: 'Colombia',   matchDate: '18 ביוני', kickoffIST: '05:00' },
  { id: 'K3', homeTeam: 'Portugal',   awayTeam: 'Uzbekistan', matchDate: '23 ביוני', kickoffIST: '20:00' },
  { id: 'K4', homeTeam: 'Colombia',   awayTeam: 'DR Congo',   matchDate: '24 ביוני', kickoffIST: '05:00' },
  { id: 'K5', homeTeam: 'Colombia',   awayTeam: 'Portugal',   matchDate: '28 ביוני', kickoffIST: '02:30' },
  { id: 'K6', homeTeam: 'DR Congo',   awayTeam: 'Uzbekistan', matchDate: '28 ביוני', kickoffIST: '02:30' },
]

export const GROUP_L_MATCHES: Match[] = [
  { id: 'L1', homeTeam: 'England', awayTeam: 'Croatia', matchDate: '17 ביוני', kickoffIST: '23:00' },
  { id: 'L2', homeTeam: 'Ghana',   awayTeam: 'Panama',  matchDate: '18 ביוני', kickoffIST: '02:00' },
  { id: 'L3', homeTeam: 'England', awayTeam: 'Ghana',   matchDate: '23 ביוני', kickoffIST: '23:00' },
  { id: 'L4', homeTeam: 'Panama',  awayTeam: 'Croatia', matchDate: '24 ביוני', kickoffIST: '02:00' },
  { id: 'L5', homeTeam: 'Panama',  awayTeam: 'England', matchDate: '28 ביוני', kickoffIST: '00:00' },
  { id: 'L6', homeTeam: 'Croatia', awayTeam: 'Ghana',   matchDate: '28 ביוני', kickoffIST: '00:00' },
]

export const GROUP_MATCHES: Record<string, Match[]> = {
  A: GROUP_A_MATCHES, B: GROUP_B_MATCHES, C: GROUP_C_MATCHES,
  D: GROUP_D_MATCHES, E: GROUP_E_MATCHES, F: GROUP_F_MATCHES,
  G: GROUP_G_MATCHES, H: GROUP_H_MATCHES, I: GROUP_I_MATCHES,
  J: GROUP_J_MATCHES, K: GROUP_K_MATCHES, L: GROUP_L_MATCHES,
}
