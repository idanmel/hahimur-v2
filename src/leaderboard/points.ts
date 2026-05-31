import { isUnpredicted, type MatchScores, type PredictionsState, type KnockoutMatch, type TournamentResults } from '../shared/types'
import { isPlayerParticipatingInKOMatch, buildKnockoutBracket, getQualifiedThirdPlaceTeams } from '../formView/knockout/knockout'
import { GROUPS } from '../shared/groups'
import { calculateStandings } from '../shared/standings'
import type { User } from '../users'

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

function isDraw(scores: MatchScores): boolean {
  return scores.home === scores.away
}

export function singleMatchPoints(matchId: string, predicted: MatchScores, actual: MatchScores): number {
  if (isUnpredicted(predicted)) return 0
  if (isUnpredicted(actual)) return 0
  const { pagiya, tzelifa } = ROUND_POINTS[roundOf(matchId)]
  if (isExactMatch(predicted, actual)) return tzelifa
  if (isDraw(predicted) !== isDraw(actual)) return 0
  if (winner(predicted) === winner(actual)) return pagiya
  return 0
}

function top2(groupId: string, predictions: PredictionsState): Set<string> {
  const { standings } = calculateStandings(GROUPS[groupId].matches, predictions)
  return new Set(standings.slice(0, 2).map(s => s.team))
}

function advPts(predicted: string[], actual: string[], pts: number): number {
  const actualSet = new Set(actual)
  return predicted.reduce((sum, t) => sum + (actualSet.has(t) ? pts : 0), 0)
}

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
    return r && !isUnpredicted(r)
  })
  if (!allPlayed) return 0
  return advPts(Array.from(top2(groupId, userPredictions)), Array.from(top2(groupId, results)), 5)
}

function sumGroupPoints(userPredictions: PredictionsState, results: PredictionsState): number {
  return Object.keys(GROUPS).reduce((total, groupId) => {
    return total
      + calculateGroupMatchPoints(groupId, userPredictions, results)
      + calculateGroupAdvancementPoints(groupId, userPredictions, results)
  }, 0)
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
      pts += advPts(pred as string[], act as string[], pointsForRound)
    }
  }
  return pts
}

export function calculateThirdPlaceQualifierPoints(thirdPlace: ThirdPlaceQualifiers): number {
  return advPts(thirdPlace.predictedThirdQualifiers, thirdPlace.actualThirdQualifiers, 5)
}

export function calculateGoldenBootPoints(goldenBoot: GoldenBoot): number {
  const goals = goldenBoot.actualGoals[goldenBoot.predictedPlayer] ?? 0
  let pts = goals * 3
  if (goldenBoot.predictedPlayer === goldenBoot.goldenBootWinner) pts += 10
  return pts
}

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

function teamsIn(bracket: KnockoutMatch[], matchIds: string[]): string[] {
  const nums = new Set(matchIds.map(Number))
  return bracket
    .filter(m => nums.has(m.matchNum) && m.home && m.away)
    .flatMap(m => [m.home, m.away])
}

function bracketWinner(matchId: string, bracket: KnockoutMatch[], predictions: PredictionsState): string | undefined {
  const m = bracket.find(b => b.matchNum === Number(matchId))
  if (!m || !m.home || !m.away) return undefined
  const pred = predictions[matchId]
  if (!pred || isUnpredicted(pred)) return undefined
  if (pred.home! > pred.away!) return m.home
  if (pred.away! > pred.home!) return m.away
  if (pred.drawWinner === 'home') return m.home
  if (pred.drawWinner === 'away') return m.away
  return undefined
}

