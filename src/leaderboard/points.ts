import { isUnpredicted, type MatchScores, type KnockoutMatch, type KnockoutStages, type TournamentResults } from '../shared/types'
import { isPairing, orientPrediction } from '../formView/knockout/koRounds'

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
  // A knockout draw whose advancer isn't settled yet (a live 1-1 before extra
  // time / penalties names a winner) carries no actual drawWinner. Score it on
  // the scoreline alone — exactly like a group draw — until the advancer is
  // known; otherwise the drawWinner a bettor attached to their predicted draw
  // could never match the still-empty actual advancer, zeroing even a spot-on
  // 1-1 call mid-match. The advancer resumes splitting tzelifa/pgiya/miss once
  // the result carries one.
  if (isDraw(actual) && actual.drawWinner == null) {
    if (isExactMatch({ home: predicted.home, away: predicted.away }, actual)) return 'tzelifa'
    return isDraw(predicted) ? 'pgiya' : 'miss'
  }
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
    const userMatch = userMatches.find(m => isPairing(m, resultMatch.home, resultMatch.away))
    if (!userMatch || !userMatch.scores || isUnpredicted(userMatch.scores)) return total
    const predicted = orientPrediction(userMatch, resultMatch)!
    return total + singleMatchPoints(String(resultMatch.matchNum), predicted, resultMatch.scores)
  }, 0)
}

function roundTeams(matches: KnockoutMatch[]): string[] {
  return matches.flatMap(m => [m.home, m.away]).filter(Boolean) as string[]
}

// The team that advanced out of a played knockout fixture — the higher score, or
// the penalty/ET winner on a level scoreline. Null if the match isn't decided.
export function advancingTeam(m: KnockoutMatch): string | null {
  if (!m.scores || isUnpredicted(m.scores) || !m.home || !m.away) return null
  const s = m.scores
  if (s.home! > s.away!) return m.home
  if (s.away! > s.home!) return m.away
  return s.drawWinner === 'away' ? m.away : s.drawWinner === 'home' ? m.home : null
}

// Advancement bonus this match's winner earns a bettor who foresaw them moving on:
// the round's OLEH points if the actual advancer is in the bettor's next-round set
// (or named as their third-place winner / champion). Unlike a group — whose
// standings can shift until the last match, so advancement is owned by the
// group-completing match — each KO fixture independently confirms exactly one
// advancer, so its points belong to *that* match, credited the moment it's played.
export function koAdvancementFor(user: User, match: KnockoutMatch): number {
  const advancer = advancingTeam(match)
  if (!advancer) return 0
  const n = match.matchNum
  const uko = user.knockoutStages
  if (n === 104) return user.predictedChampion === advancer ? OLEH_POINTS.champion : 0
  if (n === 103) return user.predictedThirdPlaceWinner === advancer ? OLEH_POINTS.thirdPlaceWinner : 0
  const { pts, predicted } =
    n <= 88  ? { pts: OLEH_POINTS.r32, predicted: user.predictedR16Teams   ?? roundTeams(uko.r16) }   :
    n <= 96  ? { pts: OLEH_POINTS.r16, predicted: user.predictedQFTeams    ?? roundTeams(uko.qf) }    :
    n <= 100 ? { pts: OLEH_POINTS.qf,  predicted: user.predictedSFTeams    ?? roundTeams(uko.sf) }    :
               { pts: OLEH_POINTS.sf,  predicted: user.predictedFinalTeams ?? roundTeams(uko.final) }
  return predicted.includes(advancer) ? pts : 0
}

function roundReady(matches: KnockoutMatch[]): boolean {
  return matches.length > 0 && matches.every(m => m.home && m.away)
}

