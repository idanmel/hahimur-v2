import { GROUPS, TEAMS } from '../../shared/groups'
import { isUnpredicted, type KnockoutMatch, type MatchScores, type Standing, type TournamentResults } from '../../shared/types'
import { byOverallGD } from '../../shared/standings'
import {
  singleMatchOutcome,
  singleMatchPoints,
  computeUserPoints,
  isGroupComplete,
  type MatchOutcome,
  type PointsBreakdown,
} from '../../leaderboard/points'
import { buildLeaderboardRows } from '../../leaderboard/leaderboardRows'
import { competitionRanks } from '../../leaderboard/rank'
import type { User } from '../../users'

const EMPTY: MatchScores = { home: null, away: null }

export type Side = 'a' | 'b' | 'tie'

function predFor(user: User, id: string): MatchScores {
  return user.predictions[id] ?? EMPTY
}

function sameScore(a: MatchScores, b: MatchScores): boolean {
  return a.home === b.home && a.away === b.away && (a.drawWinner ?? null) === (b.drawWinner ?? null)
}

function predictedWinner(s: MatchScores): 'home' | 'away' | 'draw' | null {
  if (isUnpredicted(s)) return null
  if (s.home! > s.away!) return 'home'
  if (s.away! > s.home!) return 'away'
  return 'draw'
}

function actualById(results: TournamentResults): Record<string, MatchScores> {
  const out: Record<string, MatchScores> = {}
  for (const matches of Object.values(results.groupMatches)) {
    for (const m of matches) if (m.scores) out[m.id] = m.scores
  }
  return out
}

export interface MatchDiffRow {
  id: string
  groupHe: string
  homeTeam: string
  awayTeam: string
  matchDate?: string
  kickoffIST?: string
  a: MatchScores
  b: MatchScores
  differ: boolean
  bothPredicted: boolean
  finished: boolean
  actual?: MatchScores
  aOutcome?: MatchOutcome
  bOutcome?: MatchOutcome
  aPoints?: number
  bPoints?: number
  winner?: Side
  // Knockout-only: rows live in player A's orientation. Set on knockout rows.
  stageHe?: string
  advancesHe?: string
  sameAdvance?: boolean
}

/** One row per group fixture (same fixtures for everyone), with both players'
 *  predicted scores side-by-side. For finished matches, also the outcome and
 *  points each scored, plus who "won" that match head-to-head. */
export function buildMatchDiff(userA: User, userB: User, results: TournamentResults): MatchDiffRow[] {
  const actuals = actualById(results)
  const rows: MatchDiffRow[] = []
  for (const group of Object.values(GROUPS)) {
    for (const match of group.matches) {
      const a = predFor(userA, match.id)
      const b = predFor(userB, match.id)
      const actual = actuals[match.id]
      const finished = !!actual && !isUnpredicted(actual)
      const row: MatchDiffRow = {
        id: match.id,
        groupHe: group.he,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        matchDate: match.matchDate,
        kickoffIST: match.kickoffIST,
        a,
        b,
        differ: !sameScore(a, b),
        bothPredicted: !isUnpredicted(a) && !isUnpredicted(b),
        finished,
      }
      if (finished) {
        row.actual = actual
        row.aOutcome = singleMatchOutcome(a, actual)
        row.bOutcome = singleMatchOutcome(b, actual)
        row.aPoints = singleMatchPoints(match.id, a, actual)
        row.bPoints = singleMatchPoints(match.id, b, actual)
        row.winner = row.aPoints! > row.bPoints! ? 'a' : row.bPoints! > row.aPoints! ? 'b' : 'tie'
      }
      rows.push(row)
    }
  }
  return rows
}

/** Head-to-head record across finished matches. */
export function matchTally(rows: MatchDiffRow[]): { a: number; b: number; tie: number } {
  return rows.reduce(
    (acc, r) => {
      if (!r.finished) return acc
      if (r.winner === 'a') acc.a++
      else if (r.winner === 'b') acc.b++
      else acc.tie++
      return acc
    },
    { a: 0, b: 0, tie: 0 },
  )
}

export interface AgreementStats {
  bothPredicted: number
  identicalScore: number
  sameOutcome: number
}

/** How often the two players agreed, over matches both of them predicted. */
export function buildAgreement(rows: MatchDiffRow[]): AgreementStats {
  let bothPredicted = 0
  let identicalScore = 0
  let sameOutcome = 0
  for (const r of rows) {
    if (!r.bothPredicted) continue
    bothPredicted++
    if (!r.differ) identicalScore++
    if (predictedWinner(r.a) === predictedWinner(r.b)) sameOutcome++
  }
  return { bothPredicted, identicalScore, sameOutcome }
}

