import { biggestClimb, buildRecords } from './recordsStats'
import type { GroupMatch, Standing, TournamentResults } from '../shared/types'
import type { User } from '../users'

const emptyKO = { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] }

const gm = (id: string, home: number | null, away: number | null): GroupMatch => ({
  id, homeTeam: '?', awayTeam: '?', scores: { home, away },
})

const st = (team: string, played = 1): Standing => ({
  team, played, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
})

function mkUser(label: string, opts: Partial<User> & { topGoalscorer?: string } = {}): User {
  return {
    label,
    topGoalscorer: opts.topGoalscorer ?? 'X',
    groupMatches: opts.groupMatches ?? {},
    groupTables: opts.groupTables ?? {},
    thirdPlaceQualification: { resolved: false, all: [], tied: [] },
    knockoutStages: { ...emptyKO },
  } as unknown as User
}

function mkResults(opts: Partial<TournamentResults> = {}): TournamentResults {
  return {
    groupMatches: opts.groupMatches ?? {},
    groupTables: opts.groupTables ?? {},
    thirdPlaceQualification: { resolved: false, all: [], tied: [] },
    knockoutStages: { ...emptyKO },
    playerGoals: opts.playerGoals,
  } as TournamentResults
}

const cat = (cats: ReturnType<typeof buildRecords>, key: string) => {
  const c = cats.find(c => c.key === key)
  if (!c) throw new Error(`missing category ${key}`)
  return c
}

describe('biggestClimb', () => {
  test('no movement data yields zero', () => {
    expect(biggestClimb([])).toBe(0)
    expect(biggestClimb([5])).toBe(0)
  })

  test('returns the largest single-step rise (rank getting smaller)', () => {
    expect(biggestClimb([5, 2, 3, 1])).toBe(3) // 5 -> 2 is a 3-place climb
  })

  test('only drops means no climb', () => {
    expect(biggestClimb([1, 2, 4])).toBe(0)
  })
})

describe('buildRecords', () => {
  // One complete two-team group: T1 beat T2 2-1, both advance, T1 first.
  const results = mkResults({
    groupMatches: { A: [gm('A1', 2, 1)] },
    groupTables: { A: [st('T1'), st('T2')] },
    playerGoals: { GS1: 3 },
  })

  const alice = mkUser('Alice', {
    topGoalscorer: 'GS1',
    groupMatches: { A: [gm('A1', 2, 1)] },          // exact -> tzelifa, 2 places nailed
    groupTables: { A: [st('T1'), st('T2')] },
  })
  const bob = mkUser('Bob', {
    topGoalscorer: 'GS2',
    groupMatches: { A: [gm('A1', 1, 0)] },           // home win -> pgiya, wrong order
    groupTables: { A: [st('T2'), st('T1')] },        // both advance but no exact place
  })
  const cats = buildRecords([alice, bob], results)

  test('most exact scores (צליפות) ranks the exact predictor on top', () => {
    const c = cat(cats, 'tzelifot')
    expect(c.entries[0]).toMatchObject({ label: 'Alice', value: 1 })
    expect(c.entries.map(e => e.label)).not.toContain('Bob') // zero values are dropped
  })

  test('most correct results (פגיעות) surfaces the result-only hit', () => {
    expect(cat(cats, 'pgiot').entries[0]).toMatchObject({ label: 'Bob', value: 1 })
  })

  test('advancement (עולות) counts qualifiers both tipped right', () => {
    const c = cat(cats, 'olot')
    expect(c.entries).toHaveLength(2)
    expect(c.entries.every(e => e.value === 2)).toBe(true)
  })

  test('exact table positions (מיקומים) reward the right order only', () => {
    const c = cat(cats, 'mikumim')
    expect(c.entries[0]).toMatchObject({ label: 'Alice', value: 2 })
    expect(c.entries.map(e => e.label)).not.toContain('Bob')
  })

  test('total points record names the overall leader', () => {
    expect(cat(cats, 'points').entries[0].label).toBe('Alice')
  })

  test('marks the viewer entries with isMe', () => {
    const mine = buildRecords([alice, bob], results, 'Bob')
    expect(cat(mine, 'pgiot').entries[0].isMe).toBe(true)
    expect(cat(mine, 'tzelifot').entries.find(e => e.label === 'Bob')).toBeUndefined()
  })
})

describe('buildRecords — crossings', () => {
  const km = (matchNum: number, home: string, away: string) => ({ matchNum, home, away, resolved: false })

  function koUser(label: string, r32: ReturnType<typeof km>[]): User {
    return {
      label, topGoalscorer: 'X',
      groupMatches: {}, groupTables: {},
      thirdPlaceQualification: { resolved: false, all: [], tied: [] },
      knockoutStages: { ...emptyKO, r32 },
    } as unknown as User
  }

  // Two settled R32 pairings; both teams of each are real teams.
  const koResults = mkResults({})
  koResults.knockoutStages = { ...emptyKO, r32: [km(73, 'Mexico', 'Canada'), km(74, 'Brazil', 'Spain')] }

  test('counts the cross-bracket pairings each bettor nailed', () => {
    const both = koUser('Both', [km(73, 'Mexico', 'Canada'), km(74, 'Brazil', 'Spain')])
    const one = koUser('One', [km(73, 'Canada', 'Mexico')])           // reversed order still matches
    const none = koUser('None', [km(73, 'Germany', 'France')])        // pairing absent from the results entirely
    const c = cat(buildRecords([both, one, none], koResults), 'crossings')
    expect(c.entries[0]).toMatchObject({ label: 'Both', value: 2 })
    expect(c.entries[1]).toMatchObject({ label: 'One', value: 1 })
    expect(c.entries.map(e => e.label)).not.toContain('None')
  })

  test('counts a 100%-certain pairing even before its slot is formally filled', () => {
    const res = mkResults({})
    // Slot 75 still has an open side ("סגנית ו"), so it is not formally settled.
    res.knockoutStages = { ...emptyKO, r32: [km(75, 'Brazil', 'סגנית ו')] }
    const sure = koUser('Sure', [km(75, 'Brazil', 'Netherlands')])
    const certain = { 75: { 'Brazil|Netherlands': 1 } } // simulation says inevitable

    // Without the sim odds it isn't locked yet → no record entry.
    expect(cat(buildRecords([sure], res), 'crossings').entries).toHaveLength(0)
    // With the 100% pairing it counts as a hit.
    expect(cat(buildRecords([sure], res, undefined, certain), 'crossings').entries[0])
      .toMatchObject({ label: 'Sure', value: 1 })
  })
})