// A group counts as complete once every team in the official table has played
// all its matches — the rule that gates place/advancement points.
export function isGroupComplete(table: { played: number }[]): boolean {
  return table.length >= 2 && table.every(s => s.played === table.length - 1)
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
    if (isGroupComplete(actualTable)) {
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

// A team that earned the bettor points in the group stage, with the context
// needed to name it: which group it sits in, and (for place hits) the exact
// table position the bettor nailed.
export interface GroupTeamHit {
  team: string
  group: string
  position?: number
}

// The team-level story behind a bettor's group-stage עולות/מיקומים points —
// which qualifiers they correctly tipped to advance (4 pts each) and which exact
// table positions they nailed (1 pt each). Mirrors computeGroupBreakdown's rules
// so advancement.length * OLEH_POINTS.group == advancementPoints and
// places.length * PLACE_POINT == placePoints.
export interface GroupTeamDetail {
  advancement: GroupTeamHit[]
  places: GroupTeamHit[]
}

export function computeGroupTeamDetail(user: User, results: TournamentResults): GroupTeamDetail {
  const actualR32Set = new Set<string>()
  const places: GroupTeamHit[] = []
  for (const groupId of Object.keys(results.groupTables)) {
    const actualTable = results.groupTables[groupId]
    if (isGroupComplete(actualTable)) {
      actualTable.slice(0, 2).forEach(s => actualR32Set.add(s.team))
      const userTable = user.groupTables[groupId] ?? []
      actualTable.forEach((s, i) => {
        if (userTable[i]?.team === s.team) places.push({ team: s.team, group: groupId, position: i + 1 })
      })
    }
  }
  if (results.thirdPlaceQualification.resolved) {
    results.thirdPlaceQualification.qualifiers.forEach(t => actualR32Set.add(t.team))
  }

  const predicted: GroupTeamHit[] = []
  const seen = new Set<string>()
  for (const groupId of Object.keys(user.groupTables)) {
    (user.groupTables[groupId] ?? []).slice(0, 2).forEach(s => {
      if (!seen.has(s.team)) { seen.add(s.team); predicted.push({ team: s.team, group: groupId }) }
    })
  }
  if (user.thirdPlaceQualification.resolved) {
    user.thirdPlaceQualification.qualifiers.forEach(t => {
      if (!seen.has(t.team)) { seen.add(t.team); predicted.push({ team: t.team, group: t.group }) }
    })
  }

  return { advancement: predicted.filter(p => actualR32Set.has(p.team)), places }
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

// The four advancing knockout rounds (r32→r16→qf→sf) share one breakdown shape:
// for each round we score its own matches and award advancement points for the
// teams the bettor predicted to reach the NEXT round. Adding/altering a round is
// a one-line table edit. `third` and `final` use different bonus rules (third-
// place-winner / champion) and stay as their own explicit calls below.
const ROUND_FLOW = [
  { key: 'r32', next: 'r16',   predicted: 'predictedR16Teams',   oleh: 'r32' },
  { key: 'r16', next: 'qf',    predicted: 'predictedQFTeams',    oleh: 'r16' },
  { key: 'qf',  next: 'sf',    predicted: 'predictedSFTeams',    oleh: 'qf'  },
  { key: 'sf',  next: 'final', predicted: 'predictedFinalTeams', oleh: 'sf'  },
] as const satisfies readonly {
  key: keyof KnockoutStages
  next: keyof KnockoutStages
  predicted: keyof User
  oleh: keyof typeof OLEH_POINTS
}[]

export function computeUserPoints(user: User, results: TournamentResults): PointsBreakdown {
  const ko  = results.knockoutStages
  const uko = user.knockoutStages

  const group     = computeGroupBreakdown(user, results)

  const rounds = {} as Record<(typeof ROUND_FLOW)[number]['key'], RoundBreakdown>
  for (const { key, next, predicted, oleh } of ROUND_FLOW) {
    rounds[key] = computeRoundBreakdown(
      uko[key],
      ko[key],
      (user[predicted] as string[] | undefined) ?? roundTeams(uko[next]),
      roundTeams(ko[next]),
      OLEH_POINTS[oleh],
      roundReady(ko[next]),
    )
  }
  const { r32, r16, qf, sf } = rounds

  const third     = computeThirdBreakdown(uko.thirdPlace, ko.thirdPlace, user.predictedThirdPlaceWinner, results.thirdPlaceWinner)
  const final     = computeFinalBreakdown(uko.final, ko.final, user.predictedChampion, results.champion)
  const goldenBoot = computeGoldenBootBreakdown(user, results)

  const total = group.total + r32.total + r16.total + qf.total + sf.total + third.total + final.total + goldenBoot.total
  return { group, r32, r16, qf, sf, third, final, goldenBoot, total }
}
