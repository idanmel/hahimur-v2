// @vitest-environment node
import { expect, test } from 'vitest'
import type { GroupMatch, Standing, ThirdPlaceStanding, TournamentResults } from '../shared/types'
import { buildGroupScopeRows, buildLastXRows, lastPlayedGroupMatches, GROUP_SORTERS } from './leaderboardRows'
import { OLEH_POINTS } from './points'
import type { GroupScopeRow } from './leaderboardRows'
import { EMPTY_RESULTS, makeUser } from './testFixtures'

const grpRow = (team: string, pos: number): Standing =>
  ({ team, played: 3, won: 3 - pos, drawn: 0, lost: pos, goalsFor: 6 - pos * 2, goalsAgainst: pos * 2, points: 9 - pos * 3 })

const thirdRow = (team: string, group: string): ThirdPlaceStanding =>
  ({ ...grpRow(team, 2), group })

test('group scope counts all teams that advanced from that group, including via third place', () => {
  // User predicted Brazil + France top-2 in group A; actual top-2 are Brazil + Germany,
  // and France advanced from group A as a best third-placed team.
  const user = makeUser({
    groupTables: {
      A: [grpRow('Brazil', 0), grpRow('France', 1), grpRow('Germany', 2), grpRow('Spain', 3)],
    },
  })
  const results: TournamentResults = {
    ...EMPTY_RESULTS,
    groupTables: {
      A: [grpRow('Brazil', 0), grpRow('Germany', 1), grpRow('France', 2), grpRow('Spain', 3)],
    },
    thirdPlaceQualification: {
      resolved: true,
      all: [thirdRow('France', 'A')],
      qualifiers: [thirdRow('France', 'A')],
    },
  }

  const [row] = buildGroupScopeRows([user], results, 'A')
  // Brazil (top-2) + France (third-place qualifier) both advanced from group A
  expect(row.advancementPoints).toBe(2 * OLEH_POINTS.group)
})

test('group scope excludes third-place qualifiers from other groups', () => {
  // User correctly predicted Italy as a third-place qualifier — but Italy is in group B,
  // so its points must not appear when scoped to group A.
  const user = makeUser({
    groupTables: {
      A: [grpRow('Brazil', 0), grpRow('France', 1), grpRow('Germany', 2), grpRow('Spain', 3)],
    },
    thirdPlaceQualification: {
      resolved: true,
      all: [thirdRow('Italy', 'B')],
      qualifiers: [thirdRow('Italy', 'B')],
    },
  })
  const results: TournamentResults = {
    ...EMPTY_RESULTS,
    groupTables: {
      A: [grpRow('Brazil', 0), grpRow('France', 1), grpRow('Germany', 2), grpRow('Spain', 3)],
    },
    thirdPlaceQualification: {
      resolved: true,
      all: [thirdRow('Italy', 'B')],
      qualifiers: [thirdRow('Italy', 'B')],
    },
  }

  const [rowA] = buildGroupScopeRows([user], results, 'A')
  expect(rowA.advancementPoints).toBe(2 * OLEH_POINTS.group) // Brazil + France only

  const [rowB] = buildGroupScopeRows([user], results, 'B')
  expect(rowB.advancementPoints).toBe(OLEH_POINTS.group) // Italy only
})

const grpMatch = (id: string, home: number, away: number): GroupMatch =>
  ({ id, homeTeam: 'H', awayTeam: 'A', scores: { home, away } })

test('buildGroupScopeRows merges hit counts with match points for the scoped group only', () => {
  // Three matches in group A: 2-1, 1-1, 3-0; one match in group B that must be ignored.
  const results: TournamentResults = {
    ...EMPTY_RESULTS,
    groupMatches: {
      A: [grpMatch('m1', 2, 1), grpMatch('m2', 1, 1), grpMatch('m3', 3, 0)],
      B: [grpMatch('b1', 1, 0)],
    },
  }
  // Dana: 1 tzelifa (m1 exact, 4 pts) + 2 pgiyot (m2 draw, m3 home win, 2 pts each).
  // Her exact hit in group B must not leak into group A's row.
  const dana = makeUser({
    label: 'Dana',
    groupMatches: {
      A: [grpMatch('m1', 2, 1), grpMatch('m2', 0, 0), grpMatch('m3', 1, 0)],
      B: [grpMatch('b1', 1, 0)],
    },
  })
  // Yossi: 2 tzelifot (m1, m2 exact, 4 pts each) + 0 pgiyot (m3 away win)
  const yossi = makeUser({
    label: 'Yossi',
    groupMatches: { A: [grpMatch('m1', 2, 1), grpMatch('m2', 1, 1), grpMatch('m3', 0, 1)] },
  })

  const rows = buildGroupScopeRows([yossi, dana], results, 'A')
  expect(rows).toEqual([
    { label: 'Yossi', tzelifaCount: 2, pgiyaCount: 0, matchPoints: 8, advancementPoints: 0, placePoints: 0, goalsPoints: 0, total: 8 },
    { label: 'Dana', tzelifaCount: 1, pgiyaCount: 2, matchPoints: 8, advancementPoints: 0, placePoints: 0, goalsPoints: 0, total: 8 },
  ])
})

const mkRow = (label: string, over: Partial<GroupScopeRow>): GroupScopeRow =>
  ({ label, tzelifaCount: 0, pgiyaCount: 0, matchPoints: 0, advancementPoints: 0, placePoints: 0, goalsPoints: 0, total: 0, ...over })

