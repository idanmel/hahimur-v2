import { describe, test, expect } from 'vitest'
import { recommendGroupOutcomes, remainingGroupMatches } from './recommendation'
import { GROUP_MATCHES } from '../../../shared/groups'
import { USERS } from '../../../users'
import type { GroupMatch, MatchScores, TournamentResults } from '../../../shared/types'

const user = USERS[0]

// Build a results object where the first `playedCount` matches of group A have a
// final score and the rest are still open. Only the bits the engine reads
// (groupMatches scores) need to be present.
function resultsForGroupA(playedCount: number): TournamentResults {
  const score: MatchScores = { home: 1, away: 0 }
  const aMatches: GroupMatch[] = GROUP_MATCHES['A'].map((m, i) => ({
    ...m,
    scores: i < playedCount ? score : undefined,
  }))
  return {
    groupMatches: { A: aMatches },
    groupTables: {},
    thirdPlaceQualification: { resolved: false, all: [], tied: [] },
    knockoutStages: { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] },
  }
}

describe('remainingGroupMatches', () => {
  test('returns only the matches without a real score', () => {
    const played = Object.fromEntries(
      GROUP_MATCHES['A'].slice(0, 4).map(m => [m.id, { home: 1, away: 0 }]),
    )
    const remaining = remainingGroupMatches('A', played)
    expect(remaining.map(m => m.id)).toEqual(GROUP_MATCHES['A'].slice(4).map(m => m.id))
  })
})

describe('recommendGroupOutcomes', () => {
  test('scores the remaining matches and exposes the closing order', () => {
    const rec = recommendGroupOutcomes(user, 'A', resultsForGroupA(4))
    expect(rec.remaining).toHaveLength(2)
    expect(rec.scored).toBe(true)
    expect(rec.best).toBeDefined()
    expect(rec.best!.choices).toHaveLength(2)
    expect(rec.best!.orderHe.length).toBeGreaterThanOrEqual(4)
  })

  test('the recommended scenario never banks fewer total points than the obvious one', () => {
    const rec = recommendGroupOutcomes(user, 'A', resultsForGroupA(4))
    // Total-first: the recommendation maximizes the total points you'd bank, so it
    // can never be worth fewer points than simply rooting for your own results.
    expect(rec.best!.points).toBeGreaterThanOrEqual(rec.naive!.points - 1e-9)
  })

  test('counterIntuitive is only set when the best differs from the obvious pick', () => {
    const rec = recommendGroupOutcomes(user, 'A', resultsForGroupA(4))
    const differs = rec.best!.choices.some((c, i) => c.want !== rec.naive!.choices[i].want)
    expect(rec.counterIntuitive).toBe(differs)
  })

  test('a nudge off the obvious pick never sacrifices total points', () => {
    const rec = recommendGroupOutcomes(user, 'A', resultsForGroupA(4))
    if (rec.counterIntuitive) {
      // The nudge is only taken because it banks at least as many total points as
      // your own results (it wins the tie on solid table / seeding) — never fewer.
      expect(rec.best!.points).toBeGreaterThanOrEqual(rec.naive!.points)
    }
  })

  test('is deterministic — same input, same output', () => {
    const a = recommendGroupOutcomes(user, 'A', resultsForGroupA(4))
    const b = recommendGroupOutcomes(user, 'A', resultsForGroupA(4))
    expect(a.best!.points).toBe(b.best!.points)
    expect(a.best!.choices.map(c => c.want)).toEqual(b.best!.choices.map(c => c.want))
  })

  test('scores the whole group even when it is still fully open', () => {
    const rec = recommendGroupOutcomes(user, 'A', resultsForGroupA(0))
    expect(rec.remaining).toHaveLength(6)
    expect(rec.scored).toBe(true)
    expect(rec.best).toBeDefined()
    expect(rec.best!.choices).toHaveLength(6)
  })

  test('exposes the player predicted group order and per-match needed outcomes', () => {
    const rec = recommendGroupOutcomes(user, 'A', resultsForGroupA(0))
    expect(rec.predictedOrderHe.length).toBeGreaterThanOrEqual(4)
    expect(rec.neededOutcomes).toHaveLength(6)
  })

  test('returns nothing to score for a fully-played group', () => {
    const rec = recommendGroupOutcomes(user, 'A', resultsForGroupA(6))
    expect(rec.remaining).toHaveLength(0)
    expect(rec.scored).toBe(false)
  })
})
