import { describe, expect, test } from 'vitest'
import { buildRivalry, buildShareText } from './rivalryStats'
import { EMPTY_RESULTS, makeUser } from '../../leaderboard/testFixtures'
import type { GroupMatch, KnockoutMatch, MatchScores, TournamentResults } from '../../shared/types'
import type { User } from '../../users'

const koResult = (matchNum: number, home: string, away: string, matchDate: string, kickoffIST: string, scores: { home: number; away: number }): KnockoutMatch =>
  ({ matchNum, home, away, resolved: true, matchDate, kickoffIST, scores })
const koPick = (matchNum: number, home: string, away: string, scores: { home: number; away: number }): KnockoutMatch =>
  ({ matchNum, home, away, resolved: true, scores })

// buildMatchDiff reads picks from user.predictions while points/trajectory read
// user.groupMatches, so a realistic user needs both kept in sync — exactly what
// derivePredictions does for real users. These helpers mirror that for group A.
function userWithGroupA(label: string, picks: Record<string, MatchScores>, champion?: string): User {
  const matches: GroupMatch[] = Object.entries(picks).map(([id, scores]) => ({
    id,
    homeTeam: 'X',
    awayTeam: 'Y',
    scores,
  }))
  return makeUser({ label, groupMatches: { A: matches }, predictions: picks, predictedChampion: champion })
}

function resultsWith(scored: Record<string, MatchScores>): TournamentResults {
  const matches: GroupMatch[] = Object.entries(scored).map(([id, scores], i) => ({
    id,
    homeTeam: 'X',
    awayTeam: 'Y',
    scores,
    matchDate: `2026-06-1${i + 1}`,
    kickoffIST: '19:00',
  }))
  return { ...EMPTY_RESULTS, groupMatches: { A: matches } }
}

