// @vitest-environment node
import { expect, test } from 'vitest'
import type { GroupMatch, Standing, ThirdPlaceStanding, TournamentResults } from '../shared/types'
import { buildGroupScopeRows, buildGroupSummaryRows, countR32Participation, buildRangeRows, rangePlaceMovement, rankTrajectories, GROUP_SORTERS } from './leaderboardRows'
import type { KnockoutMatch } from '../shared/types'
import { GOLDEN_BOOT_BONUS, OLEH_POINTS, PLACE_POINT, POINTS_PER_GOAL } from './points'
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
  // tournamentTotal spans every group: Dana's exact b1 in group B lifts hers above her group-A total
  expect(rows).toEqual([
    { label: 'Yossi', tzelifaCount: 2, pgiyaCount: 0, matchPoints: 8, advancementPoints: 0, placePoints: 0, goalsPoints: 0, total: 8, tournamentTotal: 8 },
    { label: 'Dana', tzelifaCount: 1, pgiyaCount: 2, matchPoints: 8, advancementPoints: 0, placePoints: 0, goalsPoints: 0, total: 8, tournamentTotal: 12 },
  ])
})

test('buildGroupSummaryRows aggregates hits and points across every group', () => {
  const results: TournamentResults = {
    ...EMPTY_RESULTS,
    groupMatches: {
      A: [grpMatch('m1', 2, 1), grpMatch('m2', 1, 1)],
      B: [grpMatch('b1', 1, 0)],
    },
  }
  // Dana: A → m1 exact (tzelifa, 4), m2 draw (pgiya, 2); B → b1 exact (tzelifa, 4)
  const dana = makeUser({
    label: 'Dana',
    groupMatches: {
      A: [grpMatch('m1', 2, 1), grpMatch('m2', 0, 0)],
      B: [grpMatch('b1', 1, 0)],
    },
  })

  const [row] = buildGroupSummaryRows([dana], results)
  expect(row).toMatchObject({
    label: 'Dana',
    tzelifaCount: 2,
    pgiyaCount: 1,
    matchPoints: 10,
    total: 10,
  })
})

const koM = (matchNum: number, home: string, away: string, resolved = true): KnockoutMatch =>
  ({ matchNum, home, away, resolved })

test('countR32Participation counts R32 matches where the bettor predicted both teams', () => {
  const actual = [koM(73, 'Brazil', 'England'), koM(74, 'France', 'Spain'), koM(75, 'Italy', 'Croatia')]
  const user = [
    koM(73, 'England', 'Brazil'),   // same pair, reversed → counts
    koM(74, 'France', 'Germany'),   // wrong opponent → no
    koM(75, 'Italy', 'Croatia', false), // unresolved → no
  ]
  expect(countR32Participation(user, actual)).toBe(1)
})

const mkRow = (label: string, over: Partial<GroupScopeRow>): GroupScopeRow =>
  ({ label, tzelifaCount: 0, pgiyaCount: 0, matchPoints: 0, advancementPoints: 0, placePoints: 0, goalsPoints: 0, total: 0, tournamentTotal: 0, ...over })

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

const koResult = (matchNum: number, home: string, away: string, matchDate: string, kickoffIST: string, scores: { home: number; away: number; drawWinner?: 'home' | 'away' }): KnockoutMatch =>
  ({ matchNum, home, away, resolved: true, matchDate, kickoffIST, scores })
const koPick = (matchNum: number, home: string, away: string, scores: { home: number; away: number; drawWinner?: 'home' | 'away' }): KnockoutMatch =>
  ({ matchNum, home, away, resolved: true, scores })