function roundComplete(matchIds: string[], results: PredictionsState): boolean {
  return matchIds.every(id => {
    const r = results[id]
    return r && !isUnpredicted(r)
  })
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

  const actualThirdQual = getQualifiedThirdPlaceTeams(results)
  const thirdPlaceQualPts = actualThirdQual
    ? advPts(getQualifiedThirdPlaceTeams(userPredictions) ?? [], actualThirdQual, 5)
    : 0

  const group = sumGroupPoints(userPredictions, results) + thirdPlaceQualPts
  const r32 = calculateRoundMatchPoints(R32_IDS, userPredictions, results, participating)
            + (roundComplete(R32_IDS, results) ? advPts(teamsIn(userBracket, R16_IDS), teamsIn(actualBracket, R16_IDS), KNOCKOUT_OLEH_POINTS.r32) : 0)
  const r16 = calculateRoundMatchPoints(R16_IDS, userPredictions, results, participating)
            + (roundComplete(R16_IDS, results) ? advPts(teamsIn(userBracket, QF_IDS), teamsIn(actualBracket, QF_IDS), KNOCKOUT_OLEH_POINTS.r16) : 0)
  const qf  = calculateRoundMatchPoints(QF_IDS, userPredictions, results, participating)
            + (roundComplete(QF_IDS, results) ? advPts(teamsIn(userBracket, SF_IDS), teamsIn(actualBracket, SF_IDS), KNOCKOUT_OLEH_POINTS.qf) : 0)
  const sf  = calculateRoundMatchPoints(SF_IDS, userPredictions, results, participating)
            + (roundComplete(SF_IDS, results) ? advPts(teamsIn(userBracket, FINAL_ID), teamsIn(actualBracket, FINAL_ID), KNOCKOUT_OLEH_POINTS.sf) : 0)
  const thirdActualWinner = bracketWinner('103', actualBracket, results)
  const third = calculateRoundMatchPoints(THIRD_ID, userPredictions, results, participating)
              + (thirdActualWinner !== undefined && bracketWinner('103', userBracket, userPredictions) === thirdActualWinner ? KNOCKOUT_OLEH_POINTS.thirdPlaceWinner : 0)
  const finalActualWinner = bracketWinner('104', actualBracket, results)
  const final_pts = calculateRoundMatchPoints(FINAL_ID, userPredictions, results, participating)
                  + (finalActualWinner !== undefined && bracketWinner('104', userBracket, userPredictions) === finalActualWinner ? KNOCKOUT_OLEH_POINTS.champion : 0)
  const goldenBootPts = goldenBoot ? calculateGoldenBootPoints(goldenBoot) : 0
  const total = group + r32 + r16 + qf + sf + third + final_pts + goldenBootPts
  return { group, r32, r16, qf, sf, third, final: final_pts, goldenBoot: goldenBootPts, total }
}

export function calculateUserPoints(
  userPredictions: PredictionsState,
  results: PredictionsState,
  thirdPlace?: ThirdPlaceQualifiers,
  knockoutOleh?: KnockoutOleh,
  goldenBoot?: GoldenBoot,
): number {
  return sumGroupPoints(userPredictions, results)
    + calculateKnockoutMatchPoints(userPredictions, results)
    + (knockoutOleh ? calculateKnockoutAdvancementPoints(knockoutOleh) : 0)
    + (thirdPlace   ? calculateThirdPlaceQualifierPoints(thirdPlace)   : 0)
    + (goldenBoot   ? calculateGoldenBootPoints(goldenBoot)            : 0)
}

function koMatchPoints(userMatches: KnockoutMatch[], resultMatches: KnockoutMatch[]): number {
  return userMatches.reduce((total, userMatch) => {
    const resultMatch = resultMatches.find(m => m.matchNum === userMatch.matchNum)
    if (!resultMatch || !userMatch.scores || !resultMatch.scores) return total
    if (isUnpredicted(resultMatch.scores)) return total
    const sameTeams =
      (userMatch.home === resultMatch.home && userMatch.away === resultMatch.away) ||
      (userMatch.home === resultMatch.away && userMatch.away === resultMatch.home)
    if (!sameTeams) return total
    return total + singleMatchPoints(String(userMatch.matchNum), userMatch.scores, resultMatch.scores)
  }, 0)
}

