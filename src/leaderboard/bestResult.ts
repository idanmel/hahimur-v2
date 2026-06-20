import type { Match, MatchScores, PredictionsState } from '../shared/types'
import { GROUPS } from '../shared/groups'
import { calculateStandings } from '../shared/standings'
import {
  buildContextFromOrder,
  scoreGroupOutcome,
  boundedMaxGoals,
  topTwoExact,
  displacedOwnThirds,
  he,
  type ThirdStatus,
  type ProtectedThirds,
} from '../pages/stats/group/selfScore'
import { OLEH_POINTS } from './points'
import {
  buildGroupReasons,
  buildGroupWhy,
  type OutcomeReason,
} from '../pages/stats/group/recommendation'

export type { OutcomeReason }

export interface IdealMatch {
  id: string
  homeTeam: string
  awayTeam: string
  scores: MatchScores
  /** Your own predicted scoreline for this match, so the card can show it as a
   *  reference next to the recommended one. Undefined if you never tipped it. */
  predicted?: MatchScores
}

/** A group order that matches the top-two you predicted (for your knockout
 *  crossings), offered as an alternative when the points-best result reshuffles
 *  your top two — with the group-point cost of preferring it. */
export interface AlternativeOrder {
  orderHe: string[]      // [1st, 2nd] in Hebrew, as you predicted them
  tableCost: number      // group points you'd give up vs the recommended result
}

export interface SlotInfo {
  position: number   // 0 = 1st … 3 = 4th
  team: string       // the team you predicted for this slot
  placed: string     // the team that actually lands here in the ideal result
  clean: boolean     // your predicted team lands here exactly, untied
}

export interface BestResult {
  groupLetter: string
  /** The remaining fixtures with the scoreline to root for. */
  ideal: IdealMatch[]
  resultingOrder: string[]
  orderHe: string[]
  predictedOrderHe: string[]
  /** Every slot 1st→4th: who you predicted, who lands there, and whether it's exact. */
  slots: SlotInfo[]
  cleanSlots: number
  matchPoints: number
  placePoints: number
  advancementPoints: number
  /** Honest group points you'd bank: match (incl. already-played) + place (all four slots) + advancement (top-two AND a best-third). */
  groupPoints: number
  /** Which of your predicted advancers actually go through in the ideal result. */
  advancers: string[]
  /** The predicted top two end level on every tiebreaker — order is a coin flip. */
  tieAtTop: boolean
  /** The ideal result is exactly the scorelines you predicted. */
  matchesPrediction: boolean
  /** The ideal asks for at least one result you did NOT predict. */
  counterIntuitive: boolean
  /** Your best-third pick that lands 3rd in the ideal, and its live outlook. */
  thirdPick?: string
  thirdStatus?: ThirdStatus
  thirdPoints?: number
  /** The team finishing third in the ideal result (for the display line). */
  thirdTeam: string
  thirdTeamPoints: number
  /** Our plain-language explanation of why this result is best for your bet. */
  reasons: OutcomeReason[]
  /** Present only when the recommended result reshuffles your predicted top two:
   *  the bracket-faithful order you predicted and what it costs in group points. */
  alternativeOrder?: AlternativeOrder
  /** Your own predicted best-thirds (other groups) that even the recommended
   *  result still knocks out of the 8 that qualify — a cross-group cost to flag. */
  displacedThirds?: string[]
}

export interface BestResultParams {
  groupLetter: string
  /** The bettor's per-match score predictions (saved user or live form edits). */
  predictions: PredictionsState
  /** The bettor's predicted final order for the group, 1st→4th. */
  predictedOrder: string[]
  /** The bettor's best-third pick from THIS group, if they tipped one. */
  thirdPick?: string
  /** Settled real scores across ALL groups — drives the cross-group third-place outlook. */
  settledAll: PredictionsState
  /** Your own best-third bets in OTHER groups, so we don't recommend a strong third
   *  here that would knock one of them out of the 8 that qualify. Omit to disable. */
  protectedThirds?: ProtectedThirds
}

const isPlayed = (s: MatchScores | undefined): s is MatchScores =>
  !!s && s.home != null && s.away != null

function lexGreater(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return false
}

/**
 * The single, holistic "what's best for you" engine for a group.
 *
 * It enumerates every remaining-match scoreline and scores each candidate purely
 * on YOUR bet, counting every point the pool actually awards:
 *   • match points (פגיעה/צליפה) on the games you predicted,
 *   • a place point for EVERY exact slot — 1st…4th, including non-advancing teams,
 *   • an advancement point for each predicted qualifier that goes through — top-two
 *     and a best-third pick, judged 'in'/'open'/'out' against the real, already-
 *     settled third-place lines of the other groups.
 *
 * Ranking maximizes the TOTAL points you'd actually bank, so the recommendation
 * is never worth fewer points than your own bet. Because exact scorelines (צליפה)
 * are rare while the table is solid, ties are broken toward the placement/
 * advancement points — we only contort the result for a scoreline when it truly
 * earns you more. The lexicographic order is:
 *   1) total points (match + place + advancement, net of any cross-group cost),
 *   2) table points (place + advancement) — prefer the solid points when totals tie,
 *   3) topTwoExact — seed the knockout bracket the way you predicted,
 *   4) your own predicted scoreline, then
 *   5) fewer goals (a calmer, more plausible scoreline).
 * So among results that bank the same total we prefer the bracket-faithful,
 * prediction-faithful, table-heavy one — but we never leave points on the table.
 */
