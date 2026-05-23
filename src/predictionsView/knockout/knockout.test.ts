import { describe, it, expect } from 'vitest'
import { resolveKnockout, resolveRound32, clearUnresolvedKOScores } from './knockout'
import type { KnockoutMatch, ThirdPlaceQualification } from '../../shared/types'

const unresolvedR32 = (matchNum: number): KnockoutMatch => ({
  matchNum, home: `Home${matchNum}`, away: `Away${matchNum}`, resolved: false,
})

const resolvedR32 = (matchNum: number, home: string, away: string): KnockoutMatch => ({
  matchNum, home, away, resolved: true,
})

describe('resolveKnockout', () => {
  it('returns correct structure with empty R32 input', () => {
    const result = resolveKnockout([], {})
    expect(result.r16).toHaveLength(8)
    expect(result.qf).toHaveLength(4)
    expect(result.sf).toHaveLength(2)
    expect(result.thirdPlace).toBeDefined()
    expect(result.final).toBeDefined()
  })

  it('r16[0] (match 89) is fed by winners of matches 74 and 77; placeholders when R32 unresolved', () => {
    const r32 = [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88].map(unresolvedR32)
    const { r16 } = resolveKnockout(r32, {})
    const m89 = r16[0]
    expect(m89.matchNum).toBe(89)
    expect(m89.home).toBe('מנצח 74')
    expect(m89.away).toBe('מנצח 77')
    expect(m89.resolved).toBe(false)
  })

  it('home win: home team advances to next round', () => {
    const r32 = [
      resolvedR32(74, 'TeamA', 'TeamB'),
      ...([73, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88].map(unresolvedR32)),
    ]
    const predictions = { '74': { home: 2, away: 1 } }
    const { r16 } = resolveKnockout(r32, predictions)
    const m89 = r16[0]
    expect(m89.home).toBe('TeamA')
    expect(m89.resolved).toBe(false)
  })

  it('away win: away team advances to next round', () => {
    const r32 = [
      resolvedR32(74, 'TeamA', 'TeamB'),
      ...([73, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88].map(unresolvedR32)),
    ]
    const predictions = { '74': { home: 1, away: 2 } }
    const { r16 } = resolveKnockout(r32, predictions)
    expect(r16[0].home).toBe('TeamB')
  })

  it('draw without drawWinner: next-round slot stays as placeholder', () => {
    const r32 = [
      resolvedR32(74, 'TeamA', 'TeamB'),
      ...([73, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88].map(unresolvedR32)),
    ]
    const predictions = { '74': { home: 1, away: 1 } }
    const { r16 } = resolveKnockout(r32, predictions)
    expect(r16[0].home).toBe('מנצח 74')
    expect(r16[0].resolved).toBe(false)
  })

  it('draw with drawWinner home: home team advances', () => {
    const r32 = [
      resolvedR32(74, 'TeamA', 'TeamB'),
      ...([73, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88].map(unresolvedR32)),
    ]
    const predictions = { '74': { home: 1, away: 1, drawWinner: 'home' as const } }
    const { r16 } = resolveKnockout(r32, predictions)
    expect(r16[0].home).toBe('TeamA')
    expect(r16[0].resolved).toBe(false)
  })

  it('draw with drawWinner away: away team advances', () => {
    const r32 = [
      resolvedR32(74, 'TeamA', 'TeamB'),
      ...([73, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88].map(unresolvedR32)),
    ]
    const predictions = { '74': { home: 1, away: 1, drawWinner: 'away' as const } }
    const { r16 } = resolveKnockout(r32, predictions)
    expect(r16[0].home).toBe('TeamB')
    expect(r16[0].resolved).toBe(false)
  })

  it('loser of SF match 101 becomes thirdPlace.home', () => {
    const r32 = Array.from({ length: 16 }, (_, i) =>
      resolvedR32(73 + i, `T${73 + i}`, `U${73 + i}`)
    )
    const predictions: Record<string, { home: number; away: number }> = {}
    for (let n = 73; n <= 100; n++) predictions[String(n)] = { home: 2, away: 0 }
    predictions['101'] = { home: 0, away: 2 }
    predictions['102'] = { home: 2, away: 0 }

    const { thirdPlace, sf } = resolveKnockout(r32, predictions)
    expect(thirdPlace.home).toBe(sf[0].home)
    expect(thirdPlace.resolved).toBe(true)
  })

  it('full chain: Final resolves when all matches have decisive predictions', () => {
    const r32 = Array.from({ length: 16 }, (_, i) =>
      resolvedR32(73 + i, `T${73 + i}`, `U${73 + i}`)
    )
    const predictions: Record<string, { home: number; away: number }> = {}
    for (let n = 73; n <= 102; n++) predictions[String(n)] = { home: 2, away: 0 }

    const { final } = resolveKnockout(r32, predictions)
    expect(final.resolved).toBe(true)
    expect(final.home).not.toMatch(/^מנצח/)
    expect(final.away).not.toMatch(/^מנצח/)
  })
})

function standing(team: string) {
  return { team, played: 3, won: 2, drawn: 0, lost: 1, goalsFor: 4, goalsAgainst: 2, points: 6 }
}

function groupData(group: string, first: string, second: string, third: string, allFilled = true) {
  return { group, allFilled, standings: [standing(first), standing(second), standing(third)] }
}

