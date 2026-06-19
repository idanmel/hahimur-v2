import type { GroupMatch, PredictionsState, TournamentResults } from '../../../shared/types'
import type { User } from '../../../users'
import { GROUP_MATCHES } from '../../../shared/groups'
import { calculateStandings } from '../../../shared/standings'
import { realPlayedState } from '../../../leaderboard/winprob/realPlayed'
import {
  buildContext,
  scoreGroupOutcome,
  selfPredictedOrder,
  groupTeams,
  repScore,
  dir,
  he,
  slotsWon,
  describeSlots,
  listTeams,
  type Want,
  type GroupScore,
} from './selfScore'

export type { Want }

const CAT = 1e-9

export function remainingGroupMatches(groupLetter: string, realPlayed: PredictionsState): GroupMatch[] {
  return (GROUP_MATCHES[groupLetter] ?? []).filter(m => !realPlayed[m.id])
}

// The matches whose final score is locked in. A match in progress carries a
// provisional live score, but it is NOT settled: we keep it in "remaining" and
// reason about its final outcome, rather than baking the current minute in.
export function settledState(results: TournamentResults): PredictionsState {
  const live = results.live ?? {}
  const settled: PredictionsState = {}
  for (const [id, s] of Object.entries(realPlayedState(results))) {
    if (!live[id]) settled[id] = s
  }
  return settled
}

// Cheap, simulation-free: which of this group's matches still need a result.
export function remainingForGroup(groupLetter: string, results: TournamentResults): GroupMatch[] {
  return remainingGroupMatches(groupLetter, settledState(results))
}

function allWantCombos(n: number): Want[][] {
  if (n === 0) return [[]]
  const rest = allWantCombos(n - 1)
  const out: Want[][] = []
  for (const w of ['home', 'draw', 'away'] as Want[]) {
    for (const r of rest) out.push([w, ...r])
  }
  return out
}

function choiceText(m: GroupMatch, want: Want): string {
  if (want === 'draw') return `תיקו בין ${he(m.homeTeam)} ל${he(m.awayTeam)}`
  const winner = want === 'home' ? m.homeTeam : m.awayTeam
  const loser = want === 'home' ? m.awayTeam : m.homeTeam
  return `${he(winner)} מנצחת את ${he(loser)}`
}

export interface OutcomeChoice {
  matchId: string
  homeHe: string
  awayHe: string
  want: Want
  text: string
}

export interface ScenarioEval {
  choices: OutcomeChoice[]
  order: string[]          // team codes in final group order (1st, 2nd, 3rd, 4th)
  orderHe: string[]
  points: number           // the points you'd earn from this group (basis for ranking)
}

// One concrete, illustrated line in the "why this is best for you" explanation.
export interface OutcomeReason {
  good: boolean
  textHe: string
}

// The simple per-match read: for each still-unplayed group match, the result
// that's part of the best scenario for you within this group.
export interface NeededOutcome {
  matchId: string
  homeHe: string
  awayHe: string
  want: Want | null
  matchesPrediction: boolean
  text: string
}

// Points-only, goal-difference-free read of what's already mathematically decided
// in the group — sound regardless of remaining scorelines, so it's safe to state
// as fact.
export interface AdvanceStatus {
  teamHe: string
  slotWord: string   // 'ראשון' / 'שני' — the exact slot you predicted
  status: 'position' | 'advance' | 'eliminated'
}

export interface GroupContext {
  advances: AdvanceStatus[]
  orderStillPossible: boolean
}

export interface GroupRecommendation {
  remaining: GroupMatch[]
  scored: boolean
  best?: ScenarioEval
  naive?: ScenarioEval
  // The final group order you predicted (1st→4th), so the card can anchor its
  // advice on "the standings you gave".
  predictedOrderHe: string[]
  // The per-match version of the recommended scenario, for a compact list view.
  neededOutcomes: NeededOutcome[]
  counterIntuitive: boolean
  // Why the recommended scenario is best for *your bet*.
  reasons: OutcomeReason[]
  groupContext: GroupContext
}