function roundTeams(matches: KnockoutMatch[]): string[] {
  return matches.flatMap(m => [m.home, m.away]).filter(Boolean) as string[]
}

function roundReady(matches: KnockoutMatch[]): boolean {
  return matches.length > 0 && matches.every(m => m.home && m.away)
}

export function computeUserPoints(user: User, results: TournamentResults): PointsBreakdown {
  let group = 0

  const allGroupIds = new Set([...Object.keys(user.groupMatches), ...Object.keys(user.groupTables)])

  // Group match points + top-2 advancement
  for (const groupId of allGroupIds) {
    const userMatches  = user.groupMatches[groupId]  ?? []
    const resultMatches = results.groupMatches[groupId] ?? []
    for (const userMatch of userMatches) {
      const resultMatch = resultMatches.find(m => m.id === userMatch.id)
      if (userMatch.scores && resultMatch?.scores && !isUnpredicted(resultMatch.scores)) {
        group += singleMatchPoints(userMatch.id, userMatch.scores, resultMatch.scores)
      }
    }
    const actualTable = results.groupTables[groupId]
    if (actualTable && actualTable.length >= 2) {
      const userTop2   = (user.groupTables[groupId] ?? []).slice(0, 2).map(s => s.team)
      const actualTop2 = actualTable.slice(0, 2).map(s => s.team)
      group += advPts(userTop2, actualTop2, 5)
    }
  }

  // Third-place qualification (5 pts each of 8 qualifiers)
  if (user.thirdPlaceQualification.resolved && results.thirdPlaceQualification.resolved) {
    const userQual   = user.thirdPlaceQualification.qualifiers.map(t => t.team)
    const actualQual = results.thirdPlaceQualification.qualifiers.map(t => t.team)
    group += advPts(userQual, actualQual, 5)
  }

  const ko = results.knockoutStages
  const uko = user.knockoutStages

  const r32 = koMatchPoints(uko.r32, ko.r32)
    + (roundReady(ko.r16) ? advPts(user.predictedR16Teams ?? roundTeams(uko.r16), roundTeams(ko.r16), KNOCKOUT_OLEH_POINTS.r32) : 0)

  const r16 = koMatchPoints(uko.r16, ko.r16)
    + (roundReady(ko.qf) ? advPts(user.predictedQFTeams ?? roundTeams(uko.qf), roundTeams(ko.qf), KNOCKOUT_OLEH_POINTS.r16) : 0)

  const qf = koMatchPoints(uko.qf, ko.qf)
    + (roundReady(ko.sf) ? advPts(user.predictedSFTeams ?? roundTeams(uko.sf), roundTeams(ko.sf), KNOCKOUT_OLEH_POINTS.qf) : 0)

  const sf = koMatchPoints(uko.sf, ko.sf)
    + (roundReady(ko.final) ? advPts(user.predictedFinalTeams ?? roundTeams(uko.final), roundTeams(ko.final), KNOCKOUT_OLEH_POINTS.sf) : 0)

  const third = koMatchPoints(uko.thirdPlace, ko.thirdPlace)
    + (results.thirdPlaceWinner && user.predictedThirdPlaceWinner === results.thirdPlaceWinner
      ? KNOCKOUT_OLEH_POINTS.thirdPlaceWinner : 0)

  const final_pts = koMatchPoints(uko.final, ko.final)
    + (results.champion && user.predictedChampion === results.champion
      ? KNOCKOUT_OLEH_POINTS.champion : 0)

  let goldenBoot = 0
  if (results.goldenBootWinner) {
    goldenBoot += (results.playerGoals?.[user.topGoalscorer] ?? 0) * 3
    if (user.topGoalscorer === results.goldenBootWinner) goldenBoot += 10
  }

  const total = group + r32 + r16 + qf + sf + third + final_pts + goldenBoot
  return { group, r32, r16, qf, sf, third, final: final_pts, goldenBoot, total }
}
