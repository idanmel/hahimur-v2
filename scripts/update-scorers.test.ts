import { describe, it, expect } from 'vitest'
import { TRACKED_PLAYERS, pendingScorerQuestions } from './update-scorers'
import { parseRealGoals, renderRealGoals } from './results-file'
import { USERS } from '../src/users/index'

describe('TRACKED_PLAYERS', () => {
  it('covers every distinct topGoalscorer pick', () => {
    const picks = new Set(USERS.map(u => u.topGoalscorer))
    const tracked = new Set(Object.keys(TRACKED_PLAYERS))
    expect([...picks].filter(p => !tracked.has(p))).toEqual([])
  })
})

describe('pendingScorerQuestions', () => {
  // I1 is France vs Senegal; France is Mbappé's team.
  it('asks about a tracked player whose team has a finished match', () => {
    const pending = pendingScorerQuestions({ I1: { home: 4, away: 1 } }, {})
    expect(pending).toContainEqual({ player: 'קיליאן אמבפה', matchId: 'I1' })
  })

  it('does not ask about matches without tracked teams', () => {
    const pending = pendingScorerQuestions({ A1: { home: 2, away: 1 } }, {})
    expect(pending).toEqual([])
  })

  it('does not re-ask once the player has an entry for that match, even 0', () => {
    const pending = pendingScorerQuestions(
      { I1: { home: 4, away: 1 } },
      { 'קיליאן אמבפה': { I1: 0 } },
    )
    expect(pending).toEqual([])
  })

  it('asks about each tracked player of the same team separately', () => {
    // E1 is Germany vs Curaçao; both Havertz and Wirtz are Germany picks.
    const pending = pendingScorerQuestions(
      { E1: { home: 3, away: 0 } },
      { 'קאי האברץ': { E1: 1 } },
    )
    expect(pending).toEqual([{ player: 'פלוריאן וירץ', matchId: 'E1' }])
  })
})

describe('realGoals parse/render round-trip', () => {
  const empty = [
    'const realGoals: Record<string, Record<string, number>> = {',
    '}',
  ].join('\n')

  it('parses an empty block', () => {
    expect(parseRealGoals(empty)).toEqual({})
  })

  it('renders goals and parses them back', () => {
    const goals = { 'קיליאן אמבפה': { I1: 2, I3: 0 }, 'הארי קיין': { L1: 1 } }
    const rendered = renderRealGoals(empty, goals)
    expect(parseRealGoals(rendered)).toEqual(goals)
  })

  it('overwrites an existing block instead of appending', () => {
    const once = renderRealGoals(empty, { 'הארי קיין': { L1: 1 } })
    const twice = renderRealGoals(once, { 'הארי קיין': { L1: 1, L2: 2 } })
    expect(parseRealGoals(twice)).toEqual({ 'הארי קיין': { L1: 1, L2: 2 } })
  })
})
