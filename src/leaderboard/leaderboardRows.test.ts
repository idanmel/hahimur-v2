// @vitest-environment node
import { expect, test } from 'vitest'
import type { GroupMatch, Standing, ThirdPlaceStanding, TournamentResults } from '../shared/types'
import { buildGroupScopeRows, GROUP_SORTERS } from './leaderboardRows'
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
  // Brazil (top-2) + France (third-place qualifier) both advanced from group A → 10 pts
  expect(row.advancementPoints).toBe(10)
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
  expect(rowA.advancementPoints).toBe(10) // Brazil + France only

  const [rowB] = buildGroupScopeRows([user], results, 'B')
  expect(rowB.advancementPoints).toBe(5) // Italy only
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
    { label: 'Yossi', tzelifaCount: 2, pgiyaCount: 0, matchPoints: 8, advancementPoints: 0, total: 8 },
    { label: 'Dana', tzelifaCount: 1, pgiyaCount: 2, matchPoints: 8, advancementPoints: 0, total: 8 },
  ])
})

const mkRow = (label: string, over: Partial<GroupScopeRow>): GroupScopeRow =>
  ({ label, tzelifaCount: 0, pgiyaCount: 0, matchPoints: 0, advancementPoints: 0, total: 0, ...over })

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

test('points sorters break ties by combined hits', () => {
  const rows = [
    mkRow('Gadi', { matchPoints: 4, total: 4, pgiyaCount: 2 }),
    mkRow('Rina', { matchPoints: 4, total: 4, tzelifaCount: 1, pgiyaCount: 2 }),
  ].sort(GROUP_SORTERS.total)
  expect(rows.map(r => r.label)).toEqual(['Rina', 'Gadi'])
})
