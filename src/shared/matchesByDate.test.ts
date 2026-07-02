import { describe, it, expect } from 'vitest'
import { groupMatchesByDate, dateGroups } from './matchesByDate'
import type { Match } from './types'
import type { GroupLetter } from './groups'

const makeMatch = (id: string, matchDate: string, kickoffIST: string): Match => ({
  id,
  homeTeam: 'A',
  awayTeam: 'B',
  matchDate,
  kickoffIST,
})

describe('groupMatchesByDate', () => {
  it('sorts matches chronologically across groups', () => {
    const input: { match: Match; group: GroupLetter }[] = [
      { match: makeMatch('B1', '12 ביוני', '22:00'), group: 'B' },
      { match: makeMatch('A1', '11 ביוני', '22:00'), group: 'A' },
      { match: makeMatch('C1', '14 ביוני', '01:00'), group: 'C' },
      { match: makeMatch('A2', '12 ביוני', '05:00'), group: 'A' },
    ]

    const result = groupMatchesByDate(input)

    expect(result.map(d => d.date)).toEqual(['11 ביוני', '12 ביוני', '14 ביוני'])
    expect(result[1].matches.map(e => e.match.id)).toEqual(['A2', 'B1'])
  })

  it('buckets matches on the same date together', () => {
    const input: { match: Match; group: GroupLetter }[] = [
      { match: makeMatch('A5', '25 ביוני', '04:00'), group: 'A' },
      { match: makeMatch('A6', '25 ביוני', '04:00'), group: 'A' },
      { match: makeMatch('B5', '24 ביוני', '22:00'), group: 'B' },
    ]

    const result = groupMatchesByDate(input)

    expect(result).toHaveLength(2)
    expect(result[1].matches).toHaveLength(2)
  })

  it('attaches a Hebrew day label to each date bucket', () => {
    const input: { match: Match; group: GroupLetter }[] = [
      { match: makeMatch('A1', '11 ביוני', '22:00'), group: 'A' },
    ]

    const result = groupMatchesByDate(input)

    // June 11 2026 is a Thursday = יום חמישי
    expect(result[0].dayLabel).toBe('יום חמישי')
  })

  it('preserves the group tag on each match entry', () => {
    const input: { match: Match; group: GroupLetter }[] = [
      { match: makeMatch('C2', '14 ביוני', '04:00'), group: 'C' },
    ]

    const result = groupMatchesByDate(input)

    expect(result[0].matches[0].group).toBe('C')
  })
})

describe('dateGroups', () => {
  it('sorts June dates before July dates', () => {
    const items = [
      { matchDate: '1 ביולי', kickoffIST: '19:00' },
      { matchDate: '30 ביוני', kickoffIST: '22:00' },
    ]

    const result = dateGroups(items, x => x)

    expect(result.map(g => g.date)).toEqual(['30 ביוני', '1 ביולי'])
  })

  it('labels a July date with the right Hebrew day', () => {
    const items = [{ matchDate: '1 ביולי', kickoffIST: '19:00' }]

    const result = dateGroups(items, x => x)

    // July 1 2026 is a Wednesday = יום רביעי
    expect(result[0].dayLabel).toBe('יום רביעי')
  })

  it('buckets same-date items together in kickoff order', () => {
    const items = [
      { id: 'late', matchDate: '4 ביולי', kickoffIST: '23:00' },
      { id: 'early', matchDate: '4 ביולי', kickoffIST: '19:00' },
    ]

    const result = dateGroups(items, x => x)

    expect(result).toHaveLength(1)
    expect(result[0].items.map(i => i.id)).toEqual(['early', 'late'])
  })
})
