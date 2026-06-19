import { describe, it, expect } from 'vitest'
import { USERS } from '../../users'
import { tournamentResults } from '../../tournament-results'
import { GROUP_MATCHES, ALL_GROUP_LETTERS } from '../../shared/groups'
import { realPlayedState } from '../../leaderboard/winprob/realPlayed'
import { recommendMatchOutcome } from './matchReco'
import { recommendGroupOutcomes } from '../stats/group/recommendation'
import { buildContext, scoreGroupOutcome, repScore, dir, he, type Want, type GroupScore } from '../stats/group/selfScore'
import type { PredictionsState } from '../../shared/types'
import type { User } from '../../users'

// Exhaustive correctness guard over every (user × match) and (user × group):
// the recommended result must be point-optimal, expPoints must equal the engine's
// own scoring, and any explanation that makes a POINTS claim must be literally
// true. This is the regression net for the "explanations contradict the table"
// class of bugs — the reasons may only ever speak about points, never about a
// specific final order (equal place points can hide a reshuffled table).

const WANTS: Want[] = ['home', 'draw', 'away']
const EPS = 1e-6

function settledState(): PredictionsState {
  const live = tournamentResults.live ?? {}
  const settled: PredictionsState = {}
  for (const [id, s] of Object.entries(realPlayedState(tournamentResults))) {
    if (!live[id]) settled[id] = s
  }
  return settled
}

// Mirror of matchReco.groupStateForMatch (not exported) for ground-truth scoring.
function groupStateForMatch(user: User, groupLetter: string, settled: PredictionsState, targetId: string, want: Want): PredictionsState {
  const state: PredictionsState = {}
  for (const m of GROUP_MATCHES[groupLetter] ?? []) {
    if (settled[m.id]) { state[m.id] = settled[m.id]; continue }
    if (m.id === targetId) { state[m.id] = repScore(want, user.predictions[targetId]); continue }
    const pred = user.predictions[m.id]
    state[m.id] = pred && pred.home != null && pred.away != null ? { home: pred.home, away: pred.away } : { home: 1, away: 0 }
  }
  return state
}

// Points-based claims a reason may make — each must hold exactly.
const EQUIV_TO_BEST = 'נקודות המיקום והעלייה כאן זהות לתוצאה המומלצת'
const POINTS_UNCHANGED = 'נקודות המיקום והעלייה שלך בבית לא משתנות'

