import type { MatchScores, PredictionsState, KnockoutMatch } from '../shared/types'
import { isPlayerParticipatingInKOMatch, buildKnockoutBracket } from '../formView/knockout/knockout'
import { GROUPS } from '../shared/groups'
import { calculateStandings } from '../shared/standings'

const ROUND_POINTS: Record<string, { pagiya: number; tzelifa: number }> = {
  r32:   { pagiya: 5,  tzelifa: 7  },
  r16:   { pagiya: 6,  tzelifa: 8  },
  qf:    { pagiya: 8,  tzelifa: 12 },
  sf:    { pagiya: 12, tzelifa: 16 },
  third: { pagiya: 16, tzelifa: 18 },
  final: { pagiya: 20, tzelifa: 25 },
  group: { pagiya: 2,  tzelifa: 4  },
}

function roundOf(matchId: string): keyof typeof ROUND_POINTS {
  const n = Number(matchId)
  if (isNaN(n)) return 'group'
  if (n <= 88) return 'r32'
  if (n <= 96) return 'r16'
  if (n <= 100) return 'qf'
  if (n <= 102) return 'sf'
  if (n === 103) return 'third'
  return 'final'
}

function winner(scores: MatchScores): 'home' | 'away' | 'draw' {
  if (scores.home! > scores.away!) return 'home'
  if (scores.away! > scores.home!) return 'away'
  return scores.drawWinner ?? 'draw'
}

function isExactMatch(predicted: MatchScores, actual: MatchScores): boolean {
  return (
    predicted.home === actual.home &&
    predicted.away === actual.away &&
    (predicted.drawWinner ?? null) === (actual.drawWinner ?? null)
  )
}

function singleMatchPoints(matchId: string, predicted: MatchScores, actual: MatchScores): number {
  if (predicted.home === null || predicted.away === null) return 0
  if (actual.home === null || actual.away === null) return 0
  const { pagiya, tzelifa } = ROUND_POINTS[roundOf(matchId)]
  if (isExactMatch(predicted, actual)) return tzelifa
  if (winner(predicted) === winner(actual)) return pagiya
  return 0
}

function top2(groupId: string, predictions: PredictionsState): Set<string> {
  const { standings } = calculateStandings(GROUPS[groupId].matches, predictions)
  return new Set(standings.slice(0, 2).map(s => s.team))
}

// --- Exported interfaces ---

export interface ThirdPlaceQualifiers {
  predictedThirdQualifiers: string[]
  actualThirdQualifiers: string[]
}

export interface KnockoutRoundAdvancers {
  r32?: string[]
  r16?: string[]
  qf?: string[]
  sf?: string[]
  thirdPlaceWinner?: string
  champion?: string
}

export interface KnockoutOleh {
  predicted: KnockoutRoundAdvancers
  actual: KnockoutRoundAdvancers
}

export interface GoldenBoot {
  predictedPlayer: string
  actualGoals: Record<string, number>
  goldenBootWinner: string
}

// --- Part functions ---

export function calculateGroupMatchPoints(
  groupId: string,
  userPredictions: PredictionsState,
  results: PredictionsState,
): number {
  return GROUPS[groupId].matches.reduce((total, match) => {
    const predicted = userPredictions[match.id]
    const actual = results[match.id]
    if (!predicted || !actual) return total
    return total + singleMatchPoints(match.id, predicted, actual)
  }, 0)
}

export function calculateGroupAdvancementPoints(
  groupId: string,
  userPredictions: PredictionsState,
  results: PredictionsState,
): number {
  const allPlayed = GROUPS[groupId].matches.every(m => {
    const r = results[m.id]
    return r && r.home !== null && r.away !== null
  })
  if (!allPlayed) return 0
  const predictedTop2 = top2(groupId, userPredictions)
  const actualTop2 = top2(groupId, results)
  let pts = 0
  for (const team of predictedTop2) {
    if (actualTop2.has(team)) pts += 5
  }
  return pts
}

export function calculateKnockoutMatchPoints(
  userPredictions: PredictionsState,
  results: PredictionsState,
  userBracket?: KnockoutMatch[],
  actualBracket?: KnockoutMatch[],
): number {
  const userByNum   = userBracket   ? Object.fromEntries(userBracket.map(m   => [m.matchNum, m])) : null
  const actualByNum = actualBracket ? Object.fromEntries(actualBracket.map(m => [m.matchNum, m])) : null

  return Object.entries(results).reduce((total, [matchId, actual]) => {
    const matchNum = Number(matchId)
    if (isNaN(matchNum)) return total
    const predicted = userPredictions[matchId]
    if (!predicted) return total
    if (userByNum && actualByNum) {
      const userMatch   = userByNum[matchNum]
      const actualMatch = actualByNum[matchNum]
      if (!userMatch || !actualMatch || !isPlayerParticipatingInKOMatch(actualMatch, userMatch)) return total
    }
    return total + singleMatchPoints(matchId, predicted, actual)
  }, 0)
}

const KNOCKOUT_OLEH_POINTS: Record<keyof KnockoutRoundAdvancers, number> = {
  r32: 5, r16: 8, qf: 12, sf: 16, thirdPlaceWinner: 20, champion: 25,
}

