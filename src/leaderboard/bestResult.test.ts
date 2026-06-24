import { describe, it, expect } from 'vitest'
import { bestRemainingResult } from './bestResult'
import { GROUPS } from '../shared/groups'
import type { MatchScores, PredictionsState } from '../shared/types'
import { tournamentResults } from '../tournament-results'
import { USERS } from '../users'
import { settledState } from '../pages/stats/group/recommendation'
import {
  buildContextFromOrder,
  scoreGroupOutcome,
  boundedMaxGoals,
  thirdPickFromQualification,
  protectedThirdsForGroup,
  displacedOwnThirds,
  groupTeams,
  he,
  SLOT_WORD,
  MIN_VIABLE_THIRD_POINTS,
  SURE_THIRD_POINTS,
  type GroupScore,
} from '../pages/stats/group/selfScore'

const ALL_GROUPS = Object.keys(GROUPS)
const settled = settledState(tournamentResults)

const orderOf = (u: typeof USERS[number], g: string) => (u.groupTables[g] ?? []).map(s => s.team)

// Re-derive the maximum achievable TOTAL points (match + place + advancement) over
// EVERY candidate the engine considers, independently of it. The engine is now
// total-first — it maximizes the points you'd actually bank — so this is the
// quantity the recommendation must always hit. We mirror the engine's candidate
// set per match: the bounded goal grid PLUS your own predicted scoreline whenever
// it lies outside that grid (so a high-scoring צליפה stays reachable).
function maxTotalPoints(u: typeof USERS[number], g: string): number {
  const matches = GROUPS[g]?.matches ?? []
  const isPlayedHere = (s: MatchScores | undefined) => !!s && s.home != null && s.away != null
  const remIds = matches.filter(m => !isPlayedHere(settled[m.id])).map(m => m.id)
  const played: PredictionsState = {}
  for (const m of matches) if (isPlayedHere(settled[m.id])) played[m.id] = settled[m.id]
  const order = orderOf(u, g)
  const ctx = buildContextFromOrder(g, order, thirdPickFromQualification(u, g), settled)
  const maxGoals = boundedMaxGoals(remIds.length)
  const candidatesFor = (id: string): MatchScores[] => {
    const list: MatchScores[] = []
    for (let h = 0; h <= maxGoals; h++) for (let a = 0; a <= maxGoals; a++) list.push({ home: h, away: a })
    const p = u.predictions[id]
    if (p && p.home != null && p.away != null && (p.home > maxGoals || p.away > maxGoals)) list.push({ home: p.home, away: p.away })
    return list
  }
  const combos = (ids: string[]): PredictionsState[] => {
    if (ids.length === 0) return [{}]
    const rest = combos(ids.slice(1))
    const out: PredictionsState[] = []
    for (const s of candidatesFor(ids[0])) for (const r of rest) out.push({ ...r, [ids[0]]: s })
    return out
  }
  let max = -Infinity
  for (const combo of combos(remIds)) {
    const s = scoreGroupOutcome(u.predictions, ctx, { ...played, ...combo })
    if (s.total > max) max = s.total
  }
  return max
}

const isPlayed = (s: import('../shared/types').MatchScores | undefined) => !!s && s.home != null && s.away != null

// Independently rebuild the ground truth of the recommended scenario: score the
// ideal scorelines and the naive (your-own-prediction) baseline with the same
// scorer, so we can check each explanation sentence against real numbers.
function groundTruth(u: typeof USERS[number], g: string, ideal: { id: string; scores: import('../shared/types').MatchScores }[]) {
  const matches = GROUPS[g]?.matches ?? []
  const order = orderOf(u, g)
  const played: PredictionsState = {}
  for (const m of matches) if (isPlayed(settled[m.id])) played[m.id] = settled[m.id]
  const ctx = buildContextFromOrder(g, order, thirdPickFromQualification(u, g), settled)
  const idealState: PredictionsState = { ...played }
  for (const im of ideal) idealState[im.id] = im.scores
  const naiveState: PredictionsState = { ...played }
  for (const m of matches) {
    if (isPlayed(settled[m.id])) continue
    const p = u.predictions[m.id]
    naiveState[m.id] = isPlayed(p) ? { home: p.home, away: p.away } : { home: 1, away: 0 }
  }
  return {
    order,
    best: scoreGroupOutcome(u.predictions, ctx, idealState),
    naive: scoreGroupOutcome(u.predictions, ctx, naiveState),
  }
}

