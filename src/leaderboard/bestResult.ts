import type { Match, MatchScores } from '../shared/types'
import { GROUPS } from '../shared/groups'
import { calculateStandings } from '../shared/standings'
import { singleMatchPoints, OLEH_POINTS, PLACE_POINT } from './points'

export interface IdealMatch {
  id: string
  homeTeam: string
  awayTeam: string
  scores: MatchScores
}

export interface BestResult {
  groupLetter: string
  /** The remaining fixtures with the scoreline to root for. */
  ideal: IdealMatch[]
  resultingOrder: string[]
  /** Positions (0=1st…) you predicted to qualify, and whether each lands cleanly. */
  slots: { position: number; team: string; clean: boolean }[]
  /** How many of your predicted qualifiers sit in their exact, non-tied slot. */
  cleanSlots: number
  matchPoints: number
  placePoints: number
  advancementPoints: number
  /** Actual group points you'd bank (match + place + top-two advancement). */
  groupPoints: number
  /** The predicted top two end level on every tiebreaker — order is a coin flip. */
  tieAtTop: boolean
  /** The ideal result is exactly what you predicted. */
  matchesPrediction: boolean
  /** Did you tip this group's third-place team to advance as a best-third? */
  thirdShouldAdvance: boolean
  /** The team finishing third in the ideal result, and its points. */
  thirdTeam: string
  thirdPoints: number
}

// Locking the 1st/2nd slots seeds the bracket halves — weighted to dominate
// everything else. The third-place nudge is worth a few points either way.
const W_SLOT = 100
const W_THIRD = 3

const isPlayed = (s: MatchScores | undefined): s is MatchScores =>
  !!s && s.home !== null && s.away !== null

function enumerateScores(ids: string[], maxGoals: number): Record<string, MatchScores>[] {
  if (ids.length === 0) return [{}]
  const [head, ...tail] = ids
  const rest = enumerateScores(tail, maxGoals)
  const out: Record<string, MatchScores>[] = []
  for (let h = 0; h <= maxGoals; h++)
    for (let a = 0; a <= maxGoals; a++)
      for (const r of rest) out.push({ ...r, [head]: { home: h, away: a } })
  return out
}

function boundedMaxGoals(remaining: number, want = 5): number {
  let g = want
  while (g > 1 && Math.pow((g + 1) * (g + 1), remaining) > 60000) g--
  return g
}

function lexGreater(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] > b[i]
  }
  return false
}

/**
 * Finds the remaining-match result that best reproduces the user's predicted
 * qualification: each predicted qualifier finishing in the exact slot it was
 * tipped for (winner→1st, runner-up→2nd, your third-place pick→3rd). Getting the
 * *slot* right is what seeds the bracket, so it ranks above raw group points,
 * which are used only as a tiebreak. A cheap local proxy for "keep my bracket
 * intact" — it ignores cross-group third-place displacement.
 */
export function bestRemainingResult(
  groupLetter: string,
  predictions: Record<string, MatchScores>,
  predictedOrder: string[],
  realScores: Record<string, MatchScores>,
  opts: { thirdQualifies?: boolean } = {},
): BestResult | null {
  const matches: Match[] = GROUPS[groupLetter]?.matches ?? []
  if (matches.length === 0) return null

  const remaining = matches.filter(m => !isPlayed(realScores[m.id]))
  if (remaining.length === 0) return null

  const played: Record<string, MatchScores> = {}
  for (const m of matches) if (isPlayed(realScores[m.id])) played[m.id] = realScores[m.id]

  const remIds = remaining.map(m => m.id)
  const predTop2 = new Set(predictedOrder.slice(0, 2))
  // Positions you predicted to qualify (the bracket-relevant slots).
  const qualPositions = [0, 1, ...(opts.thirdQualifies ? [2] : [])]
  const maxGoals = boundedMaxGoals(remIds.length)

  const goalSum = (combo: Record<string, MatchScores>) =>
    remIds.reduce((n, id) => n + (combo[id].home ?? 0) + (combo[id].away ?? 0), 0)
  const isPrediction = (combo: Record<string, MatchScores>) =>
    remIds.every(id => {
      const p = predictions[id]
      return p && p.home === combo[id].home && p.away === combo[id].away
    })

  let best: BestResult | null = null
  let bestKey: number[] = []

  for (const combo of enumerateScores(remIds, maxGoals)) {
    const { standings, tiedTeams } = calculateStandings(matches, { ...played, ...combo })
    const order = standings.map(s => s.team)

    const slots = qualPositions.map(p => ({
      position: p,
      team: predictedOrder[p],
      clean: order[p] === predictedOrder[p] && !tiedTeams.has(order[p]),
    }))
    const cleanSlots = slots.filter(s => s.clean).length

    let matchPoints = 0
    for (const id of remIds) {
      const pred = predictions[id]
      if (isPlayed(pred)) matchPoints += singleMatchPoints(id, pred, combo[id])
    }
    let placePoints = 0
    for (let i = 0; i < order.length; i++) if (order[i] === predictedOrder[i]) placePoints += PLACE_POINT
    let advancementPoints = 0
    for (const t of order.slice(0, 2)) if (predTop2.has(t)) advancementPoints += OLEH_POINTS.group
    const groupPoints = matchPoints + placePoints + advancementPoints

    // Lock the two bracket-half slots (1st/2nd) above all else. Then nudge the
    // third-place team in the direction you predicted: if you tipped it to go
    // through, reward its strength (more likely to clear the best-thirds cut);
    // if you didn't, reward it staying weak (so it can't bump *your* thirds).
    const topSlots = [0, 1].filter(p => order[p] === predictedOrder[p] && !tiedTeams.has(order[p])).length
    const third = standings[2]
    const thirdTerm = opts.thirdQualifies
      ? W_THIRD * (standings.find(s => s.team === predictedOrder[2])?.points ?? 0)
      : -W_THIRD * third.points
    const score = groupPoints + W_SLOT * topSlots + thirdTerm

    const key = [score, isPrediction(combo) ? 1 : 0, -goalSum(combo)]
    if (best === null || lexGreater(key, bestKey)) {
      bestKey = key
      best = {
        groupLetter,
        ideal: remaining.map(m => ({ id: m.id, homeTeam: m.homeTeam, awayTeam: m.awayTeam, scores: combo[m.id] })),
        resultingOrder: order,
        slots, cleanSlots,
        matchPoints, placePoints, advancementPoints, groupPoints,
        tieAtTop: tiedTeams.has(order[0]) && tiedTeams.has(order[1]),
        matchesPrediction: isPrediction(combo),
        thirdShouldAdvance: !!opts.thirdQualifies,
        thirdTeam: third.team,
        thirdPoints: third.points,
      }
    }
  }

  return best
}