// What's already mathematically settled in the group, from points alone (no GD,
// no enumeration — so every claim is sound whatever the remaining scorelines).
function buildGroupContext(groupLetter: string, settled: PredictionsState, predOrder: string[]): GroupContext {
  const teams = groupTeams(groupLetter)
  const gamesPerTeam = Math.max(0, teams.length - 1)
  const standings = calculateStandings(GROUP_MATCHES[groupLetter] ?? [], settled).standings
  const byTeam = new Map(standings.map(s => [s.team, s]))
  const info = new Map(teams.map(t => {
    const s = byTeam.get(t)
    const cur = s?.points ?? 0
    const played = s?.played ?? 0
    return [t, { cur, max: cur + 3 * Math.max(0, gamesPerTeam - played) }]
  }))

  const advances: AdvanceStatus[] = []
  predOrder.slice(0, 2).forEach((t, idx) => {
    const me = info.get(t)
    if (!me) return
    const others = teams.filter(x => x !== t).map(x => info.get(x)!).filter(Boolean)
    const canReachMyFloor = others.filter(o => o.max >= me.cur).length
    const clinchedAboveMe = others.filter(o => o.cur > me.max).length
    const slotWord = idx === 0 ? 'ראשון' : 'שני'
    if (idx === 0 && others.every(o => o.max < me.cur)) {
      advances.push({ teamHe: he(t), slotWord, status: 'position' })
    } else if (canReachMyFloor <= 1) {
      advances.push({ teamHe: he(t), slotWord, status: 'advance' })
    } else if (clinchedAboveMe >= 2) {
      advances.push({ teamHe: he(t), slotWord, status: 'eliminated' })
    }
  })

  let orderStillPossible = true
  for (let i = 0; i < predOrder.length && orderStillPossible; i++) {
    for (let j = i + 1; j < predOrder.length; j++) {
      const a = info.get(predOrder[i]); const b = info.get(predOrder[j])
      if (a && b && b.cur > a.max) { orderStillPossible = false; break }
    }
  }

  return { advances, orderStillPossible }
}

// Why the recommended scenario beats the obvious one for *your bet*, read off the
// point components: your group scoreline points, your exact standings order
// (naming the slots that change) and your advancers (incl. an at-risk best-third
// pick). Only your own picks.
function buildGroupReasons(best: GroupScore, naive: GroupScore, predOrder: string[]): OutcomeReason[] {
  const reasons: OutcomeReason[] = []

  const matchD = best.matchPoints - naive.matchPoints
  if (Math.abs(matchD) > CAT) {
    reasons.push({
      good: matchD > 0,
      textHe: matchD > 0
        ? `מרוויח לך ${matchD} נק' צליפה/פגיעה במשחקי הבית.`
        : `מוותר על ${Math.abs(matchD)} נק' צליפה/פגיעה במשחק — אבל מרוויח יותר במקום אחר.`,
    })
  }

  const placeD = best.placePoints - naive.placePoints
  if (placeD > CAT) {
    const won = slotsWon(best.order, naive.order, predOrder).slice(0, 2)
    const nk = placeD > 1 ? `${placeD} נקודות מיקום` : 'נקודת מיקום'
    reasons.push({
      good: true,
      textHe: won.length
        ? `${describeSlots(won)} — בדיוק כמו שניחשת, ${nk}.`
        : `הסדר שניחשת בבית מסתדר טוב יותר — ${nk}.`,
    })
  } else if (placeD < -CAT) {
    const lost = slotsWon(naive.order, best.order, predOrder).slice(0, 2)
    const nk = Math.abs(placeD) > 1 ? `${Math.abs(placeD)} נקודות מיקום` : 'נקודת מיקום'
    reasons.push({
      good: false,
      textHe: lost.length
        ? `${describeSlots(lost)} — לא קורה בתרחיש הזה, ${nk} פחות.`
        : `הסדר שניחשת בבית פחות מסתדר — ${nk} פחות.`,
    })
  }

  const advD = best.advPoints - naive.advPoints
  if (advD > CAT) {
    const gained = best.advancers.filter(t => !naive.advancers.includes(t))
    reasons.push({
      good: true,
      textHe: gained.length
        ? `${listTeams(gained)} ${gained.length > 1 ? 'עולות' : 'עולה'} מהבית כמו שניחשת — ${advD} נק' עלייה.`
        : `יותר מהקבוצות שניחשת עולות כך — ${advD} נק' עלייה.`,
    })
  } else if (advD < -CAT) {
    const dropped = naive.advancers.filter(t => !best.advancers.includes(t))
    reasons.push({
      good: false,
      textHe: dropped.length
        ? `${listTeams(dropped)} כבר לא ${dropped.length > 1 ? 'עולות' : 'עולה'} מהבית — ${Math.abs(advD)} נק' עלייה פחות.`
        : `פחות מהקבוצות שניחשת עולות כך — ${Math.abs(advD)} נק' עלייה פחות.`,
    })
  }

  if (best.thirdStatus && best.thirdPick) {
    const teamHe = he(best.thirdPick)
    if (best.thirdStatus === 'in') {
      reasons.push({ good: true, textHe: `${teamHe} תסיים שלישית — ובטוח עולה כאחת מ‑8 השלישיות הטובות.` })
    } else if (best.thirdStatus === 'out') {
      reasons.push({ good: false, textHe: `${teamHe} תסיים שלישית עם ${best.thirdPoints} נק' — לא יספיק לעלייה.` })
    } else {
      reasons.push({ good: true, textHe: `${teamHe} תסיים שלישית — העלייה כשלישית עדיין פתוחה, תלוי בבתים שטרם נסגרו.` })
    }
  }

  return reasons.slice(0, 4)
}