describe('recommendation engine correctness (exhaustive)', () => {
  it('match reco: optimal pick, honest expPoints, truthful point claims', () => {
    const settled = settledState()
    const violations: string[] = []

    for (const user of USERS) {
      for (const letter of ALL_GROUP_LETTERS) {
        for (const m of GROUP_MATCHES[letter] ?? []) {
          if (settled[m.id]) continue
          const rec = recommendMatchOutcome(user, m.id, tournamentResults)
          if (!rec || !rec.scored || !rec.best) continue

          const ctx = buildContext(user, letter, settled)
          const scores = new Map<Want, GroupScore>()
          for (const w of WANTS) scores.set(w, scoreGroupOutcome(user, ctx, groupStateForMatch(user, letter, settled, m.id, w)))
          const bestScore = scores.get(rec.best.want)!
          const bestStanding = bestScore.placePoints + bestScore.advPoints

          const maxTotal = Math.max(...WANTS.map(w => scores.get(w)!.total))
          if (bestScore.total < maxTotal - EPS) {
            violations.push(`[OPT] ${user.label} ${m.id}: best total ${bestScore.total} < max ${maxTotal}`)
          }

          for (const o of rec.outcomes) {
            const cur = scores.get(o.want)!
            if (Math.abs(o.expPoints - cur.total) > EPS) {
              violations.push(`[EXP] ${user.label} ${m.id} ${o.want}: expPoints ${o.expPoints} vs truth ${cur.total}`)
            }
            const curStanding = cur.placePoints + cur.advPoints
            for (const r of o.reasons) {
              if (r.textHe.includes(EQUIV_TO_BEST) && Math.abs(curStanding - bestStanding) > EPS) {
                violations.push(`[EQUIV] ${user.label} ${m.id} ${o.want}: place+adv ${curStanding} != best ${bestStanding}`)
              }
              if (r.textHe.includes(POINTS_UNCHANGED)) {
                const allEqual = WANTS.every(w => Math.abs((scores.get(w)!.placePoints + scores.get(w)!.advPoints) - curStanding) < EPS)
                if (!allEqual) violations.push(`[UNCHANGED] ${user.label} ${m.id} ${o.want}: place+adv not invariant`)
              }
            }
          }
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('group reco: recommended scenario is truly point-optimal and its text is honest', () => {
    const settled = settledState()
    const violations: string[] = []

    const allWantCombos = (n: number): Want[][] => {
      if (n === 0) return [[]]
      const rest = allWantCombos(n - 1)
      const out: Want[][] = []
      for (const w of WANTS) for (const r of rest) out.push([w, ...r])
      return out
    }

    for (const user of USERS) {
      for (const letter of ALL_GROUP_LETTERS) {
        const rec = recommendGroupOutcomes(user, letter, tournamentResults)
        if (!rec.scored || !rec.best) continue

        const remaining = (GROUP_MATCHES[letter] ?? []).filter(m => !settled[m.id])
        const ctx = buildContext(user, letter, settled)
        const base: PredictionsState = {}
        for (const m of GROUP_MATCHES[letter] ?? []) if (settled[m.id]) base[m.id] = settled[m.id]
        const scoreCombo = (wants: Want[]): GroupScore => {
          const state: PredictionsState = { ...base }
          remaining.forEach((m, i) => { state[m.id] = repScore(wants[i], user.predictions[m.id]) })
          return scoreGroupOutcome(user, ctx, state)
        }

        // True optimality: no combination of remaining results scores higher.
        const maxTotal = Math.max(...allWantCombos(remaining.length).map(w => scoreCombo(w).total))
        if (rec.best.points < maxTotal - EPS) {
          violations.push(`[GRP-OPT] ${user.label} ${letter}: best ${rec.best.points} < achievable ${maxTotal}`)
        }

        // Reconstruct the recommended scenario from the per-match advice and verify
        // it reproduces the headline, then check the text against it.
        const bestWants = rec.neededOutcomes.map(o => o.want!)
        const bestScore = scoreCombo(bestWants)
        const naiveScore = scoreCombo(remaining.map(m => dir(user.predictions[m.id]) ?? 'home'))
        if (Math.abs(bestScore.total - rec.best.points) > EPS) {
          violations.push(`[GRP-RECON] ${user.label} ${letter}: neededOutcomes total ${bestScore.total} != best ${rec.best.points}`)
        }
        for (const r of rec.reasons) {
          if (r.textHe.includes('הבית נסגר בדיוק בסדר שניחשת')) {
            const orderHe = bestScore.order.map(he).join(' > ')
            if (orderHe !== rec.predictedOrderHe.join(' > ')) {
              violations.push(`[GRP-ORDER] ${user.label} ${letter}: claims exact predicted order but ${orderHe} vs ${rec.predictedOrderHe.join(' > ')}`)
            }
          }
          // The "...— N נק' עלייה." gain line: absolute (best advancers×4) when the
          // recommendation matches your guess, a delta vs naive when it's counter-intuitive.
          const advGain = r.textHe.match(/— (\d+) נק' עלייה\./)
          if (advGain) {
            const stated = Number(advGain[1])
            const expected = rec.counterIntuitive ? bestScore.advPoints - naiveScore.advPoints : bestScore.advancers.length * 4
            if (stated !== expected) {
              violations.push(`[GRP-ADV] ${user.label} ${letter}: states ${stated} עלייה but expected ${expected} (counterIntuitive=${rec.counterIntuitive})`)
            }
          }
        }
        // Sanity: advancers are always a subset of what you predicted to advance.
        if (!bestScore.advancers.every(t => ctx.predAdvancers.includes(t))) {
          violations.push(`[GRP-ADVSET] ${user.label} ${letter}: advancers not subset of predAdvancers`)
        }
      }
    }
    expect(violations).toEqual([])
  })
})