test('buildRangeRows scores knockout match points within the range', () => {
  const results: TournamentResults = {
    ...EMPTY_RESULTS,
    groupMatches: { A: [datedMatch('a1', '11 ביוני', '22:00', { home: 1, away: 0 })] },
    knockoutStages: {
      ...EMPTY_RESULTS.knockoutStages,
      r32: [koResult(73, 'Brazil', 'France', '28 ביוני', '22:00', { home: 2, away: 1 })],
    },
  }
  // Dana: tzelifa on the group match (a1) and an exact call on KO #73 (R32 tzelifa = 7)
  const dana = makeUser({
    label: 'Dana',
    groupMatches: { A: [grpMatch('a1', 1, 0)] },
    knockoutStages: { ...EMPTY_RESULTS.knockoutStages, r32: [koPick(73, 'Brazil', 'France', { home: 2, away: 1 })] },
  })
  // Yossi: predicted France to win #73 — wrong outcome, no points
  const yossi = makeUser({
    label: 'Yossi',
    groupMatches: { A: [grpMatch('a1', 0, 1)] },
    knockoutStages: { ...EMPTY_RESULTS.knockoutStages, r32: [koPick(73, 'Brazil', 'France', { home: 0, away: 1 })] },
  })

  // Range over match #2 only (KO #73): Dana banks the R32 tzelifa, Yossi nothing
  const koOnly = buildRangeRows([dana, yossi], results, 2, 2)
  expect(koOnly.map(r => ({ label: r.label, tzelifaCount: r.tzelifaCount, matchPoints: r.matchPoints }))).toEqual([
    { label: 'Dana', tzelifaCount: 1, matchPoints: 7 },
    { label: 'Yossi', tzelifaCount: 0, matchPoints: 0 },
  ])

  // Full stretch a1..#73: Dana's group tzelifa (4) + KO tzelifa (7) = 11
  const [danaFull] = buildRangeRows([dana], results, 1, 2)
  expect(danaFull.tzelifaCount).toBe(2)
  expect(danaFull.matchPoints).toBe(11)
})

test('buildRangeRows credits each KO match its own advancer and the title bonus to its match', () => {
  const results: TournamentResults = {
    ...EMPTY_RESULTS,
    knockoutStages: {
      ...EMPTY_RESULTS.knockoutStages,
      r32: [
        koResult(73, 'Brazil', 'France', '28 ביוני', '22:00', { home: 2, away: 1 }),
        koResult(88, 'Italy', 'Spain', '29 ביוני', '22:00', { home: 1, away: 0 }), // chronologically completes R32
      ],
      r16: [koResult(89, 'Brazil', 'Italy', '5 ביולי', '22:00', { home: 1, away: 0 })],
      final: [koResult(104, 'Brazil', 'Italy', '19 ביולי', '22:00', { home: 2, away: 0 })],
    },
    champion: 'Brazil',
  }
  // Dana tips Brazil + Italy to reach R16 (2 × OLEH r32 = 14) and Brazil as champion (25)
  const dana = makeUser({
    label: 'Dana',
    predictedChampion: 'Brazil',
    knockoutStages: {
      ...EMPTY_RESULTS.knockoutStages,
      r32: [koPick(73, 'Brazil', 'France', { home: 2, away: 1 }), koPick(88, 'Italy', 'Spain', { home: 1, away: 0 })],
      r16: [koPick(89, 'Brazil', 'Italy', { home: 1, away: 0 })],
    },
  })

  // Each R32 fixture owns the advancement of the team it sent through, credited the
  // moment it's played — so match #73 keeps Brazil's advancement even after #88 is
  // entered (the bug: it used to jump onto the round's last-played match).
  const [m73] = buildRangeRows([dana], results, 1, 1)
  expect(m73.advancementPoints).toBe(OLEH_POINTS.r32) // Brazil only
  const [m88] = buildRangeRows([dana], results, 2, 2)
  expect(m88.advancementPoints).toBe(OLEH_POINTS.r32) // Italy only
  // The whole R32 stretch still sums to both advancers
  const [bothR32] = buildRangeRows([dana], results, 1, 2)
  expect(bothR32.advancementPoints).toBe(2 * OLEH_POINTS.r32)
  // Range over the final only (#104): the champion bonus lands here, R32 advancement does not
  const [atFinal] = buildRangeRows([dana], results, 4, 4)
  expect(atFinal.advancementPoints).toBe(OLEH_POINTS.champion)
})