const ALL_GROUPS = [
  groupData('A', 'Mexico',      'South Africa',  'South Korea'),
  groupData('B', 'Canada',      'Switzerland',   'Qatar'),
  groupData('C', 'Brazil',      'Morocco',       'Haiti'),
  groupData('D', 'USA',         'Turkey',        'Australia'),
  groupData('E', 'Germany',     'Netherlands',   'Ivory Coast'),
  groupData('F', 'Netherlands2','Japan',         'Sweden'),
  groupData('G', 'Belgium',     'Egypt',         'Iran'),
  groupData('H', 'Spain',       'Cape Verde',    'Saudi Arabia'),
  groupData('I', 'Argentina',   'Chile',         'Peru'),
  groupData('J', 'France',      'Portugal',      'Italy'),
  groupData('K', 'England',     'Croatia',       'Ghana'),
  groupData('L', 'Brazil2',     'Colombia',      'Ecuador'),
]

const QUAL_ABCDEFGH: ThirdPlaceQualification = {
  resolved: true,
  all: [],
  qualifiers: [
    { ...standing('South Korea'),  group: 'A' },
    { ...standing('Qatar'),        group: 'B' },
    { ...standing('Haiti'),        group: 'C' },
    { ...standing('Australia'),    group: 'D' },
    { ...standing('Ivory Coast'),  group: 'E' },
    { ...standing('Sweden'),       group: 'F' },
    { ...standing('Iran'),         group: 'G' },
    { ...standing('Saudi Arabia'), group: 'H' },
  ],
}

describe('resolveRound32', () => {
  it('returns 16 matches', () => {
    const result = resolveRound32(ALL_GROUPS, QUAL_ABCDEFGH)
    expect(result).toHaveLength(16)
    expect(result.map(m => m.matchNum)).toEqual([73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88])
  })

  it('resolves all matches when groups are fully filled and qualification is resolved', () => {
    const result = resolveRound32(ALL_GROUPS, QUAL_ABCDEFGH)
    expect(result.every(m => m.resolved)).toBe(true)
  })

  it('resolves fixed runner-up matches from group standings', () => {
    const result = resolveRound32(ALL_GROUPS, QUAL_ABCDEFGH)
    const m73 = result.find(m => m.matchNum === 73)!
    expect(m73.home).toBe('South Africa')
    expect(m73.away).toBe('Switzerland')

    const m75 = result.find(m => m.matchNum === 75)!
    expect(m75.home).toBe('Netherlands2')
    expect(m75.away).toBe('Morocco')
  })

  it('resolves allocation-based matches via the matrix (scenario ABCDEFGH)', () => {
    const result = resolveRound32(ALL_GROUPS, QUAL_ABCDEFGH)
    const m79 = result.find(m => m.matchNum === 79)!
    expect(m79.home).toBe('Mexico')
    expect(m79.away).toBe('Saudi Arabia')

    const m74 = result.find(m => m.matchNum === 74)!
    expect(m74.home).toBe('Germany')
    expect(m74.away).toBe('Haiti')

    const m87 = result.find(m => m.matchNum === 87)!
    expect(m87.home).toBe('England')
    expect(m87.away).toBe('Australia')
  })

  it('shows Hebrew placeholders when a group is not fully filled', () => {
    const partial = ALL_GROUPS.map(d =>
      d.group === 'A' ? { ...d, allFilled: false } : d
    )
    const result = resolveRound32(partial, QUAL_ABCDEFGH)

    const m73 = result.find(m => m.matchNum === 73)!
    expect(m73.resolved).toBe(false)
    expect(m73.home).toMatch(/מנצח|סגן/)

    const m79 = result.find(m => m.matchNum === 79)!
    expect(m79.resolved).toBe(false)
    expect(m79.home).toMatch(/מנצח/)
  })

  it('shows placeholder for allocation slots when third-place is unresolved', () => {
    const unresolved: ThirdPlaceQualification = {
      resolved: false,
      all: [],
      tied: [],
    }
    const result = resolveRound32(ALL_GROUPS, unresolved)

    const allocMatches = [74, 77, 79, 80, 81, 82, 85, 87]
    for (const num of allocMatches) {
      const m = result.find(r => r.matchNum === num)!
      expect(m.resolved).toBe(false)
      expect(m.away).toBe('?')
    }

    const m73 = result.find(m => m.matchNum === 73)!
    expect(m73.resolved).toBe(true)
  })
})

describe('clearUnresolvedKOScores', () => {
  it('clears predictions for unresolved matches', () => {
    const matches: KnockoutMatch[] = [
      { matchNum: 73, home: 'X', away: 'Y', resolved: false },
      { matchNum: 74, home: 'A', away: 'B', resolved: true },
    ]
    const predictions = {
      '73': { home: 2, away: 1 },
      '74': { home: 3, away: 0 },
    }
    const result = clearUnresolvedKOScores(matches, predictions)
    expect(result['73']).toEqual({ home: null, away: null })
    expect(result['74']).toEqual({ home: 3, away: 0 })
  })

  it('leaves predictions unchanged when all matches are resolved', () => {
    const matches: KnockoutMatch[] = [
      { matchNum: 74, home: 'A', away: 'B', resolved: true },
    ]
    const predictions = { '74': { home: 3, away: 0 } }
    const result = clearUnresolvedKOScores(matches, predictions)
    expect(result['74']).toEqual({ home: 3, away: 0 })
  })

  it('returns the same object when nothing needs clearing', () => {
    const matches: KnockoutMatch[] = [
      { matchNum: 74, home: 'A', away: 'B', resolved: true },
    ]
    const predictions = { '74': { home: 3, away: 0 } }
    const result = clearUnresolvedKOScores(matches, predictions)
    expect(result).toBe(predictions)
  })
})
