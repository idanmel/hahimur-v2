import { describe, it, expect } from 'vitest'
import { computeUserCrossings, crossingBreakdown } from './crossings'
import type { Crossing } from './crossings'
import type { KnockoutMatch } from '../shared/types'

// Real teams are TEAMS keys; unresolved slots are Hebrew placeholders.
const km = (matchNum: number, home: string, away: string): KnockoutMatch => ({
  matchNum,
  home,
  away,
  resolved: false,
})

describe('computeUserCrossings', () => {
  it('locks a crossing where both predicted teams already reached the slot', () => {
    const actual = [km(73, 'Mexico', 'Canada')]
    const user = [km(73, 'Canada', 'Mexico')] // sides reversed — still the same crossing
    const { locked, potential } = computeUserCrossings(user, actual)
    expect(potential).toHaveLength(0)
    expect(locked).toHaveLength(1)
    expect(locked[0].matchNum).toBe(73)
    expect(locked[0].teams.every(t => t.confirmed)).toBe(true)
    expect(locked[0].pendingSlots).toEqual([])
  })

  it('keeps a half-confirmed crossing as potential and flags the pending slot', () => {
    const actual = [km(75, 'Brazil', 'סגנית ו')] // Brazil in, other side open
    const user = [km(75, 'Brazil', 'Netherlands')]
    const { locked, potential } = computeUserCrossings(user, actual)
    expect(locked).toHaveLength(0)
    expect(potential).toHaveLength(1)
    expect(potential[0].pendingSlots).toEqual(['סגנית ו'])
    const byTeam = Object.fromEntries(potential[0].teams.map(t => [t.team, t.confirmed]))
    expect(byTeam).toEqual({ Brazil: true, Netherlands: false })
  })

  it('keeps a wide-open crossing (neither side resolved) as potential', () => {
    const actual = [km(79, 'מנצח א', 'שלישית א/ב/ג')]
    const user = [km(79, 'Mexico', 'Brazil')]
    const { potential } = computeUserCrossings(user, actual)
    expect(potential).toHaveLength(1)
    expect(potential[0].teams.every(t => !t.confirmed)).toBe(true)
    expect(potential[0].pendingSlots).toEqual(['מנצח א', 'שלישית א/ב/ג'])
  })

  it('marks a crossing broken by a confirmed team the bettor did not pick as missed', () => {
    const actual = [km(76, 'Brazil', 'סגנית ג')] // Brazil confirmed, bettor paired neither
    const user = [km(76, 'Mexico', 'Canada')]
    const { locked, potential, missed } = computeUserCrossings(user, actual)
    expect(locked).toHaveLength(0)
    expect(potential).toHaveLength(0)
    expect(missed).toHaveLength(1)
    expect(missed[0].matchNum).toBe(76)
    expect(missed[0].actualTeams).toEqual(['Brazil']) // the real team that landed
  })

  it('marks a fully-resolved crossing the bettor got wrong as missed', () => {
    const actual = [km(73, 'Mexico', 'Canada')]
    const user = [km(73, 'Brazil', 'Spain')]
    const { locked, potential, missed } = computeUserCrossings(user, actual)
    expect(locked).toHaveLength(0)
    expect(potential).toHaveLength(0)
    expect(missed).toHaveLength(1)
    expect(missed[0].actualTeams).toEqual(['Mexico', 'Canada'])
  })

  it('accounts for every match: locked + potential + missed covers all', () => {
    const actual = [
      km(73, 'Mexico', 'Canada'),     // locked
      km(75, 'Brazil', 'סגנית ו'),    // potential
      km(76, 'Brazil', 'סגנית ג'),    // missed
    ]
    const user = [
      km(73, 'Mexico', 'Canada'),
      km(75, 'Brazil', 'Netherlands'),
      km(76, 'Mexico', 'Canada'),
    ]
    const { locked, potential, missed } = computeUserCrossings(user, actual)
    expect(locked.length + potential.length + missed.length).toBe(3)
  })

  it('skips actual matches the bettor has no prediction for', () => {
    const actual = [km(73, 'Mexico', 'Canada')]
    const { locked, potential } = computeUserCrossings([], actual)
    expect(locked).toHaveLength(0)
    expect(potential).toHaveLength(0)
  })

  it('captures the bettor predicted scoreline, oriented to their home/away', () => {
    const actual = [km(73, 'Mexico', 'Canada')]
    const user: KnockoutMatch[] = [
      { matchNum: 73, home: 'Mexico', away: 'Canada', resolved: false, scores: { home: 2, away: 1 } },
    ]
    const { locked } = computeUserCrossings(user, actual)
    expect(locked[0].predicted).toEqual({ home: 2, away: 1 })
  })

  it('leaves predicted null when the bettor left the knockout score blank', () => {
    const actual = [km(73, 'Mexico', 'Canada')]
    const user = [km(73, 'Mexico', 'Canada')] // km() has no scores
    const { locked } = computeUserCrossings(user, actual)
    expect(locked[0].predicted).toBeNull()
  })

  it('breaks the chance into each team reaching the match plus the joint', () => {
    const crossing = {
      matchNum: 75,
      teams: [{ team: 'Brazil', confirmed: true }, { team: 'Netherlands', confirmed: false }],
      pendingSlots: ['x'],
      predicted: null,
    } as Crossing
    const probByMatch = {
      75: { 'Brazil|Netherlands': 0.3, 'Brazil|Germany': 0.5, 'France|Netherlands': 0.2 },
    }
    const bd = crossingBreakdown(crossing, probByMatch)!
    expect(bd.reachA).toBeCloseTo(0.8) // Brazil appears in 0.3 + 0.5 of runs
    expect(bd.reachB).toBeCloseTo(0.5) // Netherlands in 0.3 + 0.2
    expect(bd.joint).toBeCloseTo(0.3)  // the two together
  })

  it('tells each open team which bracket slot it must finish in', () => {
    const actual = [km(75, 'Brazil', 'סגנית ו')] // Brazil in, the away side still open
    const user = [km(75, 'Brazil', 'Netherlands')]
    const { potential } = computeUserCrossings(user, actual)
    const byTeam = Object.fromEntries(potential[0].teams.map(t => [t.team, t]))
    expect(byTeam.Brazil.confirmed).toBe(true)
    expect(byTeam.Brazil.needsSlot).toBeUndefined()
    expect(byTeam.Netherlands.confirmed).toBe(false)
    expect(byTeam.Netherlands.needsSlot).toBe('סגנית ו') // exactly what it must become
  })

  it('orders potential crossings most-resolved first, then by matchNum', () => {
    const actual = [
      km(80, 'מנצח ב', 'שלישית ד'),      // both open
      km(75, 'Brazil', 'סגנית ו'),       // one confirmed
      km(79, 'Spain', 'שלישית א/ב/ג'),   // one confirmed, lower matchNum
    ]
    const user = [
      km(80, 'Mexico', 'Canada'),
      km(75, 'Brazil', 'Netherlands'),
      km(79, 'Spain', 'Germany'),
    ]
    const { potential } = computeUserCrossings(user, actual)
    expect(potential.map(c => c.matchNum)).toEqual([75, 79, 80])
  })
})