// Regression: entering a later R32 match must not blank out an earlier one's range
// view. The bug attributed the whole round's advancement to its last-played match,
// so once #74 was entered #73's slice dropped to zero (the reported symptom).
test('an earlier R32 match keeps its result after a later R32 match is entered', () => {
  const dana = makeUser({
    label: 'Dana',
    knockoutStages: {
      ...EMPTY_RESULTS.knockoutStages,
      r32: [koPick(73, 'SouthAfrica', 'Canada', { home: 0, away: 1 }), koPick(74, 'Germany', 'Scotland', { home: 2, away: 0 })],
      r16: [koPick(89, 'Canada', 'Germany', { home: 1, away: 0 })], // tips Canada + Germany through
    },
  })
  const baseKO = (extra: KnockoutMatch[]): TournamentResults => ({
    ...EMPTY_RESULTS,
    knockoutStages: {
      ...EMPTY_RESULTS.knockoutStages,
      r32: extra,
      r16: [koResult(89, 'Canada', 'Germany', '5 ביולי', '22:00', { home: 1, away: 0 })],
    },
  })

  // With only #73 played, its slice credits Canada's advancement.
  const only73 = baseKO([koResult(73, 'SouthAfrica', 'Canada', '28 ביוני', '22:00', { home: 0, away: 1 })])
  expect(buildRangeRows([dana], only73, 1, 1)[0].advancementPoints).toBe(OLEH_POINTS.r32)

  // After #74 is also entered, #73's slice STILL credits Canada (it no longer jumps to #74).
  const both = baseKO([
    koResult(73, 'SouthAfrica', 'Canada', '28 ביוני', '22:00', { home: 0, away: 1 }),
    koResult(74, 'Germany', 'Scotland', '29 ביוני', '22:00', { home: 2, away: 0 }),
  ])
  expect(buildRangeRows([dana], both, 1, 1)[0].advancementPoints).toBe(OLEH_POINTS.r32) // #73 → Canada
  expect(buildRangeRows([dana], both, 2, 2)[0].advancementPoints).toBe(OLEH_POINTS.r32) // #74 → Germany
})

test('buildRangeRows credits the golden boot winner bonus to the final\'s slice', () => {
  const results: TournamentResults = {
    ...EMPTY_RESULTS,
    knockoutStages: {
      ...EMPTY_RESULTS.knockoutStages,
      sf: [koResult(101, 'Brazil', 'Italy', '14 ביולי', '22:00', { home: 1, away: 0 })],
      final: [koResult(104, 'Brazil', 'France', '19 ביולי', '22:00', { home: 2, away: 0 })],
    },
    goldenBootWinner: 'Neymar',
  }
  const dana = makeUser({ label: 'Dana', topGoalscorer: 'Neymar' })
  const yossi = makeUser({ label: 'Yossi', topGoalscorer: 'Mbappe' })

  // Range over the semi only: no boot bonus yet
  const semiOnly = buildRangeRows([dana, yossi], results, 1, 1)
  expect(semiOnly.map(r => r.goalsPoints)).toEqual([0, 0])

  // Range containing the final: Dana banks the 10-point boot bonus, Yossi doesn't
  const atFinal = buildRangeRows([dana, yossi], results, 2, 2)
  expect(atFinal.find(r => r.label === 'Dana')!.goalsPoints).toBe(GOLDEN_BOOT_BONUS)
  expect(atFinal.find(r => r.label === 'Dana')!.total).toBe(GOLDEN_BOOT_BONUS)
  expect(atFinal.find(r => r.label === 'Yossi')!.goalsPoints).toBe(0)
})

test('buildRangeRows counts a picked scorer goals in a knockout match', () => {
  const results: TournamentResults = {
    ...EMPTY_RESULTS,
    knockoutStages: {
      ...EMPTY_RESULTS.knockoutStages,
      r32: [koResult(73, 'Brazil', 'France', '28 ביוני', '22:00', { home: 2, away: 1 })],
    },
    playerMatchGoals: { Neymar: { '73': 2 } }, // 2 goals in the KO match
  }
  const dana = makeUser({
    label: 'Dana',
    topGoalscorer: 'Neymar',
    knockoutStages: { ...EMPTY_RESULTS.knockoutStages, r32: [koPick(73, 'Brazil', 'France', { home: 2, away: 1 })] },
  })

  const [row] = buildRangeRows([dana], results, 1, 1)
  expect(row.goalsPoints).toBe(2 * POINTS_PER_GOAL)
})

