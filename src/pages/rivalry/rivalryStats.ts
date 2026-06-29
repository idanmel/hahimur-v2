import type { TournamentResults } from '../../shared/types'
import type { User } from '../../users'
import { TEAMS } from '../../shared/groups'
import { matchSortKey } from '../../shared/matchOrder'
import { singleMatchPoints, POINTS_PER_GOAL } from '../../leaderboard/points'
import { rankTrajectories, playedMatchesChrono, predictionFor, type PlayedMatch } from '../../leaderboard/leaderboardRows'
import {
  buildMatchDiff,
  matchTally,
  buildAgreement,
  buildScoreboard,
  eliminatedTeams,
  type MatchDiffRow,
  type Side,
} from '../forms/compareStats'
import { pickVerdict, pickQuips, type QuipCtx } from './rivalryQuips'

export type { Side }

type Decisive = Exclude<Side, 'tie'>

/** Current "hot hand": the most recent run of consecutive finished matches where
 *  the same player out-scored the other. Ties break the run. */
export interface Momentum {
  side: Decisive
  count: number
}

/** The widest the points gap between the two ever got, and after which played
 *  match it happened — context for how close (or not) things are right now. */
export interface PeakGap {
  gap: number
  matchday: number
}

/** Set only when the latest played match flipped who sits on top. */
export interface Upset {
  newTop: Decisive
  passed: Decisive
}

/** Head-to-head tally over the last few finished matches — "who's hot right now",
 *  distinct from the all-time record. Null until there are enough matches for
 *  "recent" to mean something different from the full history. */
export interface RecentForm {
  window: number
  a: number
  b: number
  tie: number
}

export interface RivalrySide {
  label: string
  total: number
  rank: number
  tzelifa: number
  pgiya: number
}

export interface BlowoutStat {
  matchHe: string
  winner: Exclude<Side, 'tie'>
  margin: number
}

export interface TopStep {
  /** 1-based index of the played group match this snapshot is taken after. */
  index: number
  top: Side
  aRank: number
  bRank: number
}

export interface RivalryStats {
  a: RivalrySide
  b: RivalrySide
  leader: Side
  gap: number
  totalPlayers: number
  bestRank: number
  worstRank: number
  /** Head-to-head over finished group matches (who out-scored whom per fixture). */
  h2h: { a: number; b: number; tie: number }
  agreement: { bothPredicted: number; identicalScore: number; identicalPct: number }
  aboveBelow: { leadChanges: number; topStreak: number; currentTop: Side }
  championSplit: { aChampion?: string; bChampion?: string; aChampionHe: string; bChampionHe: string; same: boolean | null }
  championStatus: { aOut: boolean; bOut: boolean }
  goldenBoot: { aPick: string; bPick: string; same: boolean; aGoals: number; bGoals: number }
  biggestBlowout: BlowoutStat | null
  momentum: Momentum | null
  peakGap: PeakGap | null
  upset: Upset | null
  recentForm: RecentForm | null
  timeline: TopStep[]
  playedCount: number
  verdict: string
  quips: string[]
}

const teamHe = (team?: string): string => (team ? TEAMS[team]?.he ?? team : '')

/** Who sat above whom after each played match, plus how many times that flipped
 *  and the current on-top streak. Built from the same rank trajectory the
 *  leaderboard chart uses, so it never contradicts the table. */