const KO_STAGES: [keyof TournamentResults['knockoutStages'], string][] = [
  ['r32', 'שלב ה-32'],
  ['r16', 'שמינית גמר'],
  ['qf', 'רבע גמר'],
  ['sf', 'חצי גמר'],
  ['thirdPlace', 'מקום שלישי'],
  ['final', 'גמר'],
]

/** Winner (advancing team) of a predicted knockout match, by goals then the
 *  penalty winner (drawWinner). Null when the score isn't filled in. */
function koWinnerTeam(m: KnockoutMatch): string | null {
  if (!m.scores) return null
  const { home, away, drawWinner } = m.scores
  if (home == null || away == null) return null
  if (home > away) return m.home
  if (away > home) return m.away
  if (drawWinner === 'home') return m.home
  if (drawWinner === 'away') return m.away
  return null
}

function sameMatchup(a: KnockoutMatch, b: KnockoutMatch): boolean {
  return (a.home === b.home && a.away === b.away) || (a.home === b.away && a.away === b.home)
}

function goalsFor(m: KnockoutMatch, team: string): number | null {
  if (!m.scores) return null
  if (team === m.home) return m.scores.home
  if (team === m.away) return m.scores.away
  return null
}

/** Knockout comparison rows, but only for slots where BOTH players predicted the
 *  exact same matchup (same two teams) — the only case where comparing the result
 *  is meaningful, since each player's bracket is built from their own group picks.
 *  Rows are emitted in player A's orientation. */
export function buildKnockoutDiff(userA: User, userB: User): MatchDiffRow[] {
  const rows: MatchDiffRow[] = []
  for (const [stage, label] of KO_STAGES) {
    const aByNum = new Map(userA.knockoutStages[stage].map(m => [m.matchNum, m]))
    for (const bM of userB.knockoutStages[stage]) {
      const aM = aByNum.get(bM.matchNum)
      if (!aM || !sameMatchup(aM, bM)) continue
      const aWinner = koWinnerTeam(aM)
      const bWinner = koWinnerTeam(bM)
      if (aWinner == null || bWinner == null) continue
      const sameResult =
        goalsFor(aM, aM.home) === goalsFor(bM, aM.home) &&
        goalsFor(aM, aM.away) === goalsFor(bM, aM.away)
      const identical = sameResult && aWinner === bWinner
      const sameAdvance = aWinner === bWinner
      rows.push({
        id: `KO${bM.matchNum}`,
        groupHe: '',
        stageHe: label,
        homeTeam: aM.home,
        awayTeam: aM.away,
        matchDate: aM.matchDate,
        kickoffIST: aM.kickoffIST,
        a: aM.scores!,
        b: bM.scores!,
        differ: !identical,
        bothPredicted: true,
        finished: false,
        sameAdvance,
        advancesHe: TEAMS[aWinner]?.he ?? aWinner,
      })
    }
  }
  return rows
}

export interface AdvanceAgreementRow {
  label: string
  shared: number
  total: number
}

export interface AdvanceAgreement {
  rows: AdvanceAgreementRow[]
  championShared: boolean | null
}

/** How many teams the two players both send to each knockout stage. */
export function buildAdvancementAgreement(userA: User, userB: User): AdvanceAgreement {
  const shared = (a?: string[], b?: string[]): number => {
    const setB = new Set(b ?? [])
    return (a ?? []).filter(t => setB.has(t)).length
  }
  const rows: AdvanceAgreementRow[] = [
    { label: 'שמינית גמר', shared: shared(userA.predictedR16Teams, userB.predictedR16Teams), total: 16 },
    { label: 'רבע גמר', shared: shared(userA.predictedQFTeams, userB.predictedQFTeams), total: 8 },
    { label: 'חצי גמר', shared: shared(userA.predictedSFTeams, userB.predictedSFTeams), total: 4 },
    { label: 'גמר', shared: shared(userA.predictedFinalTeams, userB.predictedFinalTeams), total: 2 },
  ]
  const championShared =
    userA.predictedChampion && userB.predictedChampion
      ? userA.predictedChampion === userB.predictedChampion
      : null
  return { rows, championShared }
}

export interface Scoreboard {
  aTotal: number
  bTotal: number
  aRank: number
  bRank: number
  leader: Side
  gap: number
}

