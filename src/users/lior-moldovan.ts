import type { Standing, ThirdPlaceStanding, ThirdPlaceQualification, KnockoutStages, GroupMatch } from '../shared/types'

export const topGoalscorer = 'קיליאן אמבפה'
export const label = 'ליאור מולדובן'

export const groupMatches: Record<string, GroupMatch[]> = {
  A: [
    { id: 'A1', homeTeam: 'Mexico', awayTeam: 'South Africa', matchDate: '11 ביוני', kickoffIST: '22:00', scores: { home: 2, away: 0 } },
    { id: 'A2', homeTeam: 'South Korea', awayTeam: 'Czech Republic', matchDate: '12 ביוני', kickoffIST: '05:00', scores: { home: 0, away: 0 } },
    { id: 'A3', homeTeam: 'Czech Republic', awayTeam: 'South Africa', matchDate: '18 ביוני', kickoffIST: '19:00', scores: { home: 1, away: 0 } },
    { id: 'A4', homeTeam: 'Mexico', awayTeam: 'South Korea', matchDate: '19 ביוני', kickoffIST: '04:00', scores: { home: 1, away: 0 } },
    { id: 'A5', homeTeam: 'Czech Republic', awayTeam: 'Mexico', matchDate: '25 ביוני', kickoffIST: '04:00', scores: { home: 0, away: 2 } },
    { id: 'A6', homeTeam: 'South Africa', awayTeam: 'South Korea', matchDate: '25 ביוני', kickoffIST: '04:00', scores: { home: 0, away: 1 } },
  ],
  B: [
    { id: 'B1', homeTeam: 'Canada', awayTeam: 'Bosnia and Herzegovina', matchDate: '12 ביוני', kickoffIST: '22:00', scores: { home: 1, away: 1 } },
    { id: 'B2', homeTeam: 'Qatar', awayTeam: 'Switzerland', matchDate: '13 ביוני', kickoffIST: '22:00', scores: { home: 0, away: 2 } },
    { id: 'B3', homeTeam: 'Switzerland', awayTeam: 'Bosnia and Herzegovina', matchDate: '18 ביוני', kickoffIST: '22:00', scores: { home: 2, away: 0 } },
    { id: 'B4', homeTeam: 'Canada', awayTeam: 'Qatar', matchDate: '19 ביוני', kickoffIST: '01:00', scores: { home: 2, away: 0 } },
    { id: 'B5', homeTeam: 'Switzerland', awayTeam: 'Canada', matchDate: '24 ביוני', kickoffIST: '22:00', scores: { home: 1, away: 0 } },
    { id: 'B6', homeTeam: 'Bosnia and Herzegovina', awayTeam: 'Qatar', matchDate: '24 ביוני', kickoffIST: '22:00', scores: { home: 1, away: 0 } },
  ],
  C: [
    { id: 'C1', homeTeam: 'Brazil', awayTeam: 'Morocco', matchDate: '14 ביוני', kickoffIST: '01:00', scores: { home: 2, away: 1 } },
    { id: 'C2', homeTeam: 'Haiti', awayTeam: 'Scotland', matchDate: '14 ביוני', kickoffIST: '04:00', scores: { home: 0, away: 1 } },
    { id: 'C3', homeTeam: 'Scotland', awayTeam: 'Morocco', matchDate: '20 ביוני', kickoffIST: '01:00', scores: { home: 0, away: 2 } },
    { id: 'C4', homeTeam: 'Brazil', awayTeam: 'Haiti', matchDate: '20 ביוני', kickoffIST: '03:30', scores: { home: 3, away: 0 } },
    { id: 'C5', homeTeam: 'Scotland', awayTeam: 'Brazil', matchDate: '25 ביוני', kickoffIST: '01:00', scores: { home: 0, away: 2 } },
    { id: 'C6', homeTeam: 'Morocco', awayTeam: 'Haiti', matchDate: '25 ביוני', kickoffIST: '01:00', scores: { home: 2, away: 0 } },
  ],
  D: [
    { id: 'D1', homeTeam: 'United States', awayTeam: 'Paraguay', matchDate: '13 ביוני', kickoffIST: '04:00', scores: { home: 2, away: 0 } },
    { id: 'D2', homeTeam: 'Australia', awayTeam: 'Turkey', matchDate: '14 ביוני', kickoffIST: '07:00', scores: { home: 1, away: 2 } },
    { id: 'D3', homeTeam: 'United States', awayTeam: 'Australia', matchDate: '19 ביוני', kickoffIST: '22:00', scores: { home: 1, away: 1 } },
    { id: 'D4', homeTeam: 'Turkey', awayTeam: 'Paraguay', matchDate: '20 ביוני', kickoffIST: '06:00', scores: { home: 1, away: 1 } },
    { id: 'D5', homeTeam: 'Turkey', awayTeam: 'United States', matchDate: '26 ביוני', kickoffIST: '05:00', scores: { home: 1, away: 2 } },
    { id: 'D6', homeTeam: 'Paraguay', awayTeam: 'Australia', matchDate: '26 ביוני', kickoffIST: '05:00', scores: { home: 1, away: 0 } },
  ],
  E: [
    { id: 'E1', homeTeam: 'Germany', awayTeam: 'Curaçao', matchDate: '14 ביוני', kickoffIST: '20:00', scores: { home: 3, away: 0 } },
    { id: 'E2', homeTeam: 'Ivory Coast', awayTeam: 'Ecuador', matchDate: '15 ביוני', kickoffIST: '02:00', scores: { home: 1, away: 1 } },
    { id: 'E3', homeTeam: 'Germany', awayTeam: 'Ivory Coast', matchDate: '20 ביוני', kickoffIST: '23:00', scores: { home: 2, away: 0 } },
    { id: 'E4', homeTeam: 'Ecuador', awayTeam: 'Curaçao', matchDate: '21 ביוני', kickoffIST: '03:00', scores: { home: 2, away: 0 } },
    { id: 'E5', homeTeam: 'Curaçao', awayTeam: 'Ivory Coast', matchDate: '25 ביוני', kickoffIST: '23:00', scores: { home: 0, away: 2 } },
    { id: 'E6', homeTeam: 'Ecuador', awayTeam: 'Germany', matchDate: '25 ביוני', kickoffIST: '23:00', scores: { home: 1, away: 2 } },
  ],
  F: [
    { id: 'F1', homeTeam: 'Netherlands', awayTeam: 'Japan', matchDate: '14 ביוני', kickoffIST: '23:00', scores: { home: 2, away: 1 } },
    { id: 'F2', homeTeam: 'Sweden', awayTeam: 'Tunisia', matchDate: '15 ביוני', kickoffIST: '05:00', scores: { home: 1, away: 0 } },
    { id: 'F3', homeTeam: 'Netherlands', awayTeam: 'Sweden', matchDate: '20 ביוני', kickoffIST: '20:00', scores: { home: 2, away: 0 } },
    { id: 'F4', homeTeam: 'Tunisia', awayTeam: 'Japan', matchDate: '21 ביוני', kickoffIST: '07:00', scores: { home: 0, away: 1 } },
    { id: 'F5', homeTeam: 'Japan', awayTeam: 'Sweden', matchDate: '26 ביוני', kickoffIST: '02:00', scores: { home: 1, away: 1 } },
    { id: 'F6', homeTeam: 'Tunisia', awayTeam: 'Netherlands', matchDate: '26 ביוני', kickoffIST: '02:00', scores: { home: 0, away: 2 } },
  ],
  G: [
    { id: 'G1', homeTeam: 'Belgium', awayTeam: 'Egypt', matchDate: '15 ביוני', kickoffIST: '22:00', scores: { home: 2, away: 0 } },
    { id: 'G2', homeTeam: 'Iran', awayTeam: 'New Zealand', matchDate: '16 ביוני', kickoffIST: '04:00', scores: { home: 1, away: 0 } },
    { id: 'G3', homeTeam: 'Belgium', awayTeam: 'Iran', matchDate: '21 ביוני', kickoffIST: '22:00', scores: { home: 2, away: 0 } },
    { id: 'G4', homeTeam: 'New Zealand', awayTeam: 'Egypt', matchDate: '22 ביוני', kickoffIST: '04:00', scores: { home: 0, away: 2 } },
    { id: 'G5', homeTeam: 'Egypt', awayTeam: 'Iran', matchDate: '27 ביוני', kickoffIST: '06:00', scores: { home: 1, away: 1 } },
    { id: 'G6', homeTeam: 'New Zealand', awayTeam: 'Belgium', matchDate: '27 ביוני', kickoffIST: '06:00', scores: { home: 0, away: 3 } },
  ],
  H: [
    { id: 'H1', homeTeam: 'Spain', awayTeam: 'Cape Verde', matchDate: '15 ביוני', kickoffIST: '19:00', scores: { home: 3, away: 0 } },
    { id: 'H2', homeTeam: 'Saudi Arabia', awayTeam: 'Uruguay', matchDate: '16 ביוני', kickoffIST: '01:00', scores: { home: 0, away: 2 } },
    { id: 'H3', homeTeam: 'Spain', awayTeam: 'Saudi Arabia', matchDate: '21 ביוני', kickoffIST: '19:00', scores: { home: 2, away: 0 } },
    { id: 'H4', homeTeam: 'Uruguay', awayTeam: 'Cape Verde', matchDate: '22 ביוני', kickoffIST: '01:00', scores: { home: 2, away: 0 } },
    { id: 'H5', homeTeam: 'Cape Verde', awayTeam: 'Saudi Arabia', matchDate: '27 ביוני', kickoffIST: '03:00', scores: { home: 0, away: 0 } },
    { id: 'H6', homeTeam: 'Uruguay', awayTeam: 'Spain', matchDate: '27 ביוני', kickoffIST: '03:00', scores: { home: 0, away: 1 } },
  ],
  I: [
    { id: 'I1', homeTeam: 'France', awayTeam: 'Senegal', matchDate: '16 ביוני', kickoffIST: '22:00', scores: { home: 2, away: 1 } },
    { id: 'I2', homeTeam: 'Iraq', awayTeam: 'Norway', matchDate: '17 ביוני', kickoffIST: '01:00', scores: { home: 0, away: 2 } },
    { id: 'I3', homeTeam: 'France', awayTeam: 'Iraq', matchDate: '23 ביוני', kickoffIST: '00:00', scores: { home: 3, away: 0 } },
    { id: 'I4', homeTeam: 'Norway', awayTeam: 'Senegal', matchDate: '23 ביוני', kickoffIST: '03:00', scores: { home: 1, away: 1 } },
    { id: 'I5', homeTeam: 'Norway', awayTeam: 'France', matchDate: '26 ביוני', kickoffIST: '22:00', scores: { home: 1, away: 1 } },
    { id: 'I6', homeTeam: 'Senegal', awayTeam: 'Iraq', matchDate: '26 ביוני', kickoffIST: '22:00', scores: { home: 2, away: 0 } },
  ],
  J: [
    { id: 'J1', homeTeam: 'Argentina', awayTeam: 'Algeria', matchDate: '17 ביוני', kickoffIST: '04:00', scores: { home: 2, away: 0 } },
    { id: 'J2', homeTeam: 'Austria', awayTeam: 'Jordan', matchDate: '17 ביוני', kickoffIST: '07:00', scores: { home: 2, away: 0 } },
    { id: 'J3', homeTeam: 'Argentina', awayTeam: 'Austria', matchDate: '22 ביוני', kickoffIST: '20:00', scores: { home: 2, away: 1 } },
    { id: 'J4', homeTeam: 'Jordan', awayTeam: 'Algeria', matchDate: '23 ביוני', kickoffIST: '06:00', scores: { home: 0, away: 1 } },
    { id: 'J5', homeTeam: 'Algeria', awayTeam: 'Austria', matchDate: '28 ביוני', kickoffIST: '05:00', scores: { home: 1, away: 1 } },
    { id: 'J6', homeTeam: 'Jordan', awayTeam: 'Argentina', matchDate: '28 ביוני', kickoffIST: '05:00', scores: { home: 0, away: 2 } },
  ],
  K: [
    { id: 'K1', homeTeam: 'Portugal', awayTeam: 'DR Congo', matchDate: '17 ביוני', kickoffIST: '20:00', scores: { home: 2, away: 0 } },
    { id: 'K2', homeTeam: 'Uzbekistan', awayTeam: 'Colombia', matchDate: '18 ביוני', kickoffIST: '05:00', scores: { home: 0, away: 2 } },
    { id: 'K3', homeTeam: 'Portugal', awayTeam: 'Uzbekistan', matchDate: '23 ביוני', kickoffIST: '20:00', scores: { home: 2, away: 0 } },
    { id: 'K4', homeTeam: 'Colombia', awayTeam: 'DR Congo', matchDate: '24 ביוני', kickoffIST: '05:00', scores: { home: 2, away: 1 } },
    { id: 'K5', homeTeam: 'Colombia', awayTeam: 'Portugal', matchDate: '28 ביוני', kickoffIST: '02:30', scores: { home: 1, away: 1 } },
    { id: 'K6', homeTeam: 'DR Congo', awayTeam: 'Uzbekistan', matchDate: '28 ביוני', kickoffIST: '02:30', scores: { home: 0, away: 0 } },
  ],
  L: [
    { id: 'L1', homeTeam: 'England', awayTeam: 'Croatia', matchDate: '17 ביוני', kickoffIST: '23:00', scores: { home: 2, away: 1 } },
    { id: 'L2', homeTeam: 'Ghana', awayTeam: 'Panama', matchDate: '18 ביוני', kickoffIST: '02:00', scores: { home: 1, away: 0 } },
    { id: 'L3', homeTeam: 'England', awayTeam: 'Ghana', matchDate: '23 ביוני', kickoffIST: '23:00', scores: { home: 2, away: 0 } },
    { id: 'L4', homeTeam: 'Panama', awayTeam: 'Croatia', matchDate: '24 ביוני', kickoffIST: '02:00', scores: { home: 0, away: 2 } },
    { id: 'L5', homeTeam: 'Panama', awayTeam: 'England', matchDate: '28 ביוני', kickoffIST: '00:00', scores: { home: 0, away: 3 } },
    { id: 'L6', homeTeam: 'Croatia', awayTeam: 'Ghana', matchDate: '28 ביוני', kickoffIST: '00:00', scores: { home: 1, away: 0 } },
  ],
}