function buildAboveBelow(
  a: User,
  b: User,
  allUsers: User[],
  results: TournamentResults,
  fallbackTop: Side,
): { timeline: TopStep[]; leadChanges: number; topStreak: number; currentTop: Side } {
  const traj = rankTrajectories(allUsers, results)
  const aRanks = traj[a.label] ?? []
  const bRanks = traj[b.label] ?? []
  const steps = Math.min(aRanks.length, bRanks.length)

  const timeline: TopStep[] = []
  let leadChanges = 0
  let topStreak = 0
  let lastDecisive: Exclude<Side, 'tie'> | null = null

  for (let i = 0; i < steps; i++) {
    const aRank = aRanks[i]
    const bRank = bRanks[i]
    const top: Side = aRank < bRank ? 'a' : bRank < aRank ? 'b' : 'tie'
    timeline.push({ index: i + 1, top, aRank, bRank })

    if (top !== 'tie') {
      if (lastDecisive !== null && top !== lastDecisive) leadChanges++
      topStreak = lastDecisive === top ? topStreak + 1 : 1
      lastDecisive = top
    } else {
      topStreak = 0
    }
  }

  const currentTop: Side = timeline.length ? timeline[timeline.length - 1].top : fallbackTop
  return { timeline, leadChanges, topStreak, currentTop }
}

function nameFor(side: Side, aName: string, bName: string): string {
  return side === 'a' ? aName : side === 'b' ? bName : ''
}

const byChrono = (x: MatchDiffRow, y: MatchDiffRow) =>
  matchSortKey(x.matchDate, x.kickoffIST) - matchSortKey(y.matchDate, y.kickoffIST)

/** Longest current run of consecutive finished matches the same player won
 *  head-to-head. Returns null unless the run is at least 2 (real momentum). */
function buildMomentum(diff: MatchDiffRow[]): Momentum | null {
  const finished = diff.filter(r => r.finished).sort(byChrono)
  if (!finished.length) return null
  const latest = finished[finished.length - 1].winner
  if (!latest || latest === 'tie') return null
  let count = 0
  for (let i = finished.length - 1; i >= 0; i--) {
    if (finished[i].winner === latest) count++
    else break
  }
  return count >= 2 ? { side: latest, count } : null
}

/** H2H over the last `window` finished matches. Returns null until there are
 *  strictly more than `window` finished matches, so "recent form" always says
 *  something the all-time record doesn't already. */
function buildRecentForm(diff: MatchDiffRow[], window = 3): RecentForm | null {
  const finished = diff.filter(r => r.finished).sort(byChrono)
  if (finished.length <= window) return null
  let a = 0
  let b = 0
  let tie = 0
  for (const r of finished.slice(-window)) {
    if (r.winner === 'a') a++
    else if (r.winner === 'b') b++
    else tie++
  }
  return { window, a, b, tie }
}

/** Cumulative match + golden-boot points for one bettor after each played match
 *  (group AND knockout), matching the rank-trajectory basis so the two never
 *  contradict. KO predictions are resolved by oriented pairing via predictionFor. */
function pointSeries(user: User, results: TournamentResults, chrono: PlayedMatch[]): number[] {
  const goalsByMatch = results.playerMatchGoals?.[user.topGoalscorer]
  let cum = 0
  const out: number[] = []
  for (const played of chrono) {
    const id = played.kind === 'group' ? played.match.id : String(played.match.matchNum)
    const pred = predictionFor(user, played) ?? { home: null, away: null }
    cum += singleMatchPoints(id, pred, played.match.scores!)
    cum += (goalsByMatch?.[id] ?? 0) * POINTS_PER_GOAL
    out.push(cum)
  }
  return out
}

function buildPeakGap(a: User, b: User, results: TournamentResults): PeakGap | null {
  const chrono = playedMatchesChrono(results)
  if (!chrono.length) return null
  const aS = pointSeries(a, results, chrono)
  const bS = pointSeries(b, results, chrono)
  let peak: PeakGap = { gap: 0, matchday: 0 }
  for (let i = 0; i < aS.length; i++) {
    const g = Math.abs(aS[i] - bS[i])
    if (g > peak.gap) peak = { gap: g, matchday: i + 1 }
  }
  return peak.gap > 0 ? peak : null
}

/** Did the latest snapshot flip who's on top vs the snapshot before it? */
function buildUpset(timeline: TopStep[]): Upset | null {
  if (timeline.length < 2) return null
  const cur = timeline[timeline.length - 1].top
  const prev = timeline[timeline.length - 2].top
  if (cur === 'tie' || prev === 'tie' || cur === prev) return null
  return { newTop: cur, passed: prev }
}