export function calculateKnockoutAdvancementPoints(knockoutOleh: KnockoutOleh): number {
  let pts = 0
  for (const round of Object.keys(KNOCKOUT_OLEH_POINTS) as (keyof KnockoutRoundAdvancers)[]) {
    const pointsForRound = KNOCKOUT_OLEH_POINTS[round]
    const pred = knockoutOleh.predicted[round]
    const act  = knockoutOleh.actual[round]
    if (!pred || !act) continue
    if (typeof pred === 'string') {
      if (pred === act) pts += pointsForRound
    } else {
      const actualSet = new Set(act as string[])
      for (const team of pred as string[]) {
        if (actualSet.has(team)) pts += pointsForRound
      }
    }
  }
  return pts
}

export function calculateThirdPlaceQualifierPoints(thirdPlace: ThirdPlaceQualifiers): number {
  const actualSet = new Set(thirdPlace.actualThirdQualifiers)
  let pts = 0
  for (const team of thirdPlace.predictedThirdQualifiers) {
    if (actualSet.has(team)) pts += 5
  }
  return pts
}

export function calculateGoldenBootPoints(goldenBoot: GoldenBoot): number {
  const goals = goldenBoot.actualGoals[goldenBoot.predictedPlayer] ?? 0
  let pts = goals * 3
  if (goldenBoot.predictedPlayer === goldenBoot.goldenBootWinner) pts += 10
  return pts
}

// --- Breakdown ---

export interface PointsBreakdown {
  group: number
  r32: number
  r16: number
  qf: number
  sf: number
  third: number
  final: number
  goldenBoot: number
  total: number
}

function calculateRoundMatchPoints(
  matchIds: string[],
  userPredictions: PredictionsState,
  results: PredictionsState,
  participating?: Set<number>,
): number {
  return matchIds.reduce((total, matchId) => {
    if (participating && !participating.has(Number(matchId))) return total
    const predicted = userPredictions[matchId]
    const actual = results[matchId]
    if (!predicted || !actual) return total
    return total + singleMatchPoints(matchId, predicted, actual)
  }, 0)
}

const R32_IDS  = Array.from({ length: 16 }, (_, i) => String(73 + i))
const R16_IDS  = Array.from({ length: 8  }, (_, i) => String(89 + i))
const QF_IDS   = Array.from({ length: 4  }, (_, i) => String(97 + i))
const SF_IDS   = ['101', '102']
const THIRD_ID = ['103']
const FINAL_ID = ['104']

export function calculatePointsBreakdown(
  userPredictions: PredictionsState,
  results: PredictionsState,
  goldenBoot?: GoldenBoot,
): PointsBreakdown {
  const userBracket   = buildKnockoutBracket(userPredictions)
  const actualBracket = buildKnockoutBracket(results)
  const actualByNum   = Object.fromEntries(actualBracket.map(m => [m.matchNum, m]))
  const participating = new Set(
    userBracket
      .filter(userMatch => {
        const actualMatch = actualByNum[userMatch.matchNum]
        return actualMatch && isPlayerParticipatingInKOMatch(actualMatch, userMatch)
      })
      .map(m => m.matchNum)
  )

  const group = Object.keys(GROUPS).reduce((total, groupId) => {
    return total
      + calculateGroupMatchPoints(groupId, userPredictions, results)
      + calculateGroupAdvancementPoints(groupId, userPredictions, results)
  }, 0)
  const r32       = calculateRoundMatchPoints(R32_IDS,  userPredictions, results, participating)
  const r16       = calculateRoundMatchPoints(R16_IDS,  userPredictions, results, participating)
  const qf        = calculateRoundMatchPoints(QF_IDS,   userPredictions, results, participating)
  const sf        = calculateRoundMatchPoints(SF_IDS,   userPredictions, results, participating)
  const third     = calculateRoundMatchPoints(THIRD_ID, userPredictions, results, participating)
  const final_pts = calculateRoundMatchPoints(FINAL_ID, userPredictions, results, participating)
  const goldenBootPts = goldenBoot ? calculateGoldenBootPoints(goldenBoot) : 0
  const total = group + r32 + r16 + qf + sf + third + final_pts + goldenBootPts
  return { group, r32, r16, qf, sf, third, final: final_pts, goldenBoot: goldenBootPts, total }
}

// --- Main aggregator ---

export function calculateUserPoints(
  userPredictions: PredictionsState,
  results: PredictionsState,
  thirdPlace?: ThirdPlaceQualifiers,
  knockoutOleh?: KnockoutOleh,
  goldenBoot?: GoldenBoot,
): number {
  const groupPts = Object.keys(GROUPS).reduce((total, groupId) => {
    return total
      + calculateGroupMatchPoints(groupId, userPredictions, results)
      + calculateGroupAdvancementPoints(groupId, userPredictions, results)
  }, 0)

  return groupPts
    + calculateKnockoutMatchPoints(userPredictions, results)
    + (knockoutOleh ? calculateKnockoutAdvancementPoints(knockoutOleh) : 0)
    + (thirdPlace   ? calculateThirdPlaceQualifierPoints(thirdPlace)   : 0)
    + (goldenBoot   ? calculateGoldenBootPoints(goldenBoot)            : 0)
}