export const groupTables: Record<string, Standing[]> = {
  A: [
    { team: 'Mexico', played: 3, won: 3, drawn: 0, lost: 0, goalsFor: 5, goalsAgainst: 0, points: 9 },
    { team: 'South Korea', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 1, goalsAgainst: 1, points: 4 },
    { team: 'Czech Republic', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 1, goalsAgainst: 2, points: 4 },
    { team: 'South Africa', played: 3, won: 0, drawn: 0, lost: 3, goalsFor: 0, goalsAgainst: 4, points: 0 },
  ],
  B: [
    { team: 'Switzerland', played: 3, won: 3, drawn: 0, lost: 0, goalsFor: 5, goalsAgainst: 0, points: 9 },
    { team: 'Canada', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 3, goalsAgainst: 2, points: 4 },
    { team: 'Bosnia and Herzegovina', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, points: 4 },
    { team: 'Qatar', played: 3, won: 0, drawn: 0, lost: 3, goalsFor: 0, goalsAgainst: 5, points: 0 },
  ],
  C: [
    { team: 'Brazil', played: 3, won: 3, drawn: 0, lost: 0, goalsFor: 7, goalsAgainst: 1, points: 9 },
    { team: 'Morocco', played: 3, won: 2, drawn: 0, lost: 1, goalsFor: 5, goalsAgainst: 2, points: 6 },
    { team: 'Scotland', played: 3, won: 1, drawn: 0, lost: 2, goalsFor: 1, goalsAgainst: 4, points: 3 },
    { team: 'Haiti', played: 3, won: 0, drawn: 0, lost: 3, goalsFor: 0, goalsAgainst: 6, points: 0 },
  ],
  D: [
    { team: 'United States', played: 3, won: 2, drawn: 1, lost: 0, goalsFor: 5, goalsAgainst: 2, points: 7 },
    { team: 'Turkey', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 4, goalsAgainst: 4, points: 4 },
    { team: 'Paraguay', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, points: 4 },
    { team: 'Australia', played: 3, won: 0, drawn: 1, lost: 2, goalsFor: 2, goalsAgainst: 4, points: 1 },
  ],
  E: [
    { team: 'Germany', played: 3, won: 3, drawn: 0, lost: 0, goalsFor: 7, goalsAgainst: 1, points: 9 },
    { team: 'Ecuador', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 4, goalsAgainst: 3, points: 4 },
    { team: 'Ivory Coast', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 3, goalsAgainst: 3, points: 4 },
    { team: 'Curaçao', played: 3, won: 0, drawn: 0, lost: 3, goalsFor: 0, goalsAgainst: 7, points: 0 },
  ],
  F: [
    { team: 'Netherlands', played: 3, won: 3, drawn: 0, lost: 0, goalsFor: 6, goalsAgainst: 1, points: 9 },
    { team: 'Japan', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 3, goalsAgainst: 3, points: 4 },
    { team: 'Sweden', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, points: 4 },
    { team: 'Tunisia', played: 3, won: 0, drawn: 0, lost: 3, goalsFor: 0, goalsAgainst: 4, points: 0 },
  ],
  G: [
    { team: 'Belgium', played: 3, won: 3, drawn: 0, lost: 0, goalsFor: 7, goalsAgainst: 0, points: 9 },
    { team: 'Egypt', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 3, goalsAgainst: 3, points: 4 },
    { team: 'Iran', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, points: 4 },
    { team: 'New Zealand', played: 3, won: 0, drawn: 0, lost: 3, goalsFor: 0, goalsAgainst: 6, points: 0 },
  ],
  H: [
    { team: 'Spain', played: 3, won: 3, drawn: 0, lost: 0, goalsFor: 6, goalsAgainst: 0, points: 9 },
    { team: 'Uruguay', played: 3, won: 2, drawn: 0, lost: 1, goalsFor: 4, goalsAgainst: 1, points: 6 },
    { team: 'Saudi Arabia', played: 3, won: 0, drawn: 1, lost: 2, goalsFor: 0, goalsAgainst: 4, points: 1 },
    { team: 'Cape Verde', played: 3, won: 0, drawn: 1, lost: 2, goalsFor: 0, goalsAgainst: 5, points: 1 },
  ],
  I: [
    { team: 'France', played: 3, won: 2, drawn: 1, lost: 0, goalsFor: 6, goalsAgainst: 2, points: 7 },
    { team: 'Norway', played: 3, won: 1, drawn: 2, lost: 0, goalsFor: 4, goalsAgainst: 2, points: 5 },
    { team: 'Senegal', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 4, goalsAgainst: 3, points: 4 },
    { team: 'Iraq', played: 3, won: 0, drawn: 0, lost: 3, goalsFor: 0, goalsAgainst: 7, points: 0 },
  ],
  J: [
    { team: 'Argentina', played: 3, won: 3, drawn: 0, lost: 0, goalsFor: 6, goalsAgainst: 1, points: 9 },
    { team: 'Austria', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 4, goalsAgainst: 3, points: 4 },
    { team: 'Algeria', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, points: 4 },
    { team: 'Jordan', played: 3, won: 0, drawn: 0, lost: 3, goalsFor: 0, goalsAgainst: 5, points: 0 },
  ],
  K: [
    { team: 'Portugal', played: 3, won: 2, drawn: 1, lost: 0, goalsFor: 5, goalsAgainst: 1, points: 7 },
    { team: 'Colombia', played: 3, won: 2, drawn: 1, lost: 0, goalsFor: 5, goalsAgainst: 2, points: 7 },
    { team: 'DR Congo', played: 3, won: 0, drawn: 1, lost: 2, goalsFor: 1, goalsAgainst: 4, points: 1 },
    { team: 'Uzbekistan', played: 3, won: 0, drawn: 1, lost: 2, goalsFor: 0, goalsAgainst: 4, points: 1 },
  ],
  L: [
    { team: 'England', played: 3, won: 3, drawn: 0, lost: 0, goalsFor: 7, goalsAgainst: 1, points: 9 },
    { team: 'Croatia', played: 3, won: 2, drawn: 0, lost: 1, goalsFor: 4, goalsAgainst: 2, points: 6 },
    { team: 'Ghana', played: 3, won: 1, drawn: 0, lost: 2, goalsFor: 1, goalsAgainst: 3, points: 3 },
    { team: 'Panama', played: 3, won: 0, drawn: 0, lost: 3, goalsFor: 0, goalsAgainst: 6, points: 0 },
  ],
}