function buildCtx(s: Omit<RivalryStats, 'verdict' | 'quips'>): QuipCtx {
  const leaderName = nameFor(s.leader, s.a.label, s.b.label) || s.a.label
  const trailerName = s.leader === 'b' ? s.a.label : s.b.label
  return {
    leader: s.leader,
    leaderName,
    trailerName,
    aName: s.a.label,
    bName: s.b.label,
    gap: s.gap,
    leaderRank: s.leader === 'b' ? s.b.rank : s.a.rank,
    trailerRank: s.leader === 'b' ? s.a.rank : s.b.rank,
    bestRank: s.bestRank,
    worstRank: s.worstRank,
    totalPlayers: s.totalPlayers,
    identicalPct: s.agreement.identicalPct,
    bothPredicted: s.agreement.bothPredicted,
    leadChanges: s.aboveBelow.leadChanges,
    topStreak: s.aboveBelow.topStreak,
    topName: nameFor(s.aboveBelow.currentTop, s.a.label, s.b.label),
    championSame: s.championSplit.same,
    aChampionHe: s.championSplit.aChampionHe,
    bChampionHe: s.championSplit.bChampionHe,
    aChampionOut: s.championStatus.aOut,
    bChampionOut: s.championStatus.bOut,
    goldenBootSame: s.goldenBoot.same,
    goldenBootPick: s.goldenBoot.aPick,
    aGoldenBootPick: s.goldenBoot.aPick,
    bGoldenBootPick: s.goldenBoot.bPick,
    aGoldenBootGoals: s.goldenBoot.aGoals,
    bGoldenBootGoals: s.goldenBoot.bGoals,
    blowoutWinnerName: s.biggestBlowout ? nameFor(s.biggestBlowout.winner, s.a.label, s.b.label) : '',
    blowoutMatchHe: s.biggestBlowout?.matchHe ?? '',
    blowoutMargin: s.biggestBlowout?.margin ?? 0,
    aTzelifa: s.a.tzelifa,
    bTzelifa: s.b.tzelifa,
    playedCount: s.playedCount,
    // Rotation seed: changes every matchday so the copy stays fresh on revisits.
    seed: s.playedCount,
  }
}