export function bestRemainingResult(params: BestResultParams): BestResult | null {
  const { groupLetter, predictions, predictedOrder, thirdPick, settledAll, protectedThirds } = params
  const matches: Match[] = GROUPS[groupLetter]?.matches ?? []
  if (matches.length === 0) return null

  const remaining = matches.filter(m => !isPlayed(settledAll[m.id]))
  if (remaining.length === 0) return null

  const played: PredictionsState = {}
  for (const m of matches) if (isPlayed(settledAll[m.id])) played[m.id] = settledAll[m.id]

  const remIds = remaining.map(m => m.id)
  const ctx = buildContextFromOrder(groupLetter, predictedOrder, thirdPick, settledAll)
  const maxGoals = boundedMaxGoals(remIds.length)

  const goalSum = (combo: PredictionsState) =>
    remIds.reduce((n, id) => n + (combo[id].home ?? 0) + (combo[id].away ?? 0), 0)
  const isPrediction = (combo: PredictionsState) =>
    remIds.every(id => {
      const p = predictions[id]
      return p && p.home === combo[id].home && p.away === combo[id].away
    })

  // Table value — the solid points we optimize for first: your exact placements
  // plus your advancers. Match points are a bonus that only breaks ties.
  const tableValue = (s: { placePoints: number; advPoints: number }) => s.placePoints + s.advPoints
  // Cross-group own-goal cost: rooting for a strong third here can push one of YOUR
  // OWN predicted best-thirds elsewhere out of the 8 that qualify. We treat those
  // lost advancement points as a deduction from this group's table value, so the
  // engine won't trade them away for a local placement or scoreline bonus.
  const displacedBy = (s: { actualThird?: { team: string; line: { points: number; gd: number; gf: number } } }) =>
    protectedThirds && s.actualThird ? displacedOwnThirds(s.actualThird, protectedThirds) : []
  const netTable = (s: Parameters<typeof tableValue>[0] & { actualThird?: { team: string; line: { points: number; gd: number; gf: number } } }) =>
    tableValue(s) - displacedBy(s).length * OLEH_POINTS.group
  // Total points you'd bank under a candidate, net of the same cross-group cost —
  // the quantity we maximize first so the pick is never worse than your own bet.
  const netTotal = (s: Parameters<typeof netTable>[0] & { matchPoints: number }) =>
    s.matchPoints + netTable(s)
  const topTwoMatches = (order: string[]) =>
    predictedOrder.length >= 2 && order[0] === predictedOrder[0] && order[1] === predictedOrder[1]

  // Candidate scorelines per remaining match: the bounded goal grid, PLUS your
  // own predicted scoreline whenever it lies outside that grid. Big groups cap
  // the grid at 1–2 goals/side to stay fast, so without this a high-scoring
  // צליפה like 3–1 would be unreachable and we'd wrongly suggest a lower-scoring
  // result that only earns פגיעה — even when your exact score costs nothing on
  // the table. Including your prediction keeps the exact-score option available
  // whenever it's genuinely best.
  const candidatesFor = (id: string): MatchScores[] => {
    const list: MatchScores[] = []
    for (let h = 0; h <= maxGoals; h++) for (let a = 0; a <= maxGoals; a++) list.push({ home: h, away: a })
    const p = predictions[id]
    if (p && p.home != null && p.away != null && (p.home > maxGoals || p.away > maxGoals)) {
      list.push({ home: p.home, away: p.away })
    }
    return list
  }
  const allCombos = (ids: string[]): PredictionsState[] => {
    if (ids.length === 0) return [{}]
    const rest = allCombos(ids.slice(1))
    const out: PredictionsState[] = []
    for (const s of candidatesFor(ids[0])) for (const r of rest) out.push({ ...r, [ids[0]]: s })
    return out
  }

  let bestCombo: PredictionsState | null = null
  let bestScore = scoreGroupOutcome(predictions, ctx, { ...played })
  let bestKey: number[] = []

  // The best result that keeps your predicted top-two in their exact slots — the
  // bracket-faithful alternative we offer when the points-best result reshuffles them.
  let altScore: typeof bestScore | null = null
  let altKey: number[] = []

  for (const combo of allCombos(remIds)) {
    const state = { ...played, ...combo }
    const score = scoreGroupOutcome(predictions, ctx, state)
    const key = [
      netTotal(score),
      netTable(score),
      topTwoExact(score.order, predictedOrder),
      isPrediction(combo) ? 1 : 0,
      -goalSum(combo),
    ]
    if (bestCombo === null || lexGreater(key, bestKey)) {
      bestKey = key
      bestCombo = combo
      bestScore = score
    }
    if (topTwoMatches(score.order)) {
      const aKey = [netTotal(score), netTable(score), isPrediction(combo) ? 1 : 0, -goalSum(combo)]
      if (altScore === null || lexGreater(aKey, altKey)) {
        altKey = aKey
        altScore = score
      }
    }
  }
  if (!bestCombo) return null

  // The result you'd root for if you just expected your own predicted scorelines —
  // the baseline our reasons explain the recommendation against.
  const naiveState: PredictionsState = { ...played }
  for (const id of remIds) {
    const p = predictions[id]
    naiveState[id] = isPlayed(p) ? { home: p.home, away: p.away } : { home: 1, away: 0 }
  }
  const naiveScore = scoreGroupOutcome(predictions, ctx, naiveState)

  const matchesPrediction = isPrediction(bestCombo)
  const idealState = { ...played, ...bestCombo }
  const { standings, tiedTeams } = calculateStandings(matches, idealState)
  const order = standings.map(s => s.team)

  const slots: SlotInfo[] = predictedOrder.map((team, position) => ({
    position,
    team,
    placed: order[position],
    clean: order[position] === team && !tiedTeams.has(order[position]),
  }))

  const reasons = matchesPrediction
    ? buildGroupWhy(bestScore, predictedOrder, remaining, predictions)
    : buildGroupReasons(bestScore, naiveScore, predictedOrder)

  // Cross-group guard. Two honest notes:
  //  • if even the recommended result still pushes one of your own best-third bets
  //    out of the top-8, say so;
  //  • if your own predicted scoreline WOULD have, but the recommendation steps
  //    around it, explain that we're trading this match's prediction points to
  //    protect an advancement point worth more.
  const displacedThirds = displacedBy(bestScore)
  const naiveDisplaced = protectedThirds && naiveScore.actualThird
    ? displacedOwnThirds(naiveScore.actualThird, protectedThirds)
    : []
  if (displacedThirds.length > 0) {
    reasons.push({
      good: false,
      textHe: `שים לב: ${he(standings[2]?.team ?? '')} במקום השלישי כאן עדיין דוחפת את ${displacedThirds.map(he).join(' ו')} שניחשת שתעלה — מבין השלישיות, מחוץ ל‑8 העולות.`,
    })
  } else if (naiveDisplaced.length > 0 && naiveScore.actualThird) {
    reasons.push({
      good: true,
      textHe: `עדיף ש${he(naiveScore.actualThird.team)} לא תסיים חזק במקום השלישי כאן — אחרת היא דוחפת את ${naiveDisplaced.map(he).join(' ו')} שניחשת שתעלה כשלישית אל מחוץ ל‑8, ושמירה על ${naiveDisplaced.length * OLEH_POINTS.group} נק' העלייה הזו שווה יותר מנקודות הניחוש כאן.`,
    })
  }

  // Offer the bracket-faithful order only when the recommended result actually
  // reshuffles your predicted top two and a faithful alternative exists at a cost.
  let alternativeOrder: AlternativeOrder | undefined
  if (!topTwoMatches(order) && altScore && predictedOrder.length >= 2) {
    const tableCost = netTotal(bestScore) - netTotal(altScore)
    if (tableCost > 0) {
      alternativeOrder = {
        orderHe: [he(predictedOrder[0]), he(predictedOrder[1])],
        tableCost,
      }
    }
  }

  const predictedScore = (id: string): MatchScores | undefined => {
    const p = predictions[id]
    return p && p.home != null && p.away != null ? { home: p.home, away: p.away } : undefined
  }

  return {
    groupLetter,
    ideal: remaining.map(m => ({ id: m.id, homeTeam: m.homeTeam, awayTeam: m.awayTeam, scores: bestCombo![m.id], predicted: predictedScore(m.id) })),
    resultingOrder: order,
    orderHe: order.map(he),
    predictedOrderHe: predictedOrder.map(he),
    slots,
    cleanSlots: slots.filter(s => s.clean).length,
    matchPoints: bestScore.matchPoints,
    placePoints: bestScore.placePoints,
    advancementPoints: bestScore.advPoints,
    groupPoints: bestScore.total,
    advancers: bestScore.advancers,
    tieAtTop: tiedTeams.has(order[0]) && tiedTeams.has(order[1]),
    matchesPrediction,
    counterIntuitive: !matchesPrediction,
    thirdPick: bestScore.thirdPick,
    thirdStatus: bestScore.thirdStatus,
    thirdPoints: bestScore.thirdPoints,
    thirdTeam: standings[2]?.team ?? '',
    thirdTeamPoints: standings[2]?.points ?? 0,
    reasons,
    alternativeOrder,
    displacedThirds: displacedThirds.length > 0 ? displacedThirds : undefined,
  }
}