// Verify every CLAIM a card reason makes is literally true against ground truth.
function checkCardReasons(
  tag: string,
  reasons: { good: boolean; textHe: string }[],
  best: GroupScore,
  naive: GroupScore,
  order: string[],
  predOrder: string[],
  matchesPrediction: boolean,
  heToTeam: Map<string, string>,
): string[] {
  const v: string[] = []
  const placeD = best.placePoints - naive.placePoints
  const advD = best.advPoints - naive.advPoints

  for (const r of reasons) {
    const t = r.textHe

    // Advancement points. A still-'open' best-third is excluded from the definite
    // gain claim (it's the conditional bonus, explained on its own line), so the
    // sure-gain count drops it. Loss sentences ("...נק' עלייה פחות") state the delta.
    const adv = t.match(/(\d+) נק' עלייה/)
    if (adv) {
      const stated = Number(adv[1])
      const openThird = best.thirdStatus === 'open' ? best.thirdPick : undefined
      let expected: number
      if (t.includes('עלייה פחות')) {
        expected = Math.abs(advD)
      } else if (matchesPrediction) {
        expected = best.advancers.filter(x => x !== openThird).length * 4
      } else {
        expected = best.advancers.filter(x => !naive.advancers.includes(x) && x !== openThird).length * 4
      }
      if (stated !== expected) v.push(`${tag} [ADV] states ${stated} but expected ${expected} (matchesPred=${matchesPrediction})`)
    }

    // Place points: "על כל N הקבוצות" ⇒ full exact order.
    const full = t.match(/על כל (\d+) הקבוצות/)
    if (full) {
      if (best.placePoints !== order.length) v.push(`${tag} [PLACE-FULL] claims all slots but placePoints=${best.placePoints}`)
      if (order.join('>') !== predOrder.join('>')) v.push(`${tag} [PLACE-FULL] claims exact order but ${order.join('>')} != ${predOrder.join('>')}`)
    }
    const placeN = t.match(/(\d+) נקודות מיקום/)
    if (placeN) {
      const stated = Number(placeN[1])
      const expected = matchesPrediction ? best.placePoints : Math.abs(placeD)
      if (stated !== expected) v.push(`${tag} [PLACE-N] states ${stated} but expected ${expected}`)
    }

    // "X במקום ה<slot>" — a slot you predicted. Positive sentences claim it's
    // achieved in the ideal; "...לא קורה בתרחיש הזה" claims it's NOT (a slot lost
    // by deviating). Either way the named team is your own pick for that slot.
    const slotLost = t.includes('לא קורה בתרחיש הזה')
    for (const mm of t.matchAll(/([\u0590-\u05FF'’ ]+?) במקום ה(ראשון|שני|שלישי|רביעי)/g)) {
      let nameHe = mm[1].trim()
      const slot = SLOT_WORD.indexOf(mm[2])
      let team = heToTeam.get(nameHe)
      if (!team && nameHe.startsWith('ו')) { nameHe = nameHe.slice(1); team = heToTeam.get(nameHe) }
      if (!team) { v.push(`${tag} [SLOT-NAME] can't resolve "${nameHe}"`); continue }
      if (predOrder[slot] !== team) v.push(`${tag} [SLOT-PRED] claims ${nameHe} at slot ${slot} but you predicted ${predOrder[slot]} there`)
      if (slotLost) {
        if (order[slot] === team) v.push(`${tag} [SLOT-LOST] says ${nameHe} at slot ${slot} won't happen, but it does`)
      } else if (order[slot] !== team) {
        v.push(`${tag} [SLOT] claims ${nameHe} at slot ${slot} but order has ${order[slot]}`)
      }
    }

    // Named advancers: a gain sentence ("...עולות מהבית כמו שניחשת") means they
    // really advance; a loss sentence ("...כבר לא עולות מהבית") means they don't.
    if (/עול[הת] מהבית/.test(t)) {
      const advLost = t.includes('כבר לא עול')
      const before = t.split(/ (?:כבר לא )?עול/)[0]
      for (const mm of before.matchAll(/[\u0590-\u05FF'’]+(?: [\u0590-\u05FF'’]+)*/g)) {
        const cand = mm[0].replace(/^ו/, '')
        const team = heToTeam.get(cand) ?? heToTeam.get(mm[0])
        if (!team) continue
        const advances = best.advancers.includes(team)
        if (advLost && advances) v.push(`${tag} [ADV-LOST] says ${cand} no longer advances but it does`)
        if (!advLost && !advances) v.push(`${tag} [ADV-NAME] says ${cand} advances but it doesn't`)
      }
    }

    // Third-place wording must match the computed status + the realism floor.
    if (t.includes('מבטיח עלייה כאחת מ')) {
      if (best.thirdStatus !== 'in') v.push(`${tag} [THIRD-IN] text says clinched but status=${best.thirdStatus}`)
    }
    if (t.includes('ריאלית לא מספיק')) {
      if (best.thirdStatus !== 'out' || (best.thirdPoints ?? 0) >= MIN_VIABLE_THIRD_POINTS)
        v.push(`${tag} [THIRD-FLOOR] text says realistically-out but status=${best.thirdStatus} pts=${best.thirdPoints}`)
    }
    if (t.includes('לא תעלה כשלישית') || t.includes('לא יספיק לעלייה')) {
      if (best.thirdStatus !== 'out') v.push(`${tag} [THIRD-OUT] text says out but status=${best.thirdStatus}`)
    }
    if (t.includes('על הגבול')) {
      if (best.thirdStatus !== 'open') v.push(`${tag} [THIRD-OPEN] text says open but status=${best.thirdStatus}`)
    }
    // "always enough" (no כמעט) is reserved for the 6+ sub-tier of 'safe'.
    if (t.includes('כמות כזו תמיד מספיקה')) {
      if (best.thirdStatus !== 'safe' || (best.thirdPoints ?? 0) < SURE_THIRD_POINTS)
        v.push(`${tag} [THIRD-SURE] text says always-enough but status=${best.thirdStatus} pts=${best.thirdPoints}`)
    }
  }
  return v
}

describe('bestRemainingResult — the unified holistic engine', () => {
  // Full re-enumeration is expensive, so prove optimality on a spread of users
  // across every group; the integrity test below still runs over ALL users.
  const sample = USERS.filter((_, i) => i % 4 === 0)
  it('returns a total-points-optimal result across a spread of users × groups', () => {
    for (const u of sample) {
      for (const g of ALL_GROUPS) {
        const order = orderOf(u, g)
        if (order.length < 4) continue
        const res = bestRemainingResult({
          groupLetter: g,
          predictions: u.predictions,
          predictedOrder: order,
          thirdPick: thirdPickFromQualification(u, g),
          settledAll: settled,
        })
        if (!res) continue // no remaining matches in this group
        // Total-first contract: the recommendation banks the maximum achievable
        // total points (match + place + advancement). With no protectedThirds here
        // there's no cross-group deduction, so groupPoints is exactly that maximum.
        expect(res.groupPoints, `${u.label} / group ${g}`).toBe(maxTotalPoints(u, g))
      }
    }
  }, 60000)

  it('offers your exact high-scoring prediction when it costs nothing on the table', () => {
    // Eyal predicted Netherlands 3–1 Tunisia in F6. Holland is 1st and Tunisia
    // 4th either way, so 3–1 earns the same table points as a 1–0 PLUS the צליפה.
    // The goal-grid caps at 2 goals/side for a 4-match group, so this used to be
    // unreachable and we wrongly suggested 1–0; your prediction must now be offered.
    const u = USERS.find(x => x.label === 'אייל ארז')!
    const res = bestRemainingResult({
      groupLetter: 'F',
      predictions: u.predictions,
      predictedOrder: orderOf(u, 'F'),
      thirdPick: thirdPickFromQualification(u, 'F'),
      settledAll: settled,
    })!
    const f6 = res.ideal.find(m => m.id === 'F6')!
    expect(f6.predicted).toEqual({ home: 1, away: 3 }) // guards the fixture assumption
    expect(f6.scores).toEqual(f6.predicted)
  })

  it('does not root for a third that knocks out your own predicted best-third (Idan, group B)', () => {
    // Idan predicted Bosnia 3rd in B (non-advancing) and Scotland/Czech (3 pts) as
    // his qualifying thirds. Rooting for Bosnia to WIN B6 lifts it to 4 pts, which
    // would bump his own Scotland/Czech out of the 8. The guard must avoid that.
    const u = USERS.find(x => x.label === 'עידן מלמד')!
    // The scenario is about rooting for Bosnia in B6, so it only exists while B's
    // final matches are unplayed. Pin that here instead of leaning on live results,
    // which now have B complete.
    const settledBPending = { ...settled }
    delete settledBPending.B5
    delete settledBPending.B6
    const params = {
      groupLetter: 'B',
      predictions: u.predictions,
      predictedOrder: orderOf(u, 'B'),
      thirdPick: thirdPickFromQualification(u, 'B'),
      settledAll: settledBPending,
    }
    const guarded = bestRemainingResult({ ...params, protectedThirds: protectedThirdsForGroup(u.thirdPlaceQualification, 'B') })!
    const unguarded = bestRemainingResult(params)!

    // Without the guard the engine grabs the local צליפה (Bosnia wins → 4 pts),
    // which in reality would knock out one of his own predicted thirds.
    expect(unguarded.thirdTeam).toBe('Bosnia and Herzegovina')
    expect(unguarded.thirdTeamPoints).toBeGreaterThanOrEqual(4)

    // With the guard it avoids that: the recommended third is weak enough that no
    // own pick is displaced, even at the cost of the B6 צליפה.
    expect(guarded.displacedThirds ?? []).toEqual([])
    expect(guarded.thirdTeamPoints).toBeLessThan(unguarded.thirdTeamPoints)
  })

  it('flags own-thirds the guarded engine still cannot protect', () => {
    // displacedOwnThirds is the building block: a 4-point third entering a pool
    // whose 8th qualifier sits on 3 points pushes that 3-point pick out.
    const prot = {
      others: [
        { team: 'Scotland', group: 'C', line: { points: 3, gd: 0, gf: 3 } },
        ...Array.from({ length: 7 }, (_, i) => ({ team: `Q${i}`, group: 'X', line: { points: 5, gd: 2, gf: 5 } })),
      ],
      qualifiers: ['Scotland', 'Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'],
    }
    expect(displacedOwnThirds({ team: 'Bosnia and Herzegovina', line: { points: 4, gd: -1, gf: 4 } }, prot)).toEqual(['Scotland'])
    expect(displacedOwnThirds({ team: 'Bosnia and Herzegovina', line: { points: 2, gd: -3, gf: 2 } }, prot)).toEqual([])
  })

  it('keeps every reported field internally consistent', () => {
    for (const u of USERS) {
      for (const g of ALL_GROUPS) {
        const order = orderOf(u, g)
        if (order.length < 4) continue
        const res = bestRemainingResult({
          groupLetter: g,
          predictions: u.predictions,
          predictedOrder: order,
          thirdPick: thirdPickFromQualification(u, g),
          settledAll: settled,
        })
        if (!res) continue
        const tag = `${u.label} / group ${g}`

        // Points add up.
        expect(res.matchPoints + res.placePoints + res.advancementPoints, tag).toBe(res.groupPoints)

        // Clean slots reflect the resulting order vs the predicted order.
        for (const s of res.slots) {
          if (s.clean) expect(res.resultingOrder[s.position], tag).toBe(s.team)
        }
        expect(res.cleanSlots, tag).toBe(res.slots.filter(s => s.clean).length)

        // Place points never exceed the number of exact slots.
        expect(res.placePoints, tag).toBeLessThanOrEqual(4)

        // We only ever credit advancement to teams you actually tipped to advance.
        const tipped = new Set([order[0], order[1], thirdPickFromQualification(u, g)].filter(Boolean) as string[])
        for (const t of res.advancers) expect(tipped.has(t), `${tag} advancer ${t}`).toBe(true)

        // counterIntuitive is the strict negation of matchesPrediction.
        expect(res.counterIntuitive, tag).toBe(!res.matchesPrediction)

        // There's always at least one plain-language reason.
        expect(res.reasons.length, tag).toBeGreaterThan(0)

        // Every sentence of the explanation must be literally true.
        const { best, naive, order: predOrder } = groundTruth(u, g, res.ideal)
        expect(best.total, `${tag} engine vs recompute`).toBe(res.groupPoints)
        const heToTeam = new Map(groupTeams(g).map(t => [he(t), t]))
        const textViolations = checkCardReasons(tag, res.reasons, best, naive, best.order, predOrder, res.matchesPrediction, heToTeam)
        expect(textViolations, tag).toEqual([])
      }
    }
  }, 60000)
})