test('buildRangeRows scores only the chosen stretch of games', () => {
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
  // Dana: tzelifa on a1, pgiya on a2 (predicted draw), miss on a3
  const dana = makeUser({
    label: 'Dana',
    groupMatches: { A: [grpMatch('a1', 2, 1), grpMatch('a2', 0, 0), grpMatch('a3', 0, 1)] },
  })
  // Yossi: miss on a1, pgiya on a2 (predicted draw), miss on a3
  const yossi = makeUser({
    label: 'Yossi',
    groupMatches: { A: [grpMatch('a1', 0, 1), grpMatch('a2', 2, 2), grpMatch('a3', 0, 0)] },
  })

  // stretch a2..a3 excludes Dana's a1 tzelifa; tournamentTotal stays the full-tournament total (a1 included)
  expect(buildRangeRows([dana, yossi], results, 2, 3)).toEqual([
    { label: 'Dana', tzelifaCount: 0, pgiyaCount: 1, matchPoints: 2, advancementPoints: 0, placePoints: 0, goalsPoints: 0, total: 2, tournamentTotal: 6 },
    { label: 'Yossi', tzelifaCount: 0, pgiyaCount: 1, matchPoints: 2, advancementPoints: 0, placePoints: 0, goalsPoints: 0, total: 2, tournamentTotal: 2 },
  ])

  // full stretch a1..a3 includes everything — here the range total matches the tournament total
  expect(buildRangeRows([dana, yossi], results, 1, 3)).toEqual([
    { label: 'Dana', tzelifaCount: 1, pgiyaCount: 1, matchPoints: 6, advancementPoints: 0, placePoints: 0, goalsPoints: 0, total: 6, tournamentTotal: 6 },
    { label: 'Yossi', tzelifaCount: 0, pgiyaCount: 1, matchPoints: 2, advancementPoints: 0, placePoints: 0, goalsPoints: 0, total: 2, tournamentTotal: 2 },
  ])
})

test('buildRangeRows credits a group\'s advancement and place points to the range with its completing match', () => {
  const results: TournamentResults = {
    ...EMPTY_RESULTS,
    groupMatches: {
      A: [
        datedMatch('a1', '11 ביוני', '22:00', { home: 1, away: 0 }),
        datedMatch('a2', '12 ביוני', '19:00', { home: 2, away: 0 }),
        datedMatch('a3', '13 ביוני', '19:00', { home: 3, away: 0 }), // chronologically completes group A
      ],
    },
    groupTables: {
      A: [grpRow('Brazil', 0), grpRow('France', 1), grpRow('Germany', 2), grpRow('Spain', 3)],
    },
  }
  // Dana predicts the final table exactly: 2 correct advancers + 4 correct positions
  const dana = makeUser({
    label: 'Dana',
    groupMatches: { A: [grpMatch('a1', 1, 0), grpMatch('a2', 2, 0), grpMatch('a3', 3, 0)] },
    groupTables: { A: [grpRow('Brazil', 0), grpRow('France', 1), grpRow('Germany', 2), grpRow('Spain', 3)] },
  })

  // A range that ends before the group is decided carries no advancement/place yet
  const [beforeComplete] = buildRangeRows([dana], results, 1, 2)
  expect(beforeComplete.advancementPoints).toBe(0)
  expect(beforeComplete.placePoints).toBe(0)

  // The range holding the completing match (a3) is where they land
  const [atComplete] = buildRangeRows([dana], results, 3, 3)
  expect(atComplete.advancementPoints).toBe(2 * OLEH_POINTS.group)
  expect(atComplete.placePoints).toBe(4 * PLACE_POINT)
  expect(atComplete.total).toBe(atComplete.matchPoints + atComplete.advancementPoints + atComplete.placePoints + atComplete.goalsPoints)
})

test('rangePlaceMovement reports how many places each bettor moved over the stretch', () => {
  const results: TournamentResults = {
    ...EMPTY_RESULTS,
    groupMatches: {
      A: [
        datedMatch('a1', '11 ביוני', '22:00', { home: 1, away: 0 }),
        datedMatch('a2', '12 ביוני', '19:00', { home: 2, away: 0 }),
        datedMatch('a3', '13 ביוני', '19:00', { home: 0, away: 1 }),
      ],
    },
  }
  // Dana leads after a1 (exact), then stalls
  const dana = makeUser({
    label: 'Dana',
    groupMatches: { A: [grpMatch('a1', 1, 0), grpMatch('a2', 0, 0), grpMatch('a3', 0, 0)] },
  })
  // Yossi misses a1, then nails a2 + a3 to overtake
  const yossi = makeUser({
    label: 'Yossi',
    groupMatches: { A: [grpMatch('a1', 0, 1), grpMatch('a2', 2, 0), grpMatch('a3', 0, 1)] },
  })

  // Across a2..a3: before (as of a1) Dana 1st / Yossi 2nd; after (a1..a3) Yossi 1st / Dana 2nd
  expect(rangePlaceMovement([dana, yossi], results, 2, 3)).toEqual({ Dana: -1, Yossi: 1 })

  // A stretch starting at game 1 has no "before" snapshot to compare against
  expect(rangePlaceMovement([dana, yossi], results, 1, 3)).toEqual({ Dana: null, Yossi: null })
})