// When the recommended scenario IS your own predicted result, there's no tradeoff
// to spell out — so we explain in absolute terms what it secures you: your
// scoreline points on the matches you predicted, the exact placements it locks in,
// and the advancers it carries through. Grounded only in your bet.
function buildGroupWhy(
  best: GroupScore,
  predOrder: string[],
  remaining: GroupMatch[],
  user: User,
): OutcomeReason[] {
  const reasons: OutcomeReason[] = []

  const predictedRemaining = remaining.filter(m => !!dir(user.predictions[m.id]))
  if (predictedRemaining.length > 0) {
    reasons.push({
      good: true,
      textHe: predictedRemaining.length > 1
        ? `התוצאות שמומלצות הן בדיוק בכיוון שניחשת — כך אתה שומר על נקודות הצליפה/פגיעה במשחקים האלה.`
        : `התוצאה שמומלצת היא בדיוק בכיוון שניחשת — כך אתה שומר על נקודות הצליפה/פגיעה במשחק.`,
    })
  }

  if (best.placePoints > 0) {
    const matched: { team: string; slot: number }[] = []
    for (let i = 0; i < predOrder.length; i++) if (best.order[i] === predOrder[i]) matched.push({ team: predOrder[i], slot: i })
    const full = best.placePoints >= predOrder.length
    reasons.push({
      good: true,
      textHe: full
        ? `הבית נסגר בדיוק בסדר שניחשת — נקודת מיקום על כל ${predOrder.length} הקבוצות.`
        : `${describeSlots(matched.slice(0, 2))} בדיוק כמו שניחשת — ${best.placePoints > 1 ? `${best.placePoints} נקודות מיקום` : 'נקודת מיקום'}.`,
    })
  }

  if (best.advancers.length > 0) {
    reasons.push({
      good: true,
      textHe: `${listTeams(best.advancers)} ${best.advancers.length > 1 ? 'עולות' : 'עולה'} מהבית כמו שניחשת — ${best.advancers.length * 4} נק' עלייה.`,
    })
  }

  if (best.thirdStatus && best.thirdPick) {
    const teamHe = he(best.thirdPick)
    if (best.thirdStatus === 'in') {
      reasons.push({ good: true, textHe: `${teamHe} תסיים שלישית — ובטוח עולה כאחת מ‑8 השלישיות הטובות.` })
    } else if (best.thirdStatus === 'out') {
      reasons.push({ good: false, textHe: `${teamHe} תסיים שלישית — לא תעלה כשלישית, אז העלייה שלה כבר לא בתמונה.` })
    } else {
      reasons.push({ good: true, textHe: `${teamHe} תסיים שלישית — שומר לה את הסיכוי לעלות (תלוי בבתים שטרם נסגרו).` })
    }
  }

  if (reasons.length === 0) {
    reasons.push({ good: true, textHe: 'התוצאות האלה שומרות על ההימור שלך בבית כפי שניחשת.' })
  }

  return reasons.slice(0, 4)
}

