import { isUnpredicted, type MatchScores, type KnockoutMatch, type TournamentResults } from '../shared/types'

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

export type MatchOutcome = 'tzelifa' | 'pgiya' | 'miss'

export const OUTCOME_LABEL: Record<MatchOutcome, string> = {
  tzelifa: 'צליפה',
  pgiya: 'פגיעה',
  miss: 'פספוס',
}

export function singleMatchOutcome(predicted: MatchScores, actual: MatchScores): MatchOutcome {
  if (isUnpredicted(predicted) || isUnpredicted(actual)) return 'miss'
  if (isExactMatch(predicted, actual)) return 'tzelifa'
  if (isDraw(predicted) !== isDraw(actual)) return 'miss'
  if (winner(predicted) === winner(actual)) return 'pgiya'
  return 'miss'
}

export function singleMatchPoints(matchId: string, predicted: MatchScores, actual: MatchScores): number {
  const outcome = singleMatchOutcome(predicted, actual)
  if (outcome === 'miss') return 0
  const { pagiya, tzelifa } = ROUND_POINTS[roundOf(matchId)]
  return outcome === 'tzelifa' ? tzelifa : pagiya
}

function advPts(predicted: string[], actual: string[], pts: number): number {
  const actualSet = new Set(actual)
  return predicted.reduce((sum, t) => sum + (actualSet.has(t) ? pts : 0), 0)
}

export const OLEH_POINTS: Record<'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'thirdPlaceWinner' | 'champion', number> = {
  group: 4, r32: 7, r16: 8, qf: 12, sf: 16, thirdPlaceWinner: 20, champion: 25,
}

export const POINTS_PER_GOAL = 3

export const PLACE_POINT = 1

export interface GroupBreakdown {
  matchPoints: number
  advancementPoints: number
  placePoints: number
  total: number
}

export interface RoundBreakdown {
  matchPoints: number
  advancementPoints: number
  total: number
}

export interface ThirdBreakdown {
  matchPoints: number
  thirdPlaceWinner: number
  total: number
}

export interface FinalBreakdown {
  matchPoints: number
  champion: number
  total: number
}

export interface GoldenBootBreakdown {
  goalsPoints: number
  winnerBonus: number
  total: number
}

export interface PointsBreakdown {
  group: GroupBreakdown
  r32: RoundBreakdown
  r16: RoundBreakdown
  qf: RoundBreakdown
  sf: RoundBreakdown
  third: ThirdBreakdown
  final: FinalBreakdown
  goldenBoot: GoldenBootBreakdown
  total: number
}

function koMatchPoints(userMatches: KnockoutMatch[], resultMatches: KnockoutMatch[]): number {
  return resultMatches.reduce((total, resultMatch) => {
    if (!resultMatch.scores || isUnpredicted(resultMatch.scores)) return total
    if (!resultMatch.home || !resultMatch.away) return total
    const userMatch = userMatches.find(m =>
      m.home && m.away &&
      ((m.home === resultMatch.home && m.away === resultMatch.away) ||
       (m.home === resultMatch.away && m.away === resultMatch.home))
    )
    if (!userMatch || !userMatch.scores || isUnpredicted(userMatch.scores)) return total
    const flipped = userMatch.home === resultMatch.away
    const predicted: MatchScores = flipped
      ? { home: userMatch.scores.away, away: userMatch.scores.home, drawWinner: userMatch.scores.drawWinner === 'home' ? 'away' : userMatch.scores.drawWinner === 'away' ? 'home' : undefined }
      : userMatch.scores
    return total + singleMatchPoints(String(resultMatch.matchNum), predicted, resultMatch.scores)
  }, 0)
}

function roundTeams(matches: KnockoutMatch[]): string[] {
  return matches.flatMap(m => [m.home, m.away]).filter(Boolean) as string[]
}

function roundReady(matches: KnockoutMatch[]): boolean {
  return matches.length > 0 && matches.every(m => m.home && m.away)
}