test('rankTrajectories tracks each bettor cumulative rank after every played match', () => {
  const results: TournamentResults = {
    ...EMPTY_RESULTS,
    groupMatches: {
      A: [
        datedMatch('a1', '11 ביוני', '22:00', { home: 1, away: 0 }),
        datedMatch('a2', '12 ביוני', '19:00', { home: 2, away: 0 }),
      ],
    },
  }
  // Dana nails a1 (tzelifa, 4) then misses a2 → cumulative 4, 4
  const dana = makeUser({
    label: 'Dana',
    groupMatches: { A: [grpMatch('a1', 1, 0), grpMatch('a2', 0, 1)] },
  })
  // Yossi gets a pgiya on a1 (2) then nails a2 (tzelifa, 4) → cumulative 2, 6 — overtakes
  const yossi = makeUser({
    label: 'Yossi',
    groupMatches: { A: [grpMatch('a1', 2, 0), grpMatch('a2', 2, 0)] },
  })

  // After a1: Dana 1st, Yossi 2nd. After a2: Yossi 1st, Dana 2nd.
  expect(rankTrajectories([dana, yossi], results)).toEqual({
    Dana: [1, 2],
    Yossi: [2, 1],
  })
})

test('rankTrajectories spans into the knockout stage, not just the group matches', () => {
  const results: TournamentResults = {
    ...EMPTY_RESULTS,
    groupMatches: {
      A: [datedMatch('a1', '11 ביוני', '22:00', { home: 1, away: 0 })],
    },
    knockoutStages: {
      ...EMPTY_RESULTS.knockoutStages,
      r32: [koResult(73, 'Brazil', 'France', '28 ביוני', '22:00', { home: 2, away: 1 })],
    },
  }
  // Dana nails the group match (tzelifa, 4) then misses the KO → cumulative 4, 4
  const dana = makeUser({
    label: 'Dana',
    groupMatches: { A: [grpMatch('a1', 1, 0)] },
    knockoutStages: { ...EMPTY_RESULTS.knockoutStages, r32: [koPick(73, 'Brazil', 'France', { home: 0, away: 2 })] },
  })
  // Yossi misses the group match (0) then nails the KO (tzelifa r32, 7) → cumulative 0, 7 — overtakes
  const yossi = makeUser({
    label: 'Yossi',
    groupMatches: { A: [grpMatch('a1', 0, 1)] },
    knockoutStages: { ...EMPTY_RESULTS.knockoutStages, r32: [koPick(73, 'Brazil', 'France', { home: 2, away: 1 })] },
  })

  // After a1: Dana 1st, Yossi 2nd. After the KO match: Yossi 1st, Dana 2nd.
  expect(rankTrajectories([dana, yossi], results)).toEqual({
    Dana: [1, 2],
    Yossi: [2, 1],
  })
})

test('points sorters break ties by combined hits', () => {
  const rows = [
    mkRow('Gadi', { matchPoints: 4, total: 4, pgiyaCount: 2 }),
    mkRow('Rina', { matchPoints: 4, total: 4, tzelifaCount: 1, pgiyaCount: 2 }),
  ].sort(GROUP_SORTERS.total)
  expect(rows.map(r => r.label)).toEqual(['Rina', 'Gadi'])
})

test('tournamentTotal sorter ranks by full-tournament points, not range gain', () => {
  // Avi gained more in the range, but Boaz stands higher overall
  const rows = [
    mkRow('Avi', { total: 10, tournamentTotal: 20 }),
    mkRow('Boaz', { total: 4, tournamentTotal: 50 }),
  ].sort(GROUP_SORTERS.tournamentTotal)
  expect(rows.map(r => r.label)).toEqual(['Boaz', 'Avi'])
})