export function buildScoreboard(
  userA: User,
  userB: User,
  allUsers: User[],
  results: TournamentResults,
): Scoreboard {
  const rows = buildLeaderboardRows(allUsers, results)
  const ranks = competitionRanks(rows, r => r.total)
  const rankByLabel: Record<string, number> = {}
  const totalByLabel: Record<string, number> = {}
  rows.forEach((r, i) => {
    rankByLabel[r.label] = ranks[i]
    totalByLabel[r.label] = r.total
  })
  const aTotal = totalByLabel[userA.label] ?? computeUserPoints(userA, results).total
  const bTotal = totalByLabel[userB.label] ?? computeUserPoints(userB, results).total
  return {
    aTotal,
    bTotal,
    aRank: rankByLabel[userA.label] ?? 0,
    bRank: rankByLabel[userB.label] ?? 0,
    leader: aTotal > bTotal ? 'a' : bTotal > aTotal ? 'b' : 'tie',
    gap: Math.abs(aTotal - bTotal),
  }
}

export interface BreakdownRow {
  label: string
  a: number
  b: number
  leader: Side
}

const STAGES: [Exclude<keyof PointsBreakdown, 'total'>, string][] = [
  ['group', 'שלב הבתים'],
  ['r32', 'שלב ה-32'],
  ['r16', 'שמינית גמר'],
  ['qf', 'רבע גמר'],
  ['sf', 'חצי גמר'],
  ['third', 'מקום שלישי'],
  ['final', 'גמר'],
  ['goldenBoot', 'מלך השערים'],
]

export interface GroupStandingSlot {
  position: number
  aTeam?: string
  bTeam?: string
  agree: boolean
  actualTeam?: string
  aCorrect?: boolean
  bCorrect?: boolean
}

export interface GroupStandingDiff {
  group: string
  groupHe: string
  finished: boolean
  slots: GroupStandingSlot[]
  aPlacePoints: number
  bPlacePoints: number
}

/** Both players' predicted group orderings side-by-side. Flags slots where they
 *  agree and, once a group is decided, who placed each team correctly. */
export function buildGroupStandingsDiff(userA: User, userB: User, results: TournamentResults): GroupStandingDiff[] {
  const out: GroupStandingDiff[] = []
  for (const [letter, group] of Object.entries(GROUPS)) {
    const aTable = userA.groupTables[letter] ?? []
    const bTable = userB.groupTables[letter] ?? []
    if (aTable.length === 0 && bTable.length === 0) continue
    const actualTable = results.groupTables[letter] ?? []
    const finished = isGroupComplete(actualTable)
    const positions = Math.max(aTable.length, bTable.length, finished ? actualTable.length : 0)
    const slots: GroupStandingSlot[] = []
    let aPlacePoints = 0
    let bPlacePoints = 0
    for (let i = 0; i < positions; i++) {
      const aTeam = aTable[i]?.team
      const bTeam = bTable[i]?.team
      const actualTeam = finished ? actualTable[i]?.team : undefined
      const aCorrect = finished ? aTeam != null && aTeam === actualTeam : undefined
      const bCorrect = finished ? bTeam != null && bTeam === actualTeam : undefined
      if (aCorrect) aPlacePoints++
      if (bCorrect) bPlacePoints++
      slots.push({
        position: i + 1,
        aTeam,
        bTeam,
        agree: aTeam != null && aTeam === bTeam,
        actualTeam,
        aCorrect,
        bCorrect,
      })
    }
    out.push({ group: letter, groupHe: group.he, finished, slots, aPlacePoints, bPlacePoints })
  }
  return out
}

/** Winner of a resolved knockout match (penalties via drawWinner), else null. */
function knockoutWinner(m: KnockoutMatch): string | null {
  if (!m.resolved || !m.scores) return null
  const { home, away, drawWinner } = m.scores
  if (home == null || away == null) return null
  if (home > away) return m.home
  if (away > home) return m.away
  if (drawWinner === 'home') return m.home
  if (drawWinner === 'away') return m.away
  return null
}

/** Teams already mathematically out during the group stage: a team is certainly
 *  eliminated once at least three other teams in its group have more current
 *  points than the team's best possible final tally — i.e. it is locked into last
 *  place, which can never qualify (only the top two plus best thirds advance).
 *  Deliberately conservative: it never flags a team that still has any path
 *  through, so there are no false eliminations. */
function groupStageEliminated(results: TournamentResults): Set<string> {
  const out = new Set<string>()
  for (const standings of Object.values(results.groupTables)) {
    if (standings.length < 4) continue
    const remainingGames = standings.length - 1
    for (const team of standings) {
      const maxPoints = team.points + Math.max(0, remainingGames - team.played) * 3
      const lockedAbove = standings.filter(o => o.team !== team.team && o.points > maxPoints).length
      if (lockedAbove >= 3) out.add(team.team)
    }
  }
  return out
}