test('combined sorter ranks by tzelifot + pgiyot sum, not by either alone', () => {
  const rows = [
    mkRow('Yossi', { tzelifaCount: 2 }),
    mkRow('Dana', { tzelifaCount: 1, pgiyaCount: 2 }),
  ].sort(GROUP_SORTERS.combined)
  expect(rows.map(r => r.label)).toEqual(['Dana', 'Yossi'])
})

test('combined sorter breaks total ties by tzelifot', () => {
  const rows = [
    mkRow('Gadi', { tzelifaCount: 1, pgiyaCount: 1 }),
    mkRow('Rina', { tzelifaCount: 2 }),
  ].sort(GROUP_SORTERS.combined)
  expect(rows.map(r => r.label)).toEqual(['Rina', 'Gadi'])
})

const datedMatch = (id: string, matchDate: string, kickoffIST: string, scores?: { home: number; away: number }): GroupMatch =>
  ({ id, homeTeam: 'H', awayTeam: 'A', matchDate, kickoffIST, scores: scores ?? { home: null, away: null } })

test('lastPlayedGroupMatches returns the most recent played matches in chronological order', () => {
  const results: TournamentResults = {
    ...EMPTY_RESULTS,
    groupMatches: {
      A: [
        datedMatch('a1', '11 ביוני', '22:00', { home: 1, away: 0 }),
        datedMatch('a2', '18 ביוני', '19:00'), // unplayed — must be skipped
      ],
      B: [
        datedMatch('b1', '12 ביוני', '22:00', { home: 2, away: 2 }),
        datedMatch('b2', '12 ביוני', '05:00', { home: 0, away: 3 }),
      ],
    },
  }
  expect(lastPlayedGroupMatches(results, 2).map(m => m.id)).toEqual(['b2', 'b1'])
  expect(lastPlayedGroupMatches(results, 10).map(m => m.id)).toEqual(['a1', 'b2', 'b1'])
})

test('buildLastXRows scores only matches inside the window', () => {
  const results: TournamentResults = {
    ...EMPTY_RESULTS,
    groupMatches: {
      A: [
        datedMatch('a1', '11 ביוני', '22:00', { home: 2, away: 1 }),
        datedMatch('a2', '12 ביוני', '19:00', { home: 1, away: 1 }),
        datedMatch('a3', '13 ביוני', '19:00', { home: 3, away: 0 }),
      ],
    },
  }
  // Dana: tzelifa on a1 (oldest, outside window of 2), pgiya on a2, miss on a3
  const dana = makeUser({
    label: 'Dana',
    groupMatches: {
      A: [grpMatch('a1', 2, 1), grpMatch('a2', 0, 0), grpMatch('a3', 0, 1)],
    },
  })
  // Yossi: tzelifa on a3 (4 pts), pgiya on a2 (2 pts)
  const yossi = makeUser({
    label: 'Yossi',
    groupMatches: {
      A: [grpMatch('a1', 0, 1), grpMatch('a2', 2, 2), grpMatch('a3', 3, 0)],
    },
  })

  const rows = buildLastXRows([dana, yossi], results, 2)
  expect(rows).toEqual([
    { label: 'Dana', tzelifaCount: 0, pgiyaCount: 1, matchPoints: 2, advancementPoints: 0, placePoints: 0, goalsPoints: 0, total: 2 },
    { label: 'Yossi', tzelifaCount: 1, pgiyaCount: 1, matchPoints: 6, advancementPoints: 0, placePoints: 0, goalsPoints: 0, total: 6 },
  ])
})

test('buildLastXRows adds 3 points per goal the pick scored inside the window only', () => {
  const results: TournamentResults = {
    ...EMPTY_RESULTS,
    groupMatches: {
      A: [
        datedMatch('a1', '11 ביוני', '22:00', { home: 2, away: 1 }),
        datedMatch('a2', '12 ביוני', '19:00', { home: 2, away: 0 }),
        datedMatch('a3', '13 ביוני', '19:00', { home: 0, away: 0 }),
      ],
    },
    // מבאפה: 1 goal in a1 (outside the window of 2), 2 goals in a2 (inside)
    playerMatchGoals: { 'קיליאן אמבפה': { a1: 1, a2: 2 } },
  }
  const dana = makeUser({ label: 'Dana', topGoalscorer: 'קיליאן אמבפה' })
  const yossi = makeUser({ label: 'Yossi', topGoalscorer: 'הארי קיין' })

  const rows = buildLastXRows([dana, yossi], results, 2)
  expect(rows).toEqual([
    { label: 'Dana', tzelifaCount: 0, pgiyaCount: 0, matchPoints: 0, advancementPoints: 0, placePoints: 0, goalsPoints: 6, total: 6 },
    { label: 'Yossi', tzelifaCount: 0, pgiyaCount: 0, matchPoints: 0, advancementPoints: 0, placePoints: 0, goalsPoints: 0, total: 0 },
  ])
})

test('points sorters break ties by combined hits', () => {
  const rows = [
    mkRow('Gadi', { matchPoints: 4, total: 4, pgiyaCount: 2 }),
    mkRow('Rina', { matchPoints: 4, total: 4, tzelifaCount: 1, pgiyaCount: 2 }),
  ].sort(GROUP_SORTERS.total)
  expect(rows.map(r => r.label)).toEqual(['Rina', 'Gadi'])
})