export function computeGroupBreakdown(user: User, results: TournamentResults): GroupBreakdown {
  let matchPoints = 0

  const userR32Set = new Set<string>()
  for (const groupId of Object.keys(user.groupTables)) {
    (user.groupTables[groupId] ?? []).slice(0, 2).forEach(s => userR32Set.add(s.team))
  }
  if (user.thirdPlaceQualification.resolved) {
    user.thirdPlaceQualification.qualifiers.forEach(t => userR32Set.add(t.team))
  }

  const allGroupIds = new Set([...Object.keys(user.groupMatches), ...Object.keys(user.groupTables)])
  for (const groupId of allGroupIds) {
    const userMatches   = user.groupMatches[groupId]  ?? []
    const resultMatches = results.groupMatches[groupId] ?? []
    for (const userMatch of userMatches) {
      const resultMatch = resultMatches.find(m => m.id === userMatch.id)
      if (userMatch.scores && resultMatch?.scores && !isUnpredicted(resultMatch.scores)) {
        matchPoints += singleMatchPoints(userMatch.id, userMatch.scores, resultMatch.scores)
      }
    }
  }

  const actualR32Set = new Set<string>()
  let placePoints = 0
  for (const groupId of Object.keys(results.groupTables)) {
    const actualTable = results.groupTables[groupId]
    const groupComplete = actualTable.length >= 2 && actualTable.every(s => s.played === actualTable.length - 1)
    if (groupComplete) {
      actualTable.slice(0, 2).forEach(s => actualR32Set.add(s.team))
      const userTable = user.groupTables[groupId] ?? []
      actualTable.forEach((s, i) => {
        if (userTable[i]?.team === s.team) placePoints += PLACE_POINT
      })
    }
  }
  if (results.thirdPlaceQualification.resolved) {
    results.thirdPlaceQualification.qualifiers.forEach(t => actualR32Set.add(t.team))
  }

  let advancementPoints = 0
  for (const team of userR32Set) {
    if (actualR32Set.has(team)) advancementPoints += OLEH_POINTS.group
  }

  return { matchPoints, advancementPoints, placePoints, total: matchPoints + advancementPoints + placePoints }
}

export function computeRoundBreakdown(
  userMatches: KnockoutMatch[],
  resultMatches: KnockoutMatch[],
  predictedAdvancers: string[],
  actualAdvancers: string[],
  advancementPts: number,
  advancersReady: boolean,
): RoundBreakdown {
  const matchPoints = koMatchPoints(userMatches, resultMatches)
  const advancementPoints = advancersReady ? advPts(predictedAdvancers, actualAdvancers, advancementPts) : 0
  return { matchPoints, advancementPoints, total: matchPoints + advancementPoints }
}

export function computeThirdBreakdown(
  userMatches: KnockoutMatch[],
  resultMatches: KnockoutMatch[],
  predictedWinner: string | undefined,
  actualWinner: string | undefined,
): ThirdBreakdown {
  const matchPoints = koMatchPoints(userMatches, resultMatches)
  const thirdPlaceWinner = actualWinner && predictedWinner === actualWinner ? OLEH_POINTS.thirdPlaceWinner : 0
  return { matchPoints, thirdPlaceWinner, total: matchPoints + thirdPlaceWinner }
}

export function computeFinalBreakdown(
  userMatches: KnockoutMatch[],
  resultMatches: KnockoutMatch[],
  predictedChampion: string | undefined,
  actualChampion: string | undefined,
): FinalBreakdown {
  const matchPoints = koMatchPoints(userMatches, resultMatches)
  const champion = actualChampion && predictedChampion === actualChampion ? OLEH_POINTS.champion : 0
  return { matchPoints, champion, total: matchPoints + champion }
}

export function computeGoldenBootBreakdown(user: User, results: TournamentResults): GoldenBootBreakdown {
  const goalsPoints = (results.playerGoals?.[user.topGoalscorer] ?? 0) * POINTS_PER_GOAL
  if (!results.goldenBootWinner) return { goalsPoints, winnerBonus: 0, total: goalsPoints }
  const winners = Array.isArray(results.goldenBootWinner) ? results.goldenBootWinner : [results.goldenBootWinner]
  const winnerBonus = winners.includes(user.topGoalscorer) ? 10 : 0
  return { goalsPoints, winnerBonus, total: goalsPoints + winnerBonus }
}

export function computeUserPoints(user: User, results: TournamentResults): PointsBreakdown {
  const ko  = results.knockoutStages
  const uko = user.knockoutStages

  const group     = computeGroupBreakdown(user, results)
  const r32       = computeRoundBreakdown(uko.r32, ko.r32, user.predictedR16Teams ?? roundTeams(uko.r16), roundTeams(ko.r16), OLEH_POINTS.r32, roundReady(ko.r16))
  const r16       = computeRoundBreakdown(uko.r16, ko.r16, user.predictedQFTeams ?? roundTeams(uko.qf), roundTeams(ko.qf), OLEH_POINTS.r16, roundReady(ko.qf))
  const qf        = computeRoundBreakdown(uko.qf, ko.qf, user.predictedSFTeams ?? roundTeams(uko.sf), roundTeams(ko.sf), OLEH_POINTS.qf, roundReady(ko.sf))
  const sf        = computeRoundBreakdown(uko.sf, ko.sf, user.predictedFinalTeams ?? roundTeams(uko.final), roundTeams(ko.final), OLEH_POINTS.sf, roundReady(ko.final))
  const third     = computeThirdBreakdown(uko.thirdPlace, ko.thirdPlace, user.predictedThirdPlaceWinner, results.thirdPlaceWinner)
  const final     = computeFinalBreakdown(uko.final, ko.final, user.predictedChampion, results.champion)
  const goldenBoot = computeGoldenBootBreakdown(user, results)

  const total = group.total + r32.total + r16.total + qf.total + sf.total + third.total + final.total + goldenBoot.total
  return { group, r32, r16, qf, sf, third, final, goldenBoot, total }
}