export const thirdPlaceTeams: ThirdPlaceStanding[] = [
    { team: 'Senegal', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 4, goalsAgainst: 3, points: 4, group: 'I' },
    { team: 'Ivory Coast', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 3, goalsAgainst: 3, points: 4, group: 'E' },
    { team: 'Bosnia and Herzegovina', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, points: 4, group: 'B' },
    { team: 'Paraguay', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, points: 4, group: 'D' },
    { team: 'Sweden', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, points: 4, group: 'F' },
    { team: 'Iran', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, points: 4, group: 'G' },
    { team: 'Algeria', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, points: 4, group: 'J' },
    { team: 'Czech Republic', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 1, goalsAgainst: 2, points: 4, group: 'A' },
    { team: 'Ghana', played: 3, won: 1, drawn: 0, lost: 2, goalsFor: 1, goalsAgainst: 3, points: 3, group: 'L' },
    { team: 'Scotland', played: 3, won: 1, drawn: 0, lost: 2, goalsFor: 1, goalsAgainst: 4, points: 3, group: 'C' },
    { team: 'DR Congo', played: 3, won: 0, drawn: 1, lost: 2, goalsFor: 1, goalsAgainst: 4, points: 1, group: 'K' },
    { team: 'Saudi Arabia', played: 3, won: 0, drawn: 1, lost: 2, goalsFor: 0, goalsAgainst: 4, points: 1, group: 'H' },
]

