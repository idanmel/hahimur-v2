import { describe, it, expect } from 'vitest'
import { USERS } from '../../users'
import { tournamentResults } from '../../tournament-results'
import { GROUP_MATCHES, ALL_GROUP_LETTERS } from '../../shared/groups'
import { realPlayedState } from '../../leaderboard/winprob/realPlayed'
import { recommendMatchOutcome } from './matchReco'
import { recommendGroupOutcomes } from '../stats/group/recommendation'
import { buildContext, scoreGroupOutcome, repScore, dir, he, groupTeams, SLOT_WORD, MIN_VIABLE_THIRD_POINTS, SAFE_THIRD_POINTS, SURE_THIRD_POINTS, type Want, type GroupScore } from '../stats/group/selfScore'
import type { PredictionsState } from '../../shared/types'
import type { User } from '../../users'

// Slot-name, advancer-name and third-place wording in a per-match reason must
// match that outcome's real standings — the exact "explanation contradicts the
// table" bug class. Positive sentences claim a slot/advancer is achieved; loss
// sentences ("...לא קורה בתרחיש הזה" / "כבר לא עולה") claim it isn't.
function checkMatchReasonText(tag: string, reasons: { textHe: string }[], cur: GroupScore, predOrder: string[], heToTeam: Map<string, string>): string[] {
  const v: string[] = []
  for (const r of reasons) {
    const t = r.textHe
    const slotLost = t.includes('לא קורה בתרחיש הזה')
    for (const mm of t.matchAll(/([\u0590-\u05FF'’ ]+?) במקום ה(ראשון|שני|שלישי|רביעי)/g)) {
      let nameHe = mm[1].trim()
      const slot = SLOT_WORD.indexOf(mm[2])
      let team = heToTeam.get(nameHe)
      if (!team && nameHe.startsWith('ו')) { nameHe = nameHe.slice(1); team = heToTeam.get(nameHe) }
      if (!team) { v.push(`${tag} [SLOT-NAME] can't resolve "${nameHe}"`); continue }
      if (predOrder[slot] !== team) v.push(`${tag} [SLOT-PRED] ${nameHe}@${slot} but you predicted ${predOrder[slot]}`)
      if (slotLost ? cur.order[slot] === team : cur.order[slot] !== team) v.push(`${tag} [SLOT] ${nameHe}@${slot} claim wrong vs ${cur.order[slot]} (lost=${slotLost})`)
    }
    if (/עול[הת] מהבית/.test(t)) {
      const advLost = t.includes('כבר לא עול')
      const before = t.split(/ (?:כבר לא )?עול/)[0]
      for (const mm of before.matchAll(/[\u0590-\u05FF'’]+(?: [\u0590-\u05FF'’]+)*/g)) {
        const cand = mm[0].replace(/^ו/, '')
        const team = heToTeam.get(cand) ?? heToTeam.get(mm[0])
        if (!team) continue
        const advances = cur.advancers.includes(team)
        if (advLost && advances) v.push(`${tag} [ADV-LOST] ${cand} claimed dropped but advances`)
        if (!advLost && !advances) v.push(`${tag} [ADV-NAME] ${cand} claimed advancing but doesn't`)
      }
    }
    if (t.includes('מבטיח עלייה כאחת מ') && cur.thirdStatus !== 'in') v.push(`${tag} [THIRD-IN] vs ${cur.thirdStatus}`)
    if (t.includes('תמיד מספיקה לעלייה') && cur.thirdStatus !== 'safe') v.push(`${tag} [THIRD-SAFE] vs ${cur.thirdStatus}`)
    if (t.includes('תמיד מספיקה לעלייה') && (cur.thirdPoints ?? 0) < SAFE_THIRD_POINTS) v.push(`${tag} [THIRD-SAFE-PTS] vs ${cur.thirdPoints}`)
    // "always enough" (no כמעט) is reserved for the 6+ sub-tier.
    if (t.includes('כמות כזו תמיד מספיקה') && (cur.thirdPoints ?? 0) < SURE_THIRD_POINTS) v.push(`${tag} [THIRD-SURE-PTS] vs ${cur.thirdPoints}`)
    if (t.includes('ריאלית לא מספיק') && (cur.thirdStatus !== 'out' || (cur.thirdPoints ?? 0) >= MIN_VIABLE_THIRD_POINTS)) v.push(`${tag} [THIRD-FLOOR] vs ${cur.thirdStatus}/${cur.thirdPoints}`)
    if ((t.includes('כבר יש 8 שלישיות')) && cur.thirdStatus !== 'out') v.push(`${tag} [THIRD-OUT] vs ${cur.thirdStatus}`)
    if (t.includes('על הגבול') && cur.thirdStatus !== 'open') v.push(`${tag} [THIRD-OPEN] vs ${cur.thirdStatus}`)
  }
  return v
}

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
          for (const w of WANTS) scores.set(w, scoreGroupOutcome(user.predictions, ctx, groupStateForMatch(user, letter, settled, m.id, w)))
          const bestScore = scores.get(rec.best.want)!
          const bestStanding = bestScore.placePoints + bestScore.advPoints

          // Total-first optimality: the recommended direction banks the most TOTAL
          // points (match + place + advancement) of the three — never fewer.
          const maxTotal = Math.max(...WANTS.map(w => scores.get(w)!.total))
          if (bestScore.total < maxTotal - EPS) {
            violations.push(`[OPT] ${user.label} ${m.id}: best total ${bestScore.total} < max ${maxTotal}`)
          }

          const heToTeam = new Map(groupTeams(letter).map(t => [he(t), t]))
          for (const o of rec.outcomes) {
            const cur = scores.get(o.want)!
            if (Math.abs(o.expPoints - cur.total) > EPS) {
              violations.push(`[EXP] ${user.label} ${m.id} ${o.want}: expPoints ${o.expPoints} vs truth ${cur.total}`)
            }
            violations.push(...checkMatchReasonText(`${user.label} ${m.id} ${o.want}`, o.reasons, cur, ctx.predOrder, heToTeam))
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
          return scoreGroupOutcome(user.predictions, ctx, state)
        }

        // Reconstruct the recommended scenario from the per-match advice and verify
        // it reproduces the headline, then check the text against it.
        const bestWants = rec.neededOutcomes.map(o => o.want!)
        const bestScore = scoreCombo(bestWants)
        const naiveScore = scoreCombo(remaining.map(m => dir(user.predictions[m.id]) ?? 'home'))

        // Total-first optimality: no combination of remaining results banks more
        // TOTAL points (match + place + advancement) than the recommended scenario.
        const maxTotal = Math.max(...allWantCombos(remaining.length).map(w => scoreCombo(w).total))
        if (bestScore.total < maxTotal - EPS) {
          violations.push(`[GRP-OPT] ${user.label} ${letter}: best total ${bestScore.total} < achievable ${maxTotal}`)
        }

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
            // A still-'open' best-third is excluded from the definite gain claim.
            const openThird = bestScore.thirdStatus === 'open' ? bestScore.thirdPick : undefined
            const expected = rec.counterIntuitive
              ? bestScore.advancers.filter(t => !naiveScore.advancers.includes(t) && t !== openThird).length * 4
              : bestScore.advancers.filter(t => t !== openThird).length * 4
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