/** Teams knocked out by an actual on-pitch result: mathematically eliminated in
 *  the group stage, or the loser of a resolved knockout match. Unlike
 *  {@link eliminatedTeams} this does NOT sweep in teams that simply never reached
 *  the real bracket — it only counts teams that demonstrably lost their way out. */
export function knockedOutTeams(results: TournamentResults): Set<string> {
  const s = results.knockoutStages
  const all = [...s.r32, ...s.r16, ...s.qf, ...s.sf, ...s.thirdPlace, ...s.final]
  const out = groupStageEliminated(results)
  for (const m of all) {
    const winner = knockoutWinner(m)
    if (winner) out.add(winner === m.home ? m.away : m.home)
  }
  return out
}

// World Cup 2026: the eight best third-placed teams join the 24 group
// winners/runners-up in the round of 32.
const BEST_THIRDS_COUNT = 8

/** Whether finished-group third `x` is guaranteed to outrank finished-group third
 *  `t` in the best-thirds table — the official order is points, then overall goal
 *  difference, then goals for (see {@link sortThirdPlaceTeams}/{@link byOverallGD}).
 *  Both teams' groups are done, so this comparison can never flip; a dead-even tie
 *  (identical on all three) is NOT counted as "above", since the real cut leaves
 *  such a tie unresolved rather than ordering it. */
function thirdRanksAbove(x: Standing, t: Standing): boolean {
  if (x.points !== t.points) return x.points > t.points
  return byOverallGD(x, t) < 0
}

/** Teams that are out of the tournament, computed from the real standings rather
 *  than from bracket slots. The official bracket can't be trusted for this: in
 *  reality many R32 slots stay as descriptors ("סגנית א", "שלישית א/ב/ג") long
 *  after the teams that fill them have safely qualified, so a "not named in the
 *  bracket ⇒ out" sweep wrongly buries live teams. Instead, a team is out when:
 *   - it lost a resolved knockout match, or
 *   - it's mathematically locked out mid-group, or
 *   - its group is finished and it placed 4th or lower, or
 *   - it placed 3rd and can no longer reach the best-thirds cut — either the cut
 *     is resolved and it missed it, or at least eight third-placed teams from
 *     other finished groups are already locked in ahead of it on points.
 *  A 3rd-placed team that still has a path to the best-thirds stays in — the
 *  function never reports a false elimination. */
export function eliminatedTeams(results: TournamentResults): Set<string> {
  const out = knockedOutTeams(results)

  const tpq = results.thirdPlaceQualification
  const thirdsResolved = tpq.resolved
  const qualifiedThirds = new Set(thirdsResolved ? tpq.qualifiers.map(t => t.team) : [])

  // Third-placed teams of already-finished groups. While the best-thirds cut is
  // still open, these are the only rivals guaranteed to be in the race for a
  // third-place berth, and their full standings are fixed so the ordering between
  // any two of them can never change.
  const settledThirds: Standing[] = []
  for (const standings of Object.values(results.groupTables)) {
    if (isGroupComplete(standings) && standings[2]) settledThirds.push(standings[2])
  }

  for (const standings of Object.values(results.groupTables)) {
    if (!isGroupComplete(standings)) continue
    standings.forEach((s, idx) => {
      if (idx < 2) return // top two advance directly
      if (idx === 2) {
        if (thirdsResolved) {
          if (!qualifiedThirds.has(s.team)) out.add(s.team)
          return
        }
        // Open cut: out only if eight other settled thirds already outrank it by
        // the official tiebreak (so it is ninth at best, and only eight berths
        // exist). Teams from unfinished groups can only pile on more rivals, never
        // rescue it, so this is a guaranteed elimination — no false positives.
        const lockedAhead = settledThirds.filter(o => o.team !== s.team && thirdRanksAbove(o, s)).length
        if (lockedAhead >= BEST_THIRDS_COUNT) out.add(s.team)
        return
      }
      out.add(s.team) // fourth and below
    })
  }
  return out
}

/** Per-stage points side-by-side, so you can see where the gap comes from. */
export function buildBreakdownRows(userA: User, userB: User, results: TournamentResults): BreakdownRow[] {
  const A = computeUserPoints(userA, results)
  const B = computeUserPoints(userB, results)
  return STAGES.map(([key, label]) => {
    const a = A[key].total
    const b = B[key].total
    return { label, a, b, leader: a > b ? 'a' : b > a ? 'b' : 'tie' }
  })
}