export function buildRivalry(
  userA: User,
  userB: User,
  allUsers: User[],
  results: TournamentResults,
  // Optional override for the copy-selection seed. The banks and every number are
  // always derived from the real `results`; the seed only varies *which phrasing*
  // is shown. Callers pass a per-visit random value for variety; default keeps the
  // matchday-stable behaviour (fresh after each played match) for tests/teaser.
  seedOverride?: number,
): RivalryStats {
  const board = buildScoreboard(userA, userB, allUsers, results)
  const diff = buildMatchDiff(userA, userB, results)
  const h2h = matchTally(diff)
  const agree = buildAgreement(diff)

  const identicalPct = agree.bothPredicted
    ? Math.round((agree.identicalScore / agree.bothPredicted) * 100)
    : 0

  let aTzelifa = 0
  let aPgiya = 0
  let bTzelifa = 0
  let bPgiya = 0
  let biggestBlowout: BlowoutStat | null = null
  let playedCount = 0
  for (const row of diff) {
    if (!row.finished) continue
    playedCount++
    if (row.aOutcome === 'tzelifa') aTzelifa++
    else if (row.aOutcome === 'pgiya') aPgiya++
    if (row.bOutcome === 'tzelifa') bTzelifa++
    else if (row.bOutcome === 'pgiya') bPgiya++
    if (row.winner === 'tie' || row.winner == null) continue
    const margin = Math.abs((row.aPoints ?? 0) - (row.bPoints ?? 0))
    // Only count a single match as a "blowout" when the swing is real (one nailed
    // it while the other whiffed). Below that it's noise, not a story.
    if (margin >= 4 && (biggestBlowout === null || margin > biggestBlowout.margin)) {
      biggestBlowout = {
        matchHe: `${teamHe(row.homeTeam)} נגד ${teamHe(row.awayTeam)}`,
        winner: row.winner,
        margin,
      }
    }
  }

  const aboveBelow = buildAboveBelow(userA, userB, allUsers, results, board.leader)

  const championSplit = {
    aChampion: userA.predictedChampion,
    bChampion: userB.predictedChampion,
    aChampionHe: teamHe(userA.predictedChampion),
    bChampionHe: teamHe(userB.predictedChampion),
    same:
      userA.predictedChampion && userB.predictedChampion
        ? userA.predictedChampion === userB.predictedChampion
        : null,
  }

  const out = eliminatedTeams(results)
  const championStatus = {
    aOut: !!userA.predictedChampion && out.has(userA.predictedChampion),
    bOut: !!userB.predictedChampion && out.has(userB.predictedChampion),
  }

  const goldenBoot = {
    aPick: userA.topGoalscorer,
    bPick: userB.topGoalscorer,
    same: !!userA.topGoalscorer && userA.topGoalscorer === userB.topGoalscorer,
    aGoals: results.playerGoals?.[userA.topGoalscorer] ?? 0,
    bGoals: results.playerGoals?.[userB.topGoalscorer] ?? 0,
  }

  const momentum = buildMomentum(diff)
  const peakGap = buildPeakGap(userA, userB, results)
  const upset = buildUpset(aboveBelow.timeline)
  const recentForm = buildRecentForm(diff)

  const core: Omit<RivalryStats, 'verdict' | 'quips'> = {
    a: { label: userA.label, total: board.aTotal, rank: board.aRank, tzelifa: aTzelifa, pgiya: aPgiya },
    b: { label: userB.label, total: board.bTotal, rank: board.bRank, tzelifa: bTzelifa, pgiya: bPgiya },
    leader: board.leader,
    gap: board.gap,
    totalPlayers: allUsers.length,
    bestRank: Math.min(board.aRank, board.bRank),
    worstRank: Math.max(board.aRank, board.bRank),
    h2h,
    agreement: { bothPredicted: agree.bothPredicted, identicalScore: agree.identicalScore, identicalPct },
    aboveBelow: { leadChanges: aboveBelow.leadChanges, topStreak: aboveBelow.topStreak, currentTop: aboveBelow.currentTop },
    championSplit,
    championStatus,
    goldenBoot,
    biggestBlowout,
    momentum,
    peakGap,
    upset,
    recentForm,
    timeline: aboveBelow.timeline,
    playedCount,
  }

  const ctx = buildCtx(core)
  if (seedOverride !== undefined) ctx.seed = seedOverride
  return { ...core, verdict: pickVerdict(ctx), quips: pickQuips(ctx) }
}

/** A short, shareable one-liner for WhatsApp. Kept deliberately tiny. */
export function buildShareText(stats: RivalryStats, url: string): string {
  if (stats.leader === 'tie') {
    return `⚔️ קרב האל[רד]דים: תיקו ${stats.a.total}-${stats.b.total}! ${url}`
  }
  const lead = stats.leader === 'a' ? stats.a : stats.b
  const trail = stats.leader === 'a' ? stats.b : stats.a
  return `⚔️ קרב האל[רד]דים: ${firstWord(lead.label)} מוביל על ${firstWord(trail.label)} ב-${stats.gap}. ${url}`
}

const firstWord = (label: string) => label.split(' ')[0]

/** Resolve the two rivals from the registry by exact label. Returns null if
 *  either is missing so callers can hide the feature instead of crashing. */
export const ELRAD_LABEL = 'אלרד גומא'
export const ELDAD_LABEL = 'אלדד לוי'

export function findRivals(users: User[]): { elrad: User; eldad: User } | null {
  const elrad = users.find(u => u.label === ELRAD_LABEL)
  const eldad = users.find(u => u.label === ELDAD_LABEL)
  return elrad && eldad ? { elrad, eldad } : null
}