// The best scenario for `groupLetter` from your point of view, judged only on
// your group bet: your scoreline points, your exact standings order
// (goal-difference aware) and your advancers (top-2 and a best-third pick).
// Deterministic — every remaining-match direction combo is scored and the
// highest total wins; ties stay on your own predicted results.
export function recommendGroupOutcomes(
  user: User,
  groupLetter: string,
  results: TournamentResults,
): GroupRecommendation {
  const settled = settledState(results)
  const remaining = remainingGroupMatches(groupLetter, settled)
  const predOrder = selfPredictedOrder(user, groupLetter)
  const predictedOrderHe = predOrder.map(he)
  const groupContext = buildGroupContext(groupLetter, settled, predOrder)

  if (remaining.length === 0) {
    return {
      remaining, scored: false, predictedOrderHe, neededOutcomes: [],
      counterIntuitive: false, reasons: [], groupContext,
    }
  }

  const ctx = buildContext(user, groupLetter, settled)

  const baseGroup: PredictionsState = {}
  for (const m of GROUP_MATCHES[groupLetter] ?? []) if (settled[m.id]) baseGroup[m.id] = settled[m.id]

  const scoreCombo = (wants: Want[]): GroupScore => {
    const state: PredictionsState = { ...baseGroup }
    remaining.forEach((m, i) => { state[m.id] = repScore(wants[i], user.predictions[m.id]) })
    return scoreGroupOutcome(user, ctx, state)
  }

  const naiveWants: Want[] = remaining.map(m => dir(user.predictions[m.id]) ?? 'home')
  const deviations = (w: Want[]) => w.reduce((n, x, i) => n + (x === naiveWants[i] ? 0 : 1), 0)

  // Best = most of *your* points; ties go to staying on your own predicted
  // results, then to the safer at-risk third (more points).
  let bestWants = naiveWants
  let bestScore = scoreCombo(naiveWants)
  let bestDev = 0
  for (const wants of allWantCombos(remaining.length)) {
    const s = scoreCombo(wants)
    const dev = deviations(wants)
    const better =
      s.total > bestScore.total + CAT ||
      (Math.abs(s.total - bestScore.total) <= CAT &&
        (dev < bestDev ||
          (dev === bestDev && (s.thirdPoints ?? 0) > (bestScore.thirdPoints ?? 0))))
    if (better) { bestScore = s; bestWants = wants; bestDev = dev }
  }
  const naiveScore = scoreCombo(naiveWants)

  const toScenario = (wants: Want[], score: GroupScore): ScenarioEval => ({
    choices: remaining.map((m, i) => ({
      matchId: m.id, homeHe: he(m.homeTeam), awayHe: he(m.awayTeam),
      want: wants[i], text: choiceText(m, wants[i]),
    })),
    order: score.order,
    orderHe: score.order.map(he),
    points: score.total,
  })

  const counterIntuitive = deviations(bestWants) > 0

  const neededOutcomes: NeededOutcome[] = remaining.map((m, i) => ({
    matchId: m.id, homeHe: he(m.homeTeam), awayHe: he(m.awayTeam),
    want: bestWants[i],
    matchesPrediction: (dir(user.predictions[m.id]) ?? 'home') === bestWants[i],
    text: choiceText(m, bestWants[i]),
  }))

  return {
    remaining,
    scored: true,
    best: toScenario(bestWants, bestScore),
    naive: toScenario(naiveWants, naiveScore),
    predictedOrderHe,
    neededOutcomes,
    counterIntuitive,
    reasons: counterIntuitive
      ? buildGroupReasons(bestScore, naiveScore, predOrder)
      : buildGroupWhy(bestScore, predOrder, remaining, user),
    groupContext,
  }
}