export const thirdPlaceQualification: ThirdPlaceQualification = {
  resolved: true,
  all: [
    { team: 'Senegal', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 4, goalsAgainst: 3, points: 4, group: 'I' },
    { team: 'Ivory Coast', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 3, goalsAgainst: 3, points: 4, group: 'E' },
    { team: 'Bosnia and Herzegovina', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, points: 4, group: 'B' },
    { team: 'Paraguay', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, points: 4, group: 'D' },
    { team: 'Sweden', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, points: 4, group: 'F' },
    { team: 'Iran', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, points: 4, group: 'G' },
    { team: 'Algeria', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, points: 4, group: 'J' },
    { team: 'Czech Republic', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 1, goalsAgainst: 2, points: 4, group: 'A' },
    { team: 'Ghana', played: 3, won: 1, drawn: 0, lost: 2, goalsFor: 1, goalsAgainst: 3, points: 3, group: 'L' },
    { team: 'Scotland', played: 3, won: 1, drawn: 0, lost: 2, goalsFor: 1, goalsAgainst: 4, points: 3, group: 'C' },
    { team: 'DR Congo', played: 3, won: 0, drawn: 1, lost: 2, goalsFor: 1, goalsAgainst: 4, points: 1, group: 'K' },
    { team: 'Saudi Arabia', played: 3, won: 0, drawn: 1, lost: 2, goalsFor: 0, goalsAgainst: 4, points: 1, group: 'H' },
  ],
  qualifiers: [
    { team: 'Senegal', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 4, goalsAgainst: 3, points: 4, group: 'I' },
    { team: 'Ivory Coast', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 3, goalsAgainst: 3, points: 4, group: 'E' },
    { team: 'Bosnia and Herzegovina', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, points: 4, group: 'B' },
    { team: 'Paraguay', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, points: 4, group: 'D' },
    { team: 'Sweden', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, points: 4, group: 'F' },
    { team: 'Iran', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, points: 4, group: 'G' },
    { team: 'Algeria', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3, points: 4, group: 'J' },
    { team: 'Czech Republic', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 1, goalsAgainst: 2, points: 4, group: 'A' },
  ],
}