describe('buildRivalry', () => {
  test('reports leader, gap, head-to-head and agreement from live results', () => {
    const a = userWithGroupA('אלרד גומא', { A1: { home: 2, away: 0 }, A2: { home: 1, away: 0 } }, 'Portugal')
    const b = userWithGroupA('אלדד לוי', { A1: { home: 1, away: 1 }, A2: { home: 1, away: 0 } }, 'Brazil')
    const results = resultsWith({ A1: { home: 2, away: 0 }, A2: { home: 1, away: 0 } })

    const r = buildRivalry(a, b, [a, b], results)

    // A1: a exact (4), b wrong direction (0). A2: both exact (4 each).
    expect(r.a.total).toBe(8)
    expect(r.b.total).toBe(4)
    expect(r.leader).toBe('a')
    expect(r.gap).toBe(4)
    expect(r.a.rank).toBe(1)
    expect(r.b.rank).toBe(2)

    // A1 -> a wins the fixture, A2 -> tie.
    expect(r.h2h).toEqual({ a: 1, b: 0, tie: 1 })

    // Both predicted A1 + A2; only A2 is an identical scoreline.
    expect(r.agreement.bothPredicted).toBe(2)
    expect(r.agreement.identicalScore).toBe(1)
    expect(r.agreement.identicalPct).toBe(50)

    // Biggest single-match beating is A1, a four-point swing.
    expect(r.biggestBlowout?.winner).toBe('a')
    expect(r.biggestBlowout?.margin).toBe(4)

    expect(r.championSplit.same).toBe(false)
    expect(r.verdict.length).toBeGreaterThan(0)
    expect(r.quips.length).toBeGreaterThan(0)

    // Per-player exact-score (tzelifa) counts: a nailed both, b nailed only A2.
    expect(r.a.tzelifa).toBe(2)
    expect(r.b.tzelifa).toBe(1)
    expect(r.playedCount).toBe(2)
    expect(r.totalPlayers).toBe(2)
    expect(r.bestRank).toBe(1)
  })

  test('counts a lead change when the trailer overtakes', () => {
    const a = userWithGroupA('אלרד גומא', { A1: { home: 1, away: 0 }, A2: { home: 1, away: 1 } })
    const b = userWithGroupA('אלדד לוי', { A1: { home: 2, away: 0 }, A2: { home: 0, away: 3 } })
    // A1 home win (a exact 4, b right direction 2). A2 away win (a miss 0, b exact 4).
    const results = resultsWith({ A1: { home: 1, away: 0 }, A2: { home: 0, away: 3 } })

    const r = buildRivalry(a, b, [a, b], results)

    expect(r.a.total).toBe(4)
    expect(r.b.total).toBe(6)
    expect(r.leader).toBe('b')
    expect(r.aboveBelow.leadChanges).toBe(1)
    expect(r.aboveBelow.currentTop).toBe('b')
  })

  test('twins: identical picks read as a dead heat with a self-aware quip', () => {
    const picks = { A1: { home: 2, away: 0 } }
    const a = userWithGroupA('אלרד גומא', picks)
    const b = userWithGroupA('אלדד לוי', picks)
    const results = resultsWith({ A1: { home: 2, away: 0 } })

    const r = buildRivalry(a, b, [a, b], results)

    expect(r.leader).toBe('tie')
    expect(r.gap).toBe(0)
    expect(r.agreement.identicalPct).toBe(100)
    // A dynamic verdict + quips are produced; exact wording rotates by matchday.
    expect(r.verdict.length).toBeGreaterThan(0)
    expect(r.quips.length).toBeGreaterThan(0)
    // Same inputs must always yield the same copy (deterministic selection).
    expect(buildRivalry(a, b, [a, b], results).verdict).toBe(r.verdict)
  })

  test('returns a small payload even before anything is played', () => {
    const a = userWithGroupA('אלרד גומא', {})
    const b = userWithGroupA('אלדד לוי', {})
    const r = buildRivalry(a, b, [a, b], EMPTY_RESULTS)
    expect(r.h2h).toEqual({ a: 0, b: 0, tie: 0 })
    expect(r.biggestBlowout).toBeNull()
    expect(r.aboveBelow.leadChanges).toBe(0)
    expect(r.playedCount).toBe(0)
    expect(r.verdict.length).toBeGreaterThan(0)
    expect(r.quips.length).toBeGreaterThan(0)
  })

  test('tracks momentum, peak gap and champion status', () => {
    // A1: b nails it, a misses → b wins the fixture.
    // A2 + A3: a nails it, b misses → a wins the latest two in a row.
    const a = userWithGroupA('אלרד גומא', { A1: { home: 0, away: 0 }, A2: { home: 1, away: 0 }, A3: { home: 3, away: 1 } })
    const b = userWithGroupA('אלדד לוי', { A1: { home: 2, away: 0 }, A2: { home: 0, away: 1 }, A3: { home: 1, away: 1 } })
    const results = resultsWith({ A1: { home: 2, away: 0 }, A2: { home: 1, away: 0 }, A3: { home: 3, away: 1 } })

    const r = buildRivalry(a, b, [a, b], results)

    // Latest two fixtures went to a; A1 went to b → a current run of 2.
    expect(r.momentum).toEqual({ side: 'a', count: 2 })

    // Point gap reached 4 at some point along the way.
    expect(r.peakGap?.gap).toBeGreaterThanOrEqual(4)

    // Nothing is mathematically eliminated yet, so no champion has fallen.
    expect(r.championStatus).toEqual({ aOut: false, bOut: false })
  })

  test('peak gap spans knockout matches, not just the group stage', () => {
    // One played group match (11 June) then one played KO match (28 June, later).
    // On the group match both bettors call it identically → gap 0. On the KO match
    // a nails the exact score (R32 tzelifa = 7) while b whiffs → gap 7. The widest
    // cumulative gap therefore lands ON the KO match (the last timeline entry), so
    // a group-only timeline would miss it entirely (peakGap null).
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      groupMatches: {
        A: [{ id: 'A1', homeTeam: 'X', awayTeam: 'Y', scores: { home: 1, away: 0 }, matchDate: '2026-06-11', kickoffIST: '19:00' }],
      },
      knockoutStages: {
        ...EMPTY_RESULTS.knockoutStages,
        r32: [koResult(73, 'Brazil', 'France', '2026-06-28', '22:00', { home: 2, away: 1 })],
      },
    }

    const a = makeUser({
      label: 'אלרד גומא',
      groupMatches: { A: [{ id: 'A1', homeTeam: 'X', awayTeam: 'Y', scores: { home: 1, away: 0 } }] },
      predictions: { A1: { home: 1, away: 0 } },
      knockoutStages: { ...EMPTY_RESULTS.knockoutStages, r32: [koPick(73, 'Brazil', 'France', { home: 2, away: 1 })] },
    })
    const b = makeUser({
      label: 'אלדד לוי',
      groupMatches: { A: [{ id: 'A1', homeTeam: 'X', awayTeam: 'Y', scores: { home: 1, away: 0 } }] },
      predictions: { A1: { home: 1, away: 0 } },
      knockoutStages: { ...EMPTY_RESULTS.knockoutStages, r32: [koPick(73, 'Brazil', 'France', { home: 0, away: 1 })] },
    })

    const r = buildRivalry(a, b, [a, b], results)

    // The widest gap is on the KO match: the second (last) chronological entry.
    expect(r.peakGap).not.toBeNull()
    expect(r.peakGap?.matchday).toBe(2)
    expect(r.peakGap?.gap).toBe(7)
  })

  test('share text is a short one-liner with both first names and the link', () => {
    const a = userWithGroupA('אלרד גומא', { A1: { home: 2, away: 0 } })
    const b = userWithGroupA('אלדד לוי', { A1: { home: 1, away: 1 } })
    const results = resultsWith({ A1: { home: 2, away: 0 } })
    const r = buildRivalry(a, b, [a, b], results)
    const text = buildShareText(r, 'https://example.com/rivalry')
    expect(text).toContain('אלרד')
    expect(text).toContain('אלדד')
    expect(text).toContain('https://example.com/rivalry')
    expect(text).toContain('קרב האל[רד]דים')
    // Keep it short and shareable: a single line.
    expect(text.split('\n')).toHaveLength(1)
  })
})