export const knockoutStages: KnockoutStages = {
  r32: [
      { matchNum: 73, home: 'South Korea', away: 'Canada', resolved: true, scores: { home: 0, away: 1 }, matchDate: '28 ביוני', kickoffIST: '22:00' },
      { matchNum: 74, home: 'Germany', away: 'Paraguay', resolved: true, scores: { home: 2, away: 0 }, matchDate: '29 ביוני', kickoffIST: '23:30' },
      { matchNum: 75, home: 'Netherlands', away: 'Morocco', resolved: true, scores: { home: 2, away: 1 }, matchDate: '30 ביוני', kickoffIST: '04:00' },
      { matchNum: 76, home: 'Brazil', away: 'Japan', resolved: true, scores: { home: 2, away: 0 }, matchDate: '29 ביוני', kickoffIST: '20:00' },
      { matchNum: 77, home: 'France', away: 'Sweden', resolved: true, scores: { home: 2, away: 0 }, matchDate: '1 ביולי', kickoffIST: '00:00' },
      { matchNum: 78, home: 'Ecuador', away: 'Norway', resolved: true, scores: { home: 0, away: 1 }, matchDate: '30 ביוני', kickoffIST: '20:00' },
      { matchNum: 79, home: 'Mexico', away: 'Ivory Coast', resolved: true, scores: { home: 2, away: 1 }, matchDate: '1 ביולי', kickoffIST: '04:00' },
      { matchNum: 80, home: 'England', away: 'Algeria', resolved: true, scores: { home: 2, away: 0 }, matchDate: '1 ביולי', kickoffIST: '19:00' },
      { matchNum: 81, home: 'United States', away: 'Bosnia and Herzegovina', resolved: true, scores: { home: 1, away: 0 }, matchDate: '2 ביולי', kickoffIST: '03:00' },
      { matchNum: 82, home: 'Belgium', away: 'Czech Republic', resolved: true, scores: { home: 2, away: 1 }, matchDate: '1 ביולי', kickoffIST: '23:00' },
      { matchNum: 83, home: 'Colombia', away: 'Croatia', resolved: true, scores: { home: 2, away: 1 }, matchDate: '3 ביולי', kickoffIST: '02:00' },
      { matchNum: 84, home: 'Spain', away: 'Austria', resolved: true, scores: { home: 2, away: 0 }, matchDate: '2 ביולי', kickoffIST: '22:00' },
      { matchNum: 85, home: 'Switzerland', away: 'Iran', resolved: true, scores: { home: 1, away: 0 }, matchDate: '3 ביולי', kickoffIST: '06:00' },
      { matchNum: 86, home: 'Argentina', away: 'Uruguay', resolved: true, scores: { home: 2, away: 0 }, matchDate: '4 ביולי', kickoffIST: '01:00' },
      { matchNum: 87, home: 'Portugal', away: 'Senegal', resolved: true, scores: { home: 2, away: 1 }, matchDate: '4 ביולי', kickoffIST: '04:30' },
      { matchNum: 88, home: 'Turkey', away: 'Egypt', resolved: true, scores: { home: 2, away: 1 }, matchDate: '3 ביולי', kickoffIST: '21:00' },
  ],
  r16: [
      { matchNum: 89, home: 'Germany', away: 'France', resolved: true, scores: { home: 1, away: 2 }, matchDate: '5 ביולי', kickoffIST: '00:00' },
      { matchNum: 90, home: 'Canada', away: 'Netherlands', resolved: true, scores: { home: 0, away: 2 }, matchDate: '4 ביולי', kickoffIST: '20:00' },
      { matchNum: 91, home: 'Brazil', away: 'Norway', resolved: true, scores: { home: 2, away: 1 }, matchDate: '5 ביולי', kickoffIST: '23:00' },
      { matchNum: 92, home: 'Mexico', away: 'England', resolved: true, scores: { home: 1, away: 2 }, matchDate: '6 ביולי', kickoffIST: '03:00' },
      { matchNum: 93, home: 'Colombia', away: 'Spain', resolved: true, scores: { home: 0, away: 2 }, matchDate: '6 ביולי', kickoffIST: '22:00' },
      { matchNum: 94, home: 'United States', away: 'Belgium', resolved: true, scores: { home: 1, away: 2 }, matchDate: '7 ביולי', kickoffIST: '03:00' },
      { matchNum: 95, home: 'Argentina', away: 'Turkey', resolved: true, scores: { home: 2, away: 0 }, matchDate: '7 ביולי', kickoffIST: '19:00' },
      { matchNum: 96, home: 'Switzerland', away: 'Portugal', resolved: true, scores: { home: 1, away: 2 }, matchDate: '7 ביולי', kickoffIST: '23:00' },
  ],
  qf: [
      { matchNum: 97, home: 'France', away: 'Netherlands', resolved: true, scores: { home: 2, away: 1 }, matchDate: '9 ביולי', kickoffIST: '23:00' },
      { matchNum: 98, home: 'Spain', away: 'Belgium', resolved: true, scores: { home: 2, away: 0 }, matchDate: '10 ביולי', kickoffIST: '22:00' },
      { matchNum: 99, home: 'Brazil', away: 'England', resolved: true, scores: { home: 1, away: 2 }, matchDate: '12 ביולי', kickoffIST: '00:00' },
      { matchNum: 100, home: 'Argentina', away: 'Portugal', resolved: true, scores: { home: 2, away: 1 }, matchDate: '12 ביולי', kickoffIST: '04:00' },
  ],
  sf: [
      { matchNum: 101, home: 'France', away: 'Spain', resolved: true, scores: { home: 2, away: 1 }, matchDate: '14 ביולי', kickoffIST: '22:00' },
      { matchNum: 102, home: 'England', away: 'Argentina', resolved: true, scores: { home: 2, away: 1 }, matchDate: '15 ביולי', kickoffIST: '22:00' },
  ],
  thirdPlace: [
      { matchNum: 103, home: 'Spain', away: 'Argentina', resolved: true, scores: { home: 2, away: 1 }, matchDate: '19 ביולי', kickoffIST: '00:00' },
  ],
  final: [
      { matchNum: 104, home: 'France', away: 'England', resolved: true, scores: { home: 2, away: 1 }, matchDate: '19 ביולי', kickoffIST: '22:00' },
  ],
}

export const predictedChampion = 'France'
export const predictedThirdPlaceWinner = 'Spain'
export const predictedR16Teams = ['Germany', 'France', 'Canada', 'Netherlands', 'Brazil', 'Norway', 'Mexico', 'England', 'Colombia', 'Spain', 'United States', 'Belgium', 'Argentina', 'Turkey', 'Switzerland', 'Portugal']
export const predictedQFTeams = ['France', 'Netherlands', 'Spain', 'Belgium', 'Brazil', 'England', 'Argentina', 'Portugal']
export const predictedSFTeams = ['France', 'Spain', 'England', 'Argentina']
export const predictedFinalTeams = ['France', 'England']
