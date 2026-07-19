/**
 * Core Monte-Carlo engine for the game-1 win-probability tool.
 * Pure logic + HTML rendering, with `played` results passed in (no globals),
 * so both the CLI (winprob.ts) and the live server (server.ts) can reuse it.
 */
import { USERS, type User } from './src/users'
import { GROUP_MATCHES, ALL_GROUP_LETTERS, TEAMS } from './src/shared/groups'
import { calculateStandings } from './src/shared/standings'
import { getThirdPlaceTeams, qualifyBestThirdPlace } from './src/formView/thirdPlace/thirdPlace'
import { resolveRound32, resolveKnockout, buildKnockoutBracket } from './src/formView/knockout/knockout'
import { computeUserPoints, advancingTeam, GOLDEN_BOOT_BONUS, OLEH_POINTS } from './src/leaderboard/points'
import { TEAM_STRENGTH } from './src/pages/results/teamStrength'
import { matchLambdas } from './src/shared/lambdas'
import { SCORERS } from './golden-boot'
import { isUnpredicted } from './src/shared/types'
import type {
  PredictionsState, MatchScores, TournamentResults,
  KnockoutMatch, KnockoutStages, Standing, ThirdPlaceQualification,
} from './src/shared/types'

// ---- RNG + Poisson ---------------------------------------------------------
let rngState = 12345 >>> 0
function reseed(seed: number) { rngState = seed >>> 0 }
function rng(): number {
  rngState |= 0; rngState = (rngState + 0x6d2b79f5) | 0
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
function poisson(lambda: number): number {
  const L = Math.exp(-lambda)
  let k = 0, p = 1
  do { k++; p *= rng() } while (p > L)
  return k - 1
}

// The goal-rate model (λ = BASE·att·def + host edge) lives in src/shared/lambdas
// so the per-match card odds and this engine can't drift apart.
function sampleScore(home: string, away: string): MatchScores {
  const [lh, la] = matchLambdas(home, away)
  return { home: poisson(lh), away: poisson(la) }
}
function sampleKOScore(home: string, away: string): MatchScores {
  const [lh, la] = matchLambdas(home, away)
  const h = poisson(lh), a = poisson(la)
  if (h === a) return { home: h, away: a, drawWinner: rng() < lh / (lh + la) ? 'home' : 'away' }
  return { home: h, away: a }
}

// ---- one simulated tournament ---------------------------------------------
type GroupData = { group: string; standings: Standing[]; allFilled: boolean }

function resolveThird(allGroupData: GroupData[]): ThirdPlaceQualification {
  const q = qualifyBestThirdPlace(getThirdPlaceTeams(allGroupData))
  if (q.resolved) return q
  return { resolved: true, all: q.all, qualifiers: q.all.slice(0, 8) }
}
function koWinner(m: KnockoutMatch, preds: PredictionsState): string {
  const s = preds[String(m.matchNum)]
  if (!s || s.home === null || s.away === null) return ''
  if (s.home > s.away) return m.home
  if (s.away > s.home) return m.away
  return s.drawWinner === 'home' ? m.home : m.away
}
function withScore(m: KnockoutMatch, preds: PredictionsState): KnockoutMatch {
  return { ...m, scores: preds[String(m.matchNum)] ?? { home: null, away: null } }
}
function sampleRound(matches: KnockoutMatch[], preds: PredictionsState) {
  for (const m of matches) {
    if (!m.resolved || !m.home || !m.away) continue
    const key = String(m.matchNum)
    const cur = preds[key]
    if (cur && cur.home !== null && cur.away !== null) continue
    preds[key] = sampleKOScore(m.home, m.away)
  }
}

export function simulateTournament(
  played: PredictionsState,
  realGoals: Record<string, number> = {},
  realGames: Map<string, number> = new Map(),
): TournamentResults {
  const preds: PredictionsState = { ...played }
  for (const letter of ALL_GROUP_LETTERS)
    for (const m of GROUP_MATCHES[letter])
      if (!preds[m.id]) preds[m.id] = sampleScore(m.homeTeam, m.awayTeam)

  const allGroupData: GroupData[] = ALL_GROUP_LETTERS.map(letter => ({
    group: letter,
    standings: calculateStandings(GROUP_MATCHES[letter], preds).standings,
    allFilled: true,
  }))

  const third = resolveThird(allGroupData)
  const round32 = resolveRound32(allGroupData, third)
  sampleRound(round32, preds)
  let ko = resolveKnockout(round32, preds)
  sampleRound(ko.r16, preds); ko = resolveKnockout(round32, preds)
  sampleRound(ko.qf, preds); ko = resolveKnockout(round32, preds)
  sampleRound(ko.sf, preds); ko = resolveKnockout(round32, preds)
  sampleRound([ko.thirdPlace, ko.final], preds); ko = resolveKnockout(round32, preds)

  const koStages = {
    r32: round32.map(m => withScore(m, preds)),
    r16: ko.r16.map(m => withScore(m, preds)),
    qf: ko.qf.map(m => withScore(m, preds)),
    sf: ko.sf.map(m => withScore(m, preds)),
    thirdPlace: [withScore(ko.thirdPlace, preds)],
    final: [withScore(ko.final, preds)],
  }

  const koMatches = [...koStages.r32, ...koStages.r16, ...koStages.qf, ...koStages.sf, ...koStages.thirdPlace, ...koStages.final]
  const teamGames = (team: string) => 3 + koMatches.filter(m => m.home === team || m.away === team).length
  // Every scorer is modelled the same way the "מה אם" boot race is: his banked goals (the real
  // tally when we have one — every picked scorer, plus any unpicked leader supplied from the ESPN
  // race like Messi — otherwise 0) plus only his team's REMAINING games at Poisson(rate). Using
  // remaining, not the whole tournament, is what stops an untracked scorer from being credited a
  // full tournament's worth in the endgame variance and thus "passing" a frozen leader far too
  // often. At kickoff realGames=0 so this equals the full-tournament estimate; the gap only opens
  // as games are played — exactly when the stale estimate would otherwise over-credit the field.
  const playerGoals: Record<string, number> = {}
  let bootMax = -1, bootWinners: string[] = []
  for (const sc of SCORERS) {
    const banked = realGoals[sc.name] ?? 0
    const remaining = Math.max(0, teamGames(sc.team) - (realGames.get(sc.team) ?? 0))
    const goals = banked + poisson(sc.ratePerMatch * remaining)
    playerGoals[sc.name] = goals
    if (goals > bootMax) { bootMax = goals; bootWinners = [sc.name] }
    else if (goals === bootMax) bootWinners.push(sc.name)
  }

  return {
    groupMatches: Object.fromEntries(ALL_GROUP_LETTERS.map(l =>
      [l, GROUP_MATCHES[l].map(m => ({ ...m, scores: preds[m.id] }))])),
    groupTables: Object.fromEntries(allGroupData.map(d => [d.group, d.standings])),
    thirdPlaceQualification: third,
    knockoutStages: koStages,
    champion: koWinner(ko.final, preds),
    thirdPlaceWinner: koWinner(ko.thirdPlace, preds),
    playerGoals,
    goldenBootWinner: bootWinners,
  }
}

// The standings *as they really stand right now* from the played results — used
// to rank bettors "currently" and compare against the simulated final rank. We
// resolve the real knockout bracket too, so once the KO starts the current rank
// keeps counting KO match/advancement/champion points exactly like the real
// leaderboard does (golden-boot goals are the one piece not derivable from the
// score-only `played` state, so they're left out of the current snapshot).
export function currentResults(played: PredictionsState, playerGoals?: Record<string, number>): TournamentResults {
  const groupMatches = Object.fromEntries(ALL_GROUP_LETTERS.map(l =>
    [l, GROUP_MATCHES[l].map(m => ({ ...m, scores: played[m.id] ?? { home: null, away: null } }))]))
  const groupData: GroupData[] = ALL_GROUP_LETTERS.map(l => {
    const matches = GROUP_MATCHES[l]
    return {
      group: l,
      standings: calculateStandings(matches, played).standings,
      allFilled: matches.every(m => { const s = played[m.id]; return s && s.home !== null && s.away !== null }),
    }
  })
  const groupTables = Object.fromEntries(groupData.map(d => [d.group, d.standings]))

  const empty = { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] }
  const allFilled = groupData.every(d => d.allFilled)
  const third = allFilled
    ? qualifyBestThirdPlace(getThirdPlaceTeams(groupData))
    : { resolved: false as const, all: [], tied: [] }

  if (!third.resolved) {
    return { groupMatches, groupTables, thirdPlaceQualification: third, knockoutStages: empty, playerGoals }
  }

  const round32 = resolveRound32(groupData, third)
  const ko = resolveKnockout(round32, played)
  return {
    groupMatches,
    groupTables,
    thirdPlaceQualification: third,
    knockoutStages: {
      r32: round32.map(m => withScore(m, played)),
      r16: ko.r16.map(m => withScore(m, played)),
      qf: ko.qf.map(m => withScore(m, played)),
      sf: ko.sf.map(m => withScore(m, played)),
      thirdPlace: [withScore(ko.thirdPlace, played)],
      final: [withScore(ko.final, played)],
    },
    champion: koWinner(ko.final, played),
    thirdPlaceWinner: koWinner(ko.thirdPlace, played),
    playerGoals,
  }
}

// ---- expected points for a single bettor ----------------------------------
// Average the bettor's points over `n` simulated completions of the tournament,
// starting from a fixed `played` state. Reseeding to the same `seed` for every
// call makes the draws for all *unfixed* matches identical across calls, so two
// `played` states that differ only in a few matches can be compared as a paired
// (common-random-numbers) experiment — tiny but real differences survive while
// the shared noise cancels. Per-stage means are returned so callers can explain
// *where* a difference comes from (group / cross / each knockout round).
export interface ExpectedBreakdown {
  total: number
  group: { matchPoints: number; placePoints: number; advancementPoints: number; total: number }
  r32: number; r16: number; qf: number; sf: number; third: number; final: number; goldenBoot: number
}

export function expectedUserPoints(
  user: User,
  played: PredictionsState,
  n: number,
  seed: number,
  realGoals: Record<string, number> = {},
): ExpectedBreakdown {
  reseed(seed)
  const realGames = Object.keys(realGoals).length ? realGamesByTeam(played) : new Map<string, number>()
  let total = 0, gm = 0, gp = 0, ga = 0, gtot = 0, r32 = 0, r16 = 0, qf = 0, sf = 0, third = 0, final = 0, gb = 0
  for (let i = 0; i < n; i++) {
    const res = simulateTournament(played, realGoals, realGames)
    const b = computeUserPoints(user, res)
    total += b.total
    gm += b.group.matchPoints; gp += b.group.placePoints; ga += b.group.advancementPoints; gtot += b.group.total
    r32 += b.r32.total; r16 += b.r16.total; qf += b.qf.total; sf += b.sf.total
    third += b.third.total; final += b.final.total; gb += b.goldenBoot.total
  }
  const d = (x: number) => x / n
  return {
    total: d(total),
    group: { matchPoints: d(gm), placePoints: d(gp), advancementPoints: d(ga), total: d(gtot) },
    r32: d(r32), r16: d(r16), qf: d(qf), sf: d(sf), third: d(third), final: d(final), goldenBoot: d(gb),
  }
}

// ---- competitive view for one bettor --------------------------------------
// The pool is a race against the other 26 forms, so "what's best for me" is a
// *competitive* question, not a point-count one: an outcome can earn me points
// yet still hurt me if it earns a close rival more. For a fixed `played` state
// we simulate the rest of the tournament and, each run, score the whole field
// to read off my finishing rank and whether I top it — then average. Per-rival
// expected points + "beat rate" (how often they finish above me) let the caller
// name the threat. Common random numbers (same seed) make two `played` states
// comparable as a paired experiment.
export interface RivalStat { label: string; expPoints: number; beatRate: number }
export interface CompetitiveEval {
  winProb: number   // P(I'm the (shared) leader of the whole field)
  expRank: number   // expected 1-based finish (lower is better)
  expPoints: number
  rivals: RivalStat[]
}

export function competitiveOutcome(
  viewerLabel: string,
  played: PredictionsState,
  n: number,
  seed: number,
  realGoals: Record<string, number> = {},
): CompetitiveEval {
  reseed(seed)
  const realGames = Object.keys(realGoals).length ? realGamesByTeam(played) : new Map<string, number>()
  const others = USERS.filter(u => u.label !== viewerLabel)
  const rivalPts = new Map<string, number>(others.map(u => [u.label, 0]))
  const rivalBeat = new Map<string, number>(others.map(u => [u.label, 0]))
  let winShare = 0, sumRank = 0, sumPts = 0

  for (let i = 0; i < n; i++) {
    const res = simulateTournament(played, realGoals, realGames)
    const scored = USERS.map(u => ({ label: u.label, pts: computeUserPoints(u, res).total }))
    const mine = scored.find(s => s.label === viewerLabel)?.pts ?? 0
    let above = 0, top = mine, winners = 1
    for (const s of scored) {
      if (s.label === viewerLabel) continue
      if (s.pts > mine) above++
      if (s.pts > top) { top = s.pts; winners = 1 }
      else if (s.pts === top) winners++
      rivalPts.set(s.label, rivalPts.get(s.label)! + s.pts)
      if (s.pts > mine) rivalBeat.set(s.label, rivalBeat.get(s.label)! + 1)
    }
    sumRank += above + 1
    sumPts += mine
    if (mine === top) winShare += 1 / winners
  }

  return {
    winProb: winShare / n,
    expRank: sumRank / n,
    expPoints: sumPts / n,
    rivals: others.map(u => ({
      label: u.label,
      expPoints: rivalPts.get(u.label)! / n,
      beatRate: rivalBeat.get(u.label)! / n,
    })),
  }
}

// ---- competitive scenario: everything in one pass --------------------------
// A superset of competitiveOutcome used by the group "what's best for you" card.
// On top of the competitive read (rank / win-prob / per-rival threat) it returns
// the viewer's expected points broken down by stage (a secondary "points" read)
// and, for each `trackTeam` the viewer backed deep, P(it reaches the stage they
// predicted for it). That reach probability is the human-readable proxy for
// eligibility: the simulation already scores the cross exactly (a knockout match
// only pays when the predicted matchup materialises — see koMatchPoints), so this
// just *explains* where a finish helps without re-deriving the bracket.
export interface ScenarioReach { team: string; rank: number; label: string; prob: number }
export interface CompetitiveScenarioEval {
  winProb: number
  expRank: number
  expPoints: number
  rivals: RivalStat[]
  stages: ExpectedBreakdown
  reach: ScenarioReach[]
}

function roundTeamSet(matches: KnockoutMatch[]): Set<string> {
  const s = new Set<string>()
  for (const m of matches) { if (m.home) s.add(m.home); if (m.away) s.add(m.away) }
  return s
}

// Did `team` reach the depth implied by `rank` (deepestStage ranks) in this run?
// Ranks 1-2 (group/best-third) just mean "made the round of 32".
function teamReachedStage(res: TournamentResults, team: string, rank: number): boolean {
  const ko = res.knockoutStages
  if (rank >= 7) return res.champion === team
  if (rank === 6) return roundTeamSet(ko.final).has(team)
  if (rank === 5) return roundTeamSet(ko.sf).has(team)
  if (rank === 4) return roundTeamSet(ko.qf).has(team)
  if (rank === 3) return roundTeamSet(ko.r16).has(team)
  return roundTeamSet(ko.r32).has(team)
}

export function competitiveScenario(
  viewer: User,
  played: PredictionsState,
  n: number,
  seed: number,
  realGoals: Record<string, number> = {},
  trackTeams: string[] = [],
): CompetitiveScenarioEval {
  reseed(seed)
  const realGames = Object.keys(realGoals).length ? realGamesByTeam(played) : new Map<string, number>()
  const others = USERS.filter(u => u.label !== viewer.label)
  const rivalPts = new Map<string, number>(others.map(u => [u.label, 0]))
  const rivalBeat = new Map<string, number>(others.map(u => [u.label, 0]))
  let winShare = 0, sumRank = 0, sumPts = 0
  let gm = 0, gp = 0, ga = 0, gtot = 0, r32 = 0, r16 = 0, qf = 0, sf = 0, third = 0, final = 0, gb = 0

  const tracked = trackTeams
    .map(team => ({ team, ...deepestStage(viewer, team) }))
    .filter(t => t.rank > 0)
  const reachCount = new Map<string, number>(tracked.map(t => [t.team, 0]))

  for (let i = 0; i < n; i++) {
    const res = simulateTournament(played, realGoals, realGames)
    const meB = computeUserPoints(viewer, res)
    const mine = meB.total
    gm += meB.group.matchPoints; gp += meB.group.placePoints; ga += meB.group.advancementPoints; gtot += meB.group.total
    r32 += meB.r32.total; r16 += meB.r16.total; qf += meB.qf.total; sf += meB.sf.total
    third += meB.third.total; final += meB.final.total; gb += meB.goldenBoot.total

    let above = 0, top = mine, winners = 1
    for (const u of others) {
      const pts = computeUserPoints(u, res).total
      if (pts > mine) above++
      if (pts > top) { top = pts; winners = 1 }
      else if (pts === top) winners++
      rivalPts.set(u.label, rivalPts.get(u.label)! + pts)
      if (pts > mine) rivalBeat.set(u.label, rivalBeat.get(u.label)! + 1)
    }
    sumRank += above + 1
    sumPts += mine
    if (mine === top) winShare += 1 / winners

    for (const t of tracked) if (teamReachedStage(res, t.team, t.rank)) reachCount.set(t.team, reachCount.get(t.team)! + 1)
  }

  const d = (x: number) => x / n
  return {
    winProb: winShare / n,
    expRank: sumRank / n,
    expPoints: sumPts / n,
    rivals: others.map(u => ({ label: u.label, expPoints: rivalPts.get(u.label)! / n, beatRate: rivalBeat.get(u.label)! / n })),
    stages: {
      total: d(sumPts),
      group: { matchPoints: d(gm), placePoints: d(gp), advancementPoints: d(ga), total: d(gtot) },
      r32: d(r32), r16: d(r16), qf: d(qf), sf: d(sf), third: d(third), final: d(final), goldenBoot: d(gb),
    },
    reach: tracked.map(t => ({ team: t.team, rank: t.rank, label: t.label, prob: reachCount.get(t.team)! / n })),
  }
}

// ---- viewer-only scenario (fast) ------------------------------------------
// Like competitiveScenario but WITHOUT scoring the rest of the field — just the
// viewer's own expected points (broken down by stage) and, for each tracked team
// they backed deep, P(it reaches the stage they predicted). Dropping the 26
// rival score computations per simulation makes it dramatically cheaper, so the
// match card can answer "what's best for *my* bet" fast.
export interface ViewerScenarioEval {
  stages: ExpectedBreakdown
  reach: ScenarioReach[]
}

export function viewerScenario(
  user: User,
  played: PredictionsState,
  n: number,
  seed: number,
  realGoals: Record<string, number> = {},
  trackTeams: string[] = [],
): ViewerScenarioEval {
  reseed(seed)
  const realGames = Object.keys(realGoals).length ? realGamesByTeam(played) : new Map<string, number>()
  const tracked = trackTeams
    .map(team => ({ team, ...deepestStage(user, team) }))
    .filter(t => t.rank > 0)
  const reachCount = new Map<string, number>(tracked.map(t => [t.team, 0]))
  let total = 0, gm = 0, gp = 0, ga = 0, gtot = 0, r32 = 0, r16 = 0, qf = 0, sf = 0, third = 0, final = 0, gb = 0
  for (let i = 0; i < n; i++) {
    const res = simulateTournament(played, realGoals, realGames)
    const b = computeUserPoints(user, res)
    total += b.total
    gm += b.group.matchPoints; gp += b.group.placePoints; ga += b.group.advancementPoints; gtot += b.group.total
    r32 += b.r32.total; r16 += b.r16.total; qf += b.qf.total; sf += b.sf.total
    third += b.third.total; final += b.final.total; gb += b.goldenBoot.total
    for (const t of tracked) if (teamReachedStage(res, t.team, t.rank)) reachCount.set(t.team, reachCount.get(t.team)! + 1)
  }
  const d = (x: number) => x / n
  return {
    stages: {
      total: d(total),
      group: { matchPoints: d(gm), placePoints: d(gp), advancementPoints: d(ga), total: d(gtot) },
      r32: d(r32), r16: d(r16), qf: d(qf), sf: d(sf), third: d(third), final: d(final), goldenBoot: d(gb),
    },
    reach: tracked.map(t => ({ team: t.team, rank: t.rank, label: t.label, prob: reachCount.get(t.team)! / n })),
  }
}

// ---- podium lift by knockout advancer --------------------------------------
// For a single, not-yet-played knockout fixture whose two participants are
// already known, answer the match card's "what most raises your odds of a high
// finish here": P(viewer finishes in the top PODIUM_DEPTH of the whole pool |
// teamA advances) vs the same given teamB advances. We condition by simply
// bucketing each simulated tournament on which side actually went through this
// fixture — one sim pass yields both conditionals (no second run), exactly like
// the scratch analyses.
//
// Returns null when there's nothing to advise: the match is already played, or
// its participants aren't yet locked (a deeper-round fixture whose feeders are
// still open — then "teamA vs teamB" isn't even defined, so we don't guess).

// How many of the final-table places count as a "high finish" for this card.
// The UI copy reads this off the same constant, so the metric and the words it's
// described with can never drift apart.
export const PODIUM_DEPTH = 5

export interface PodiumByAdvancer {
  matchNum: number
  teamA: string
  teamB: string
  podiumIfA: number       // P(viewer top-PODIUM_DEPTH | teamA advances)
  podiumIfB: number       // P(viewer top-PODIUM_DEPTH | teamB advances)
  // P(viewer top-PODIUM_DEPTH) over ALL sims regardless of who advances — the marginal the
  // two conditionals must average back to. Lets the card show each outcome's
  // *signed lift* (conditional − baseline) instead of a bare level: by the law of
  // total probability one advancer sits above this and the other below, so a raw
  // "both look high" reading is misleading without it.
  podiumBaseline: number
  // The same conditionals/baseline but for finishing *first* (rank 1) rather than
  // top-PODIUM_DEPTH — ties for the top score share the win (1/winners), matching
  // the leaderboard's win% convention. The card's "לזכות" tab reads these.
  winIfA: number          // P(viewer finishes 1st | teamA advances)
  winIfB: number          // P(viewer finishes 1st | teamB advances)
  winBaseline: number
  nA: number              // sims in which teamA advanced (bucket size, for noise)
  nB: number
}

function koMatchByNum(ks: KnockoutStages, matchNum: number): KnockoutMatch | undefined {
  return [...ks.r32, ...ks.r16, ...ks.qf, ...ks.sf, ...ks.thirdPlace, ...ks.final]
    .find(m => m.matchNum === matchNum)
}

export function podiumByAdvancer(
  viewer: User,
  played: PredictionsState,
  matchNum: number,
  n: number,
  seed: number,
  realGoals: Record<string, number> = {},
): PodiumByAdvancer | null {
  const settled = played[String(matchNum)]
  if (settled && !isUnpredicted(settled)) return null            // already played
  const bracketMatch = buildKnockoutBracket(played).find(m => m.matchNum === matchNum)
  // A fixture whose feeders are still open carries placeholder labels ("מנצח 74")
  // rather than real team codes — then "teamA vs teamB" isn't defined yet, so we
  // only advise once both participants resolve to actual teams.
  if (!bracketMatch || !TEAMS[bracketMatch.home] || !TEAMS[bracketMatch.away]) return null
  const teamA = bracketMatch.home, teamB = bracketMatch.away

  // Walk the SAME chunk plan as the win-prob worker (chunk size + per-chunk
  // reseed), so the conditional/baseline odds reported here are drawn from the
  // identical tournaments the "סיכויי זכיה" board aggregates — same sample, same
  // numbers, no Monte-Carlo drift between the two views.
  const realGames = Object.keys(realGoals).length ? realGamesByTeam(played) : new Map<string, number>()
  let nA = 0, nB = 0, podA = 0, podB = 0, winA = 0, winB = 0
  for (const chunk of simChunks(n, seed)) {
    reseed(chunk.seed)
    for (let i = 0; i < chunk.count; i++) {
      const res = simulateTournament(played, realGoals, realGames)
      const advancer = advancingTeam(koMatchByNum(res.knockoutStages, matchNum) ?? ({} as KnockoutMatch))
      const scored = USERS.map(u => ({ label: u.label, pts: computeUserPoints(u, res).total }))
      scored.sort((a, b) => b.pts - a.pts)
      const inTop = scored.slice(0, PODIUM_DEPTH).some(s => s.label === viewer.label)
      // Finishing first, with ties for the top score sharing the win (1/winners) —
      // the same convention the season-long win% uses.
      const top = scored[0].pts
      const winners = scored.filter(s => s.pts === top)
      const winShare = winners.some(w => w.label === viewer.label) ? 1 / winners.length : 0
      if (advancer === teamA) { nA++; if (inTop) podA++; winA += winShare }
      else if (advancer === teamB) { nB++; if (inTop) podB++; winB += winShare }
    }
  }
  const total = nA + nB
  return {
    matchNum, teamA, teamB,
    podiumIfA: nA ? podA / nA : 0,
    podiumIfB: nB ? podB / nB : 0,
    podiumBaseline: total ? (podA + podB) / total : 0,
    winIfA: nA ? winA / nA : 0,
    winIfB: nB ? winB / nB : 0,
    winBaseline: total ? (winA + winB) / total : 0,
    nA, nB,
  }
}

// The same conditional read as podiumByAdvancer, but for *every* still-undecided
// knockout fixture whose two teams are already known (i.e. the current round),
// scored in a single shared Monte-Carlo pass. One tournament is simulated per
// draw and every candidate match is tallied off it, so the whole set costs the
// same as one podiumByAdvancer run — and the numbers match the win-prob board
// (same chunk plan + seed). The caller ranks these to surface the fixture whose
// outcome swings the viewer's finish the most: their real "what if" moment.
export function pivotalMatches(
  viewer: User,
  played: PredictionsState,
  n: number,
  seed: number,
  realGoals: Record<string, number> = {},
): PodiumByAdvancer[] {
  const cands = buildKnockoutBracket(played)
    .filter(m => {
      const settled = played[String(m.matchNum)]
      if (settled && !isUnpredicted(settled)) return false      // already played
      return !!TEAMS[m.home] && !!TEAMS[m.away]                  // both teams known
    })
    .map(m => ({ matchNum: m.matchNum, teamA: m.home, teamB: m.away, nA: 0, nB: 0, podA: 0, podB: 0, winA: 0, winB: 0 }))
  if (!cands.length) return []

  const realGames = Object.keys(realGoals).length ? realGamesByTeam(played) : new Map<string, number>()
  for (const chunk of simChunks(n, seed)) {
    reseed(chunk.seed)
    for (let i = 0; i < chunk.count; i++) {
      const res = simulateTournament(played, realGoals, realGames)
      const ks = res.knockoutStages
      const byNum = new Map<number, KnockoutMatch>(
        [...ks.r32, ...ks.r16, ...ks.qf, ...ks.sf, ...ks.thirdPlace, ...ks.final].map(m => [m.matchNum, m]),
      )
      const scored = USERS.map(u => ({ label: u.label, pts: computeUserPoints(u, res).total }))
      scored.sort((a, b) => b.pts - a.pts)
      const inTop = scored.slice(0, PODIUM_DEPTH).some(s => s.label === viewer.label)
      const top = scored[0].pts
      const winners = scored.filter(s => s.pts === top)
      const winShare = winners.some(w => w.label === viewer.label) ? 1 / winners.length : 0
      for (const c of cands) {
        const advancer = advancingTeam(byNum.get(c.matchNum) ?? ({} as KnockoutMatch))
        if (advancer === c.teamA) { c.nA++; if (inTop) c.podA++; c.winA += winShare }
        else if (advancer === c.teamB) { c.nB++; if (inTop) c.podB++; c.winB += winShare }
      }
    }
  }
  return cands.map(c => {
    const total = c.nA + c.nB
    return {
      matchNum: c.matchNum, teamA: c.teamA, teamB: c.teamB,
      podiumIfA: c.nA ? c.podA / c.nA : 0,
      podiumIfB: c.nB ? c.podB / c.nB : 0,
      podiumBaseline: total ? (c.podA + c.podB) / total : 0,
      winIfA: c.nA ? c.winA / c.nA : 0,
      winIfB: c.nB ? c.winB / c.nB : 0,
      winBaseline: total ? (c.winA + c.winB) / total : 0,
      nA: c.nA, nB: c.nB,
    }
  })
}

// ---- Monte Carlo aggregation ----------------------------------------------
export const STAGE_KEYS = ['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final', 'gb'] as const
export type StageKey = typeof STAGE_KEYS[number]
export const STAGE_LABEL: Record<StageKey, string> = {
  group: 'שלב הבתים', r32: 'שלב 32', r16: 'שמינית גמר', qf: 'רבע גמר',
  sf: 'חצי גמר', third: 'מקום שלישי', final: 'גמר', gb: 'נעל זהב',
}
type Stages = Record<StageKey, number>
const zeroStages = (): Stages => ({ group: 0, r32: 0, r16: 0, qf: 0, sf: 0, third: 0, final: 0, gb: 0 })

export interface SimAgg {
  win: Map<string, number>; top3: Map<string, number>; top5: Map<string, number>
  sumPts: Map<string, number>; sumSq: Map<string, number>
  sumRank: Map<string, number>
  stages: Map<string, Stages>
  champFreq: Map<string, number>
  // How many simulated tournaments each team wins the third-place match in — read as a
  // probability (÷n), the model's odds a team takes the bronze. Used to quote the chance
  // behind a bettor's third-place bet in the optimal-scenario read.
  thirdFreq: Map<string, number>
  // How many simulated tournaments each *scorer* finishes as (or tied for) the top
  // goalscorer — i.e. wins or shares the golden boot. Read as a probability, this is
  // exactly the condition on the +10 bonus (an absolute race outcome, not a ranking
  // against other bettors), so the card can quote "X% to win/share the boot".
  bootFreq: Map<string, number>
  // How many simulated tournaments each *team* reaches the knockouts (round of
  // 32) — i.e. survives the group stage. Read as a survival probability, this is
  // the model's verdict on whether a team is still realistically in it, which the
  // group-only realEliminations() can't yet prove mid-group (a 3rd-placed team is
  // formally out only once the best-third pool is decided). See effectiveEliminations().
  reachR32: Map<string, number>
  // How many simulated tournaments each team finishes *first* in its group. With
  // reachR32 this lets the card say not just "advances" but "tops the group" —
  // the bit that decides the round-of-32 cross matchup once the picture clears.
  groupFirst: Map<string, number>
  // How often each team reaches each *knockout* round (appears in that round's
  // matches). With reachR32 (round of 32) and champFreq (the title) this gives a
  // full per-team depth curve, so the card can show "you backed X to the semis —
  // Y% to get there" for the exact depth each bettor predicted.
  reachR16: Map<string, number>
  reachQF: Map<string, number>
  reachSF: Map<string, number>
  reachFinal: Map<string, number>
  // Per knockout matchNum (every round, R32 through the final), how many simulated
  // tournaments produced each team pairing, keyed by a side-agnostic canonical key
  // "teamA|teamB" (alphabetical). Lets the crossings view read P(my predicted
  // matchup actually happens) for any bettor, at any knockout stage.
  koPairs: Map<number, Map<string, number>>
  series?: Map<string, number[]>
  // Per bettor, the full finishing-rank histogram: index r holds how many simulated
  // tournaments they finished in place r+1 (standard competition ranking). Collected
  // under the same flag as `series`. Lets the card quote a *realistic* best finish (the
  // best place with a non-trivial cumulative chance) and the theoretical peak (the very
  // best place they ever reached, however unlikely) — field-relative, not a tier bucket.
  rankCounts?: Map<string, number[]>
  // Per bettor, indexed by finishing place (r-1), the single highest-scoring simulated
  // tournament that landed them in that place — captured as the depth each of their deep
  // picks reached *in that one sim* plus whether their scorer took the boot. Because it's
  // one real tournament, the depths are mutually consistent (if two of their teams met,
  // only the winner went on), so buildRows can surface a coherent "optimal scenario" for
  // the bettor's realistic ceiling place — never a physically impossible wish-list.
  bestByRank?: Map<string, (BestScenarioSlot | null)[]>
  // Joint champion×finish tallies: keyed by the *simulated* champion team, then by bettor
  // label. `condWinByChamp` holds the summed pool-win share, `condTop3`/`condTop5` the raw
  // count of top-3 / top-5 finishes — all restricted to the sims where that team lifted the
  // trophy. Divided by champFreq[team] each gives P(bettor finishes first / top-3 / top-5 |
  // that team is champion) — the conditional read behind the "מה אם" view ("if your champion
  // really wins, what are your odds?"). Collected under the same flag as series/rankCounts.
  condWinByChamp?: Map<string, Map<string, number>>
  condTop3ByChamp?: Map<string, Map<string, number>>
  condTop5ByChamp?: Map<string, Map<string, number>>
}

// One captured best-case tournament for a bettor at a given finishing place: the points
// they scored and, aligned by index with deepScenarioPicks(u), the depth each deep pick
// reached (7=champion … 2=reached R32, 0=out in the group), plus the boot outcome and
// whether their predicted third-place winner took the (heavily-scored) third-place match.
export interface BestScenarioSlot { pts: number; depths: number[]; boot: boolean; third: boolean }

// Side-agnostic key for a knockout pairing, so a bettor who stored the two teams
// in either order matches the simulated matchup.
export function koPairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

// How many real matches each team has already completed (group + knockout),
// so the golden-boot model only randomizes a scorer's *remaining* games.
export function realGamesByTeam(played: PredictionsState): Map<string, number> {
  const games = new Map<string, number>()
  const bump = (t: string | undefined) => { if (t) games.set(t, (games.get(t) ?? 0) + 1) }
  for (const letter of ALL_GROUP_LETTERS)
    for (const gm of GROUP_MATCHES[letter]) {
      const s = played[gm.id]
      if (s && s.home !== null && s.away !== null) { bump(gm.homeTeam); bump(gm.awayTeam) }
    }
  for (const ko of buildKnockoutBracket(played)) {
    const s = played[String(ko.matchNum)]
    if (ko.resolved && s && s.home !== null && s.away !== null) { bump(ko.home); bump(ko.away) }
  }
  return games
}

// The Monte-Carlo sampler runs in fixed-size chunks, each re-seeded with
// `seed + chunkIndex` (a fresh, reproducible sub-stream). The win-prob worker
// chunks so it can yield to the event loop between batches and not freeze the
// page; anything else that must report the SAME probabilities (the match card's
// per-advancer podium/win buckets) walks the identical chunk plan via this
// helper. Centralising the chunk size + seed scheme here is what keeps the two
// from drifting apart if the mechanism is ever changed.
export const SIM_CHUNK = 250
export function simChunks(n: number, seed: number): { seed: number; count: number }[] {
  const chunks: { seed: number; count: number }[] = []
  for (let done = 0, i = 0; done < n; i++) {
    const count = Math.min(SIM_CHUNK, n - done)
    chunks.push({ seed: seed + i, count })
    done += count
  }
  return chunks
}

export function runSims(played: PredictionsState, n: number, seed: number, collect = false, realGoals: Record<string, number> = {}): SimAgg {
  reseed(seed)
  // Only adjust for banked goals when we actually have them — otherwise keep the
  // original behavior (sample over the full tournament from zero).
  const realGames = Object.keys(realGoals).length ? realGamesByTeam(played) : new Map<string, number>()
  const win = new Map<string, number>(), top3 = new Map<string, number>(), top5 = new Map<string, number>(), sumPts = new Map<string, number>(), sumSq = new Map<string, number>()
  const sumRank = new Map<string, number>()
  const stages = new Map<string, Stages>()
  const champFreq = new Map<string, number>()
  const thirdFreq = new Map<string, number>()
  const bootFreq = new Map<string, number>()
  const reachR32 = new Map<string, number>()
  const groupFirst = new Map<string, number>()
  const reachR16 = new Map<string, number>(), reachQF = new Map<string, number>(), reachSF = new Map<string, number>(), reachFinal = new Map<string, number>()
  const koPairs = new Map<number, Map<string, number>>()
  const series = collect ? new Map<string, number[]>() : undefined
  const rankCounts = collect ? new Map<string, number[]>() : undefined
  const bestByRank = collect ? new Map<string, (BestScenarioSlot | null)[]>() : undefined
  const condWinByChamp = collect ? new Map<string, Map<string, number>>() : undefined
  const condTop3ByChamp = collect ? new Map<string, Map<string, number>>() : undefined
  const condTop5ByChamp = collect ? new Map<string, Map<string, number>>() : undefined
  // Precomputed per-bettor deep-pick lists + a label→user lookup, so the hot loop can
  // snapshot each bettor's picks' depths without recomputing predictedAdvancers per sim.
  const deepPicksByLabel = collect ? new Map<string, ReturnType<typeof deepScenarioPicks>>() : undefined
  const userByLabel = collect ? new Map<string, User>() : undefined
  for (const u of USERS) {
    win.set(u.label, 0); top3.set(u.label, 0); top5.set(u.label, 0); sumPts.set(u.label, 0); sumSq.set(u.label, 0); sumRank.set(u.label, 0); stages.set(u.label, zeroStages()); series?.set(u.label, []); rankCounts?.set(u.label, new Array(USERS.length).fill(0))
    bestByRank?.set(u.label, new Array(USERS.length).fill(null))
    deepPicksByLabel?.set(u.label, deepScenarioPicks(u))
    userByLabel?.set(u.label, u)
  }
  // Seed every group team at 0 so a team that *never* reaches the knockouts still
  // gets an explicit 0 (a missing key would otherwise hide it from the survival
  // verdict — exactly the case for a side that's already mathematically doomed).
  for (const letter of ALL_GROUP_LETTERS)
    for (const m of GROUP_MATCHES[letter]) { reachR32.set(m.homeTeam, 0); reachR32.set(m.awayTeam, 0); groupFirst.set(m.homeTeam, 0); groupFirst.set(m.awayTeam, 0) }

  for (let i = 0; i < n; i++) {
    const results = simulateTournament(played, realGoals, realGames)
    if (results.champion) champFreq.set(results.champion, (champFreq.get(results.champion) ?? 0) + 1)
    if (results.thirdPlaceWinner) thirdFreq.set(results.thirdPlaceWinner, (thirdFreq.get(results.thirdPlaceWinner) ?? 0) + 1)
    // Every sampled boot winner (usually one, more when tied) gets a tally — a tie
    // credits each, mirroring the pool rule that a shared boot still pays the bonus.
    const bootWinners = Array.isArray(results.goldenBootWinner) ? results.goldenBootWinner : results.goldenBootWinner ? [results.goldenBootWinner] : []
    for (const w of bootWinners) bootFreq.set(w, (bootFreq.get(w) ?? 0) + 1)
    for (const m of results.knockoutStages.r32) {
      if (m.home) reachR32.set(m.home, (reachR32.get(m.home) ?? 0) + 1)
      if (m.away) reachR32.set(m.away, (reachR32.get(m.away) ?? 0) + 1)
    }
    // Pairing tallies for *every* knockout match, so the crossings view can quote
    // P(matchup) at any stage the bettor predicted, not just the round of 32.
    const ks = results.knockoutStages
    for (const m of [...ks.r32, ...ks.r16, ...ks.qf, ...ks.sf, ...ks.thirdPlace, ...ks.final]) {
      if (!m.home || !m.away) continue
      const key = koPairKey(m.home, m.away)
      let byPair = koPairs.get(m.matchNum)
      if (!byPair) { byPair = new Map(); koPairs.set(m.matchNum, byPair) }
      byPair.set(key, (byPair.get(key) ?? 0) + 1)
    }
    const bumpReach = (map: Map<string, number>, ms: KnockoutMatch[]) => {
      for (const m of ms) { if (m.home) map.set(m.home, (map.get(m.home) ?? 0) + 1); if (m.away) map.set(m.away, (map.get(m.away) ?? 0) + 1) }
    }
    bumpReach(reachR16, results.knockoutStages.r16)
    bumpReach(reachQF, results.knockoutStages.qf)
    bumpReach(reachSF, results.knockoutStages.sf)
    bumpReach(reachFinal, results.knockoutStages.final)
    for (const standings of Object.values(results.groupTables)) {
      const winner = standings[0]?.team
      if (winner) groupFirst.set(winner, (groupFirst.get(winner) ?? 0) + 1)
    }
    // Deepest round each team reached *this* sim (7=champion … 2=reached R32), so the
    // best-case collector can read a mutually-consistent depth for every pick at once.
    let depthByTeam: Map<string, number> | undefined
    let bootSet: Set<string> | undefined
    if (bestByRank) {
      depthByTeam = new Map<string, number>()
      const setDepth = (t: string | undefined, d: number) => { if (t && (depthByTeam!.get(t) ?? 0) < d) depthByTeam!.set(t, d) }
      for (const m of ks.r32) { setDepth(m.home, 2); setDepth(m.away, 2) }
      for (const m of ks.r16) { setDepth(m.home, 3); setDepth(m.away, 3) }
      for (const m of ks.qf) { setDepth(m.home, 4); setDepth(m.away, 4) }
      for (const m of ks.sf) { setDepth(m.home, 5); setDepth(m.away, 5) }
      for (const m of ks.final) { setDepth(m.home, 6); setDepth(m.away, 6) }
      if (results.champion) setDepth(results.champion, 7)
      bootSet = new Set(bootWinners)
    }
    const scored = USERS.map(u => {
      const b = computeUserPoints(u, results)
      const st = stages.get(u.label)!
      st.group += b.group.total; st.r32 += b.r32.total; st.r16 += b.r16.total; st.qf += b.qf.total
      st.sf += b.sf.total; st.third += b.third.total; st.final += b.final.total; st.gb += b.goldenBoot.total
      return { label: u.label, pts: b.total }
    })
    scored.sort((a, b) => b.pts - a.pts)
    const top = scored[0].pts
    const winners = scored.filter(s => s.pts === top)
    const share = 1 / winners.length
    for (const w of winners) win.set(w.label, win.get(w.label)! + share)
    // Joint champion×finish tally: credit each pool winner's share (and the top-3 / top-5
    // finishers) to the bucket of the team that was champion in this very sim, so we can
    // later condition finish-odds on a given champion actually lifting the trophy.
    if (condWinByChamp && condTop3ByChamp && condTop5ByChamp && results.champion) {
      const bucket = (m: Map<string, Map<string, number>>) => {
        let b = m.get(results.champion!)
        if (!b) { b = new Map(); m.set(results.champion!, b) }
        return b
      }
      const winB = bucket(condWinByChamp)
      for (const w of winners) winB.set(w.label, (winB.get(w.label) ?? 0) + share)
      const t3 = bucket(condTop3ByChamp)
      for (let r = 0; r < scored.length && r < 3; r++) t3.set(scored[r].label, (t3.get(scored[r].label) ?? 0) + 1)
      const t5 = bucket(condTop5ByChamp)
      for (let r = 0; r < scored.length && r < 5; r++) t5.set(scored[r].label, (t5.get(scored[r].label) ?? 0) + 1)
    }
    for (let r = 0; r < scored.length && r < 3; r++) top3.set(scored[r].label, top3.get(scored[r].label)! + 1)
    for (let r = 0; r < scored.length && r < 5; r++) top5.set(scored[r].label, top5.get(scored[r].label)! + 1)
    // standard competition ranking (ties share the higher rank: 1,2,2,4…)
    let rank = 1
    for (let r = 0; r < scored.length; r++) {
      if (r > 0 && scored[r].pts !== scored[r - 1].pts) rank = r + 1
      const label = scored[r].label
      sumRank.set(label, sumRank.get(label)! + rank)
      const rc = rankCounts?.get(label)
      if (rc) rc[rank - 1]++
      // Keep, for this finishing place, the highest-scoring sim we've seen for this
      // bettor — a single coherent tournament we can later narrate as their best case.
      if (bestByRank && depthByTeam) {
        const slots = bestByRank.get(label)!
        const cur = slots[rank - 1]
        if (!cur || scored[r].pts > cur.pts) {
          const picks = deepPicksByLabel!.get(label)!
          const depths = picks.map(p => depthByTeam!.get(p.team) ?? 0)
          const bettor = userByLabel!.get(label)!
          const scorer = bettor.topGoalscorer
          const thirdPick = bettor.predictedThirdPlaceWinner
          slots[rank - 1] = {
            pts: scored[r].pts, depths,
            boot: !!scorer && bootSet!.has(scorer),
            third: !!thirdPick && results.thirdPlaceWinner === thirdPick,
          }
        }
      }
    }
    for (const s of scored) {
      sumPts.set(s.label, sumPts.get(s.label)! + s.pts)
      sumSq.set(s.label, sumSq.get(s.label)! + s.pts * s.pts)
      series?.get(s.label)!.push(s.pts)
    }
  }
  return { win, top3, top5, sumPts, sumSq, sumRank, stages, champFreq, thirdFreq, bootFreq, reachR32, groupFirst, reachR16, reachQF, reachSF, reachFinal, koPairs, series, rankCounts, bestByRank, condWinByChamp, condTop3ByChamp, condTop5ByChamp }
}

// Add every tally of `b` into `a` (in place) and return `a`. All aggregate
// fields are sums/counts so they merge additively; `series` (per-bettor point
// samples) concatenates. This lets the engine be run in several smaller batches
// and combined into one result identical to a single n = Σ batchN run — used by
// the worker to slice a long simulation into yielding chunks without changing
// the maths (each chunk just needs its own seed so the draws don't repeat).
export function mergeSimAgg(a: SimAgg, b: SimAgg): SimAgg {
  const addMap = (ma: Map<string, number>, mb: Map<string, number>) => {
    for (const [k, v] of mb) ma.set(k, (ma.get(k) ?? 0) + v)
  }
  addMap(a.win, b.win); addMap(a.top3, b.top3); addMap(a.top5, b.top5)
  addMap(a.sumPts, b.sumPts); addMap(a.sumSq, b.sumSq); addMap(a.sumRank, b.sumRank)
  addMap(a.champFreq, b.champFreq); addMap(a.thirdFreq, b.thirdFreq); addMap(a.bootFreq, b.bootFreq); addMap(a.reachR32, b.reachR32); addMap(a.groupFirst, b.groupFirst)
  addMap(a.reachR16, b.reachR16); addMap(a.reachQF, b.reachQF); addMap(a.reachSF, b.reachSF); addMap(a.reachFinal, b.reachFinal)
  for (const [num, bp] of b.koPairs) {
    const cur = a.koPairs.get(num)
    if (!cur) { a.koPairs.set(num, new Map(bp)); continue }
    for (const [k, v] of bp) cur.set(k, (cur.get(k) ?? 0) + v)
  }
  for (const [label, st] of b.stages) {
    const cur = a.stages.get(label)
    if (!cur) { a.stages.set(label, { ...st }); continue }
    for (const k of STAGE_KEYS) cur[k] += st[k]
  }
  if (a.series && b.series) {
    for (const [label, arr] of b.series) {
      const cur = a.series.get(label)
      if (cur) cur.push(...arr); else a.series.set(label, [...arr])
    }
  }
  if (a.rankCounts && b.rankCounts) {
    for (const [label, arr] of b.rankCounts) {
      const cur = a.rankCounts.get(label)
      if (cur) for (let i = 0; i < arr.length; i++) cur[i] += arr[i]
      else a.rankCounts.set(label, [...arr])
    }
  }
  // Champion×finish buckets sum additively, chunk by chunk, exactly like the flat
  // tallies — just nested one level under the simulated champion.
  const mergeNested = (a2?: Map<string, Map<string, number>>, b2?: Map<string, Map<string, number>>) => {
    if (!a2 || !b2) return
    for (const [team, byBettor] of b2) {
      const cur = a2.get(team)
      if (!cur) { a2.set(team, new Map(byBettor)); continue }
      for (const [label, v] of byBettor) cur.set(label, (cur.get(label) ?? 0) + v)
    }
  }
  mergeNested(a.condWinByChamp, b.condWinByChamp)
  mergeNested(a.condTop3ByChamp, b.condTop3ByChamp)
  mergeNested(a.condTop5ByChamp, b.condTop5ByChamp)
  // Best-case scenarios don't sum — per place we keep the higher-scoring of the two
  // chunks' captured tournaments, so the merged result matches a single n-run.
  if (a.bestByRank && b.bestByRank) {
    for (const [label, arr] of b.bestByRank) {
      const cur = a.bestByRank.get(label)
      if (!cur) { a.bestByRank.set(label, arr.map(s => (s ? { ...s, depths: [...s.depths] } : null))); continue }
      for (let i = 0; i < arr.length; i++) {
        const bs = arr[i]
        if (bs && (!cur[i] || bs.pts > cur[i]!.pts)) cur[i] = { ...bs, depths: [...bs.depths] }
      }
    }
  }
  return a
}

export function percentile(arr: number[], p: number): number {
  const a = [...arr].sort((x, y) => x - y)
  return a[Math.floor(p * (a.length - 1))]
}

export function describePlayed(played: PredictionsState): string[] {
  return Object.entries(played).map(([id, s]) => {
    const m = (GROUP_MATCHES[id[0]] ?? []).find(x => x.id === id)
    return m && s.home !== null && s.away !== null
      ? `${he(m.homeTeam)} ${s.home}-${s.away} ${he(m.awayTeam)}` : null
  }).filter(Boolean) as string[]
}

// ---- explanation helpers ---------------------------------------------------
export const he = (team: string) => TEAMS[team]?.he ?? team

function teamSignals(played: PredictionsState): Map<string, 'won' | 'lost' | 'drew'> {
  const map = new Map<string, 'won' | 'lost' | 'drew'>()
  for (const [id, s] of Object.entries(played)) {
    if (s.home === null || s.away === null) continue
    const m = (GROUP_MATCHES[id[0]] ?? []).find(x => x.id === id)
    if (!m) continue
    if (s.home > s.away) { map.set(m.homeTeam, 'won'); map.set(m.awayTeam, 'lost') }
    else if (s.away > s.home) { map.set(m.homeTeam, 'lost'); map.set(m.awayTeam, 'won') }
    else { map.set(m.homeTeam, 'drew'); map.set(m.awayTeam, 'drew') }
  }
  return map
}

// How many OTHER bettors also backed `team` to reach at least `rank`. When two of your own
// picks collide in the bracket and only one can go through, your points are the same either
// way — so the rank-favourable outcome is the one FEWER rivals share: the popular team
// advancing lifts the pack along with you, the rare one advancing lifts you alone. Lower is
// better for the excluded bettor. Drives the optimal scenario's collision resolution.
export function rivalBackers(team: string, rank: number, excludeLabel: string): number {
  let c = 0
  for (const u of USERS) {
    if (u.label === excludeLabel) continue
    if (deepestStage(u, team).rank >= rank) c++
  }
  return c
}

export function deepestStage(u: typeof USERS[number], team: string): { rank: number; label: string } {
  if (u.predictedChampion === team) return { rank: 7, label: 'אלופה' }
  if ((u.predictedFinalTeams ?? []).includes(team)) return { rank: 6, label: 'גמר' }
  if ((u.predictedSFTeams ?? []).includes(team)) return { rank: 5, label: 'חצי גמר' }
  if ((u.predictedQFTeams ?? []).includes(team)) return { rank: 4, label: 'רבע גמר' }
  if ((u.predictedR16Teams ?? []).includes(team)) return { rank: 3, label: 'שמינית' }
  if (Object.values(u.groupTables).some(t => t.slice(0, 2).some(s => s.team === team))) return { rank: 2, label: 'עולה מהבית' }
  if (u.thirdPlaceQualification.resolved && u.thirdPlaceQualification.qualifiers.some(t => t.team === team))
    return { rank: 1, label: 'עולה כשלישית' }
  return { rank: 0, label: '' }
}

const TIER = (team: string) => {
  const att = TEAM_STRENGTH[team]?.att ?? 1
  return att >= 1.6 ? 'מהפייבוריטיות' : att >= 1.35 ? 'נבחרת חזקה' : att >= 1.1 ? 'נבחרת בינונית' : 'נבחרת חלשה'
}

// The bettor's deep picks (quarter-final and beyond), deepest first — the teams whose
// runs make up the best-case scenario. Shared by the sim collector and buildRows so the
// stored per-sim depth array lines up with these picks by index (stable order).
export function deepScenarioPicks(u: User): { team: string; teamHe: string; predictedRank: number }[] {
  const out: { team: string; teamHe: string; predictedRank: number }[] = []
  for (const team of predictedAdvancers(u)) {
    const rank = deepestStage(u, team).rank
    if (rank >= 4) out.push({ team, teamHe: he(team), predictedRank: rank })
  }
  out.sort((a, b) => b.predictedRank - a.predictedRank || (a.team < b.team ? -1 : 1))
  return out
}

function turkeyDepth(u: typeof USERS[number]): string {
  const d = deepestStage(u, 'Turkey')
  return d.rank > 0 ? d.label : '—'
}

function explain(u: typeof USERS[number], winPct: number, avgWin: number, signals: Map<string, 'won' | 'lost' | 'drew'>): string {
  const pos: { team: string; label: string; rank: number }[] = []
  const neg: { team: string; label: string; rank: number }[] = []
  for (const [team, sig] of signals) {
    const d = deepestStage(u, team)
    if (d.rank < 1) continue
    if (sig === 'won') pos.push({ team, label: d.label, rank: d.rank })
    if (sig === 'lost') neg.push({ team, label: d.label, rank: d.rank })
  }
  pos.sort((a, b) => b.rank - a.rank)
  neg.sort((a, b) => b.rank - a.rank)
  const fmt = (x: { team: string; label: string }) => `${he(x.team)} (${x.label})`
  const parts: string[] = []
  if (u.predictedChampion) parts.push(`אלופה: ${he(u.predictedChampion)} (${TIER(u.predictedChampion)})`)
  if (pos.length) parts.push(`לטובתו: ${pos.slice(0, 2).map(fmt).join(', ')} — כבר ניצחו`)
  if (neg.length) parts.push(`לרעתו: ${neg.slice(0, 2).map(fmt).join(', ')} — כבר הפסידו`)
  const lead = winPct >= avgWin * 1.5 ? 'גבוה' : winPct <= avgWin * 0.6 ? 'נמוך' : 'בינוני'
  return `${lead} — ${parts.join('; ')}`
}

// Below this many percentage points, a win% move is within Monte-Carlo sampling
// noise at the card's sim count (the *difference* of two estimates is doubly
// noisy), so we don't assert a direction — a single group game flipping a title
// race by a few tenths is almost always the seed talking, not the football.
export const WIN_DELTA_EPS = 1.0

// Plain-Hebrew "why" for the win% move after a played game. Each clause names
// the scoreline and a short forward read on the bettor's predicted finish ("the
// target you called"), keyed off whether that team is still alive. When `delta`
// is given we add one short line only when the move is counter-intuitive — your
// pick won yet you slipped (rivals on the same team gained more), or your pick
// stumbled yet you rose (a rival's deeper pick fell). Keyed by label.
export function explainMatchForUser(
  u: User,
  home: string, away: string,
  homeScore: number, awayScore: number,
  eliminations?: Map<string, TeamExit>,
  delta?: number,
): string {
  const isOut = (team: string) => !!eliminations?.has(team)
  const draw = homeScore === awayScore
  const winner = draw ? '' : homeScore > awayScore ? home : away

  // One clause per team the bettor had backed, ordered deepest pick first so the
  // most meaningful swing (e.g. their champion) leads. The base outcome wording
  // is kept intact and the score + a short forward note are appended after it.
  const clause = (team: string): { rank: number; text: string } | null => {
    const d = deepestStage(u, team)
    if (d.rank === 0) return null
    const name = `${he(team)} (${d.label})`
    const tg = team === home ? homeScore : awayScore
    const og = team === home ? awayScore : homeScore
    const score = `${tg}–${og}`

    if (draw) {
      if (isOut(team)) return { rank: d.rank, text: `${name} נפלטה בתיקו (${score}) — היעד שחזית ירד מהפרק` }
      return { rank: d.rank, text: `${name} סיימה בתיקו ועדיין בחיים (${score}) — היעד שחזית נשמר` }
    }
    if (team === winner) {
      // A team can win its final group game yet still be out (poor record/GD, no
      // best-third slot). Never say "closing in" for a side the engine has out.
      if (isOut(team)) return { rank: d.rank, text: `${name} ניצחה ${score} אך נפלטה מהטורניר — היעד שחזית ירד מהפרק` }
      return { rank: d.rank, text: `${name} ניצחה ${score} — מתקרבת ליעד שחזית` }
    }
    if (isOut(team)) return { rank: d.rank, text: `${name} הודחה מהטורניר (${score}) — היעד שחזית ירד מהפרק` }
    return { rank: d.rank, text: `${name} הפסידה אך עדיין בחיים (${score}) — היעד שחזית עדיין פתוח` }
  }

  const clauses = [clause(home), clause(away)]
    .filter((c): c is { rank: number; text: string } => c !== null)
    .sort((a, b) => b.rank - a.rank)

  if (!clauses.length) return 'לא בחרת קבוצה מהמשחק — השינוי נובע מהיריבים שבחרו אותן'

  // The surprising-move note: only when the win% direction fights the result of
  // your own picks, since this is a "first among all bettors" race.
  const backedWinner = !draw && deepestStage(u, winner).rank > 0
  let note = ''
  if (delta !== undefined && Math.abs(delta) >= WIN_DELTA_EPS) {
    if (delta > 0 && !backedWinner) note = ' · העלייה הגיעה מנפילת מתחרים'
    else if (delta < 0 && backedWinner) note = ' · למרות הניצחון, מתחרים שבחרו אותה הרוויחו יותר'
  }
  return `מהבחירות שלך: ${clauses.map(c => c.text).join(' · ')}${note}`
}

export function explainLastMatch(
  label: string,
  home: string, away: string,
  homeScore: number, awayScore: number,
  eliminations?: Map<string, TeamExit>,
  delta?: number,
): string {
  const u = USERS.find(x => x.label === label)
  return u ? explainMatchForUser(u, home, away, homeScore, awayScore, eliminations, delta) : ''
}

// When a played match eliminates a team the bettor had backed to advance, this
// names that pick (the deepest one if both teams were backed) plus how many of
// the whole field also backed it. The caller uses the share to explain a
// counter-intuitive card line — "your pick died yet your win% barely moved" —
// which happens when a near-consensus pick falls: the blow lands on almost
// everyone, so the *relative* race (finish first among all bettors) hardly shifts.
export interface EliminatedBackedPick {
  team: string
  teamHe: string
  backers: number
  total: number
}

export function eliminatedBackedPickInMatch(
  label: string,
  home: string, away: string,
  exits: Map<string, TeamExit>,
): EliminatedBackedPick | null {
  const u = USERS.find(x => x.label === label)
  if (!u) return null
  const backed = [home, away]
    .map(team => ({ team, d: deepestStage(u, team) }))
    .filter(c => c.d.rank > 0 && exits.has(c.team))
    .sort((a, b) => b.d.rank - a.d.rank)
  if (!backed.length) return null
  const { team } = backed[0]
  let backers = 0
  for (const x of USERS) if (deepestStage(x, team).rank > 0) backers++
  return { team, teamHe: he(team), backers, total: USERS.length }
}

// ---- bracket survival vs reality ------------------------------------------
// For each bettor we want: of the teams they backed to reach the knockouts,
// how many are still actually in the tournament — and which deep pick hurt
// most when it busted. This reads the *real* results, not the simulations.
export interface TeamExit { rank: number; label: string }

// Where a team is considered to have exited if it loses at this stage. Ranks
// mirror deepestStage() so we can compare "predicted depth" vs "real depth".
const KO_EXIT: Record<keyof KnockoutStages, TeamExit> = {
  r32: { rank: 2, label: 'שלב 32' },
  r16: { rank: 3, label: 'שמינית הגמר' },
  qf: { rank: 4, label: 'רבע הגמר' },
  sf: { rank: 5, label: 'חצי הגמר' },
  thirdPlace: { rank: 5, label: 'משחק המקום ה‑3' },
  final: { rank: 6, label: 'הגמר' },
}

function koLoserTeam(m: KnockoutMatch): string | null {
  const s = m.scores
  if (!s || s.home === null || s.away === null) return null
  if (s.home > s.away) return m.away
  if (s.away > s.home) return m.home
  return s.drawWinner === 'home' ? m.away : m.home
}

// Map of every team eliminated in reality → the stage where its run ended.
// Teams still alive (incl. the eventual champion) simply aren't in the map.
// Standings/qualifiers are recomputed from the played scores rather than read
// off `results.groupTables`, which is left empty in the committed real data.
export function realEliminations(results: TournamentResults): Map<string, TeamExit> {
  const exits = new Map<string, TeamExit>()

  // Group stage: a team is only "out" once its whole group has been played, and
  // the best-third-place qualifiers can only be known once *all* groups finish.
  const groupPreds: PredictionsState = {}
  for (const matches of Object.values(results.groupMatches))
    for (const m of matches)
      if (m.scores && !isUnpredicted(m.scores)) groupPreds[m.id] = m.scores

  const groupData = ALL_GROUP_LETTERS.map(letter => {
    const matches = GROUP_MATCHES[letter] ?? []
    return {
      group: letter,
      standings: calculateStandings(matches, groupPreds).standings,
      allFilled: matches.length > 0 && matches.every(m => groupPreds[m.id]),
    }
  })
  const third = qualifyBestThirdPlace(getThirdPlaceTeams(groupData))
  const thirdSet = third.resolved ? new Set(third.qualifiers.map(t => t.team)) : null

  for (const d of groupData) {
    if (!d.allFilled) continue
    d.standings.forEach((s, idx) => {
      if (idx < 2) return                                   // top two always advance
      if (idx === 2) {
        if (thirdSet === null) return                       // 3rd place still undecided
        if (thirdSet.has(s.team)) return                    // qualified as a best third
      }
      if (!exits.has(s.team)) exits.set(s.team, { rank: 0, label: 'שלב הבתים' })
    })
  }

  // Knockout: the loser of each played match exits at that round. Shallow
  // rounds first so a team's *first* (deepest-surviving) exit is what sticks.
  const order: (keyof KnockoutStages)[] = ['r32', 'r16', 'qf', 'sf', 'thirdPlace', 'final']
  for (const round of order) {
    for (const m of results.knockoutStages[round]) {
      const loser = koLoserTeam(m)
      if (loser && !exits.has(loser)) exits.set(loser, KO_EXIT[round])
    }
  }
  return exits
}

// Fuse the *certain* exits (knockout losers, fully-played group non-qualifiers)
// with the model's verdict: any team whose simulated knockout-reach probability
// is below `eps` has no realistic path left and is treated as eliminated for the
// survival count and the per-match explanation — even mid-group, where a team can
// be mathematically out of the top two yet not *formally* out until the best-third
// pool is settled (e.g. a side that lost its first two games on a poor goal
// difference). This keeps the card self-consistent: the same engine that gives a
// pick ~0% to advance also stops calling it "still alive". `reachByTeam` is keyed
// by team code (reachR32 / n) exactly like `realEliminations`' exits map.
export const EFFECTIVE_OUT_EPS = 0.005

export function effectiveEliminations(
  realExits: Map<string, TeamExit>,
  reachByTeam: Record<string, number>,
  eps: number = EFFECTIVE_OUT_EPS,
): Map<string, TeamExit> {
  const exits = new Map(realExits)
  for (const [team, reach] of Object.entries(reachByTeam)) {
    if (reach < eps && !exits.has(team)) exits.set(team, { rank: 0, label: 'שלב הבתים' })
  }
  return exits
}

export interface BracketSurvival {
  alive: number
  total: number
  out: number
  // The eliminated pick the bettor backed deepest — the most painful bust.
  painful?: { teamHe: string; predictedLabel: string; exitLabel: string }
}

// Every team the bettor predicted to *advance out of the groups* — the round-of-32
// set: the top two of each group plus their best-third qualifiers. Deeper picks
// (R16 → champion) are folded in defensively so a deep call is never dropped even
// if the group tables disagree. This is the universe the survival line counts, and
// it matches the per-match elimination callout (both key off "predicted to advance"),
// so the card can't say "all your picks alive" while flagging a backed team as out.
function predictedAdvancers(u: User): Set<string> {
  const set = new Set<string>()
  for (const g of Object.keys(u.groupTables))
    for (const s of (u.groupTables[g] ?? []).slice(0, 2)) set.add(s.team)
  if (u.thirdPlaceQualification.resolved)
    for (const t of u.thirdPlaceQualification.qualifiers) set.add(t.team)
  for (const t of [
    u.predictedChampion,
    ...(u.predictedFinalTeams ?? []),
    ...(u.predictedSFTeams ?? []),
    ...(u.predictedQFTeams ?? []),
    ...(u.predictedR16Teams ?? []),
  ]) if (t) set.add(t)
  return set
}

export function bracketSurvival(u: User, exits: Map<string, TeamExit>): BracketSurvival | null {
  const picks = predictedAdvancers(u)
  if (!picks.size) return null
  let alive = 0
  let painful: { teamHe: string; predictedLabel: string; exitLabel: string; rank: number } | null = null
  for (const team of picks) {
    const exit = exits.get(team)
    if (!exit) { alive++; continue }
    const d = deepestStage(u, team)
    if (!painful || d.rank > painful.rank) {
      painful = { teamHe: he(team), predictedLabel: d.label, exitLabel: exit.label, rank: d.rank }
    }
  }
  return {
    alive,
    total: picks.size,
    out: picks.size - alive,
    painful: painful
      ? { teamHe: painful.teamHe, predictedLabel: painful.predictedLabel, exitLabel: painful.exitLabel }
      : undefined,
  }
}

export function bracketSurvivalForLabel(label: string, exits: Map<string, TeamExit>): BracketSurvival | null {
  const u = USERS.find(x => x.label === label)
  return u ? bracketSurvival(u, exits) : null
}

// ---- round-3 advancement picture ------------------------------------------
// As the group stage closes the interesting question shifts from "did your pick
// win" to "is your pick actually going through, and as what seed". This reads the
// model's reach (P advance) and group-first (P top the group) probabilities for
// every team the bettor backed to advance, and buckets each into a plain status.
// `exits` is the same effectiveEliminations map the survival line uses, so an
// "out" here can never contradict "still in the tournament" there.
export type PickStage = 'out' | 'secured' | 'likely' | 'bubble' | 'longshot'

export interface PickStatus {
  team: string
  teamHe: string
  reach: number        // P(reach round of 32)
  groupFirst: number   // P(finish 1st in group)
  stage: PickStage
  topsGroup: boolean   // model favors this team to win its group outright
  predictedRank: number // how deep the bettor backed it (deepestStage rank: champion=7…3rd-qualifier=1)
}

export interface AdvancementSummary {
  picks: PickStatus[] // every advancement pick, sorted most-secure first
  secured: number; likely: number; bubble: number; longshot: number; out: number
  total: number
  decided: boolean    // no pick is still genuinely in the balance (bubble/longshot)
}

function classifyReach(reach: number): Exclude<PickStage, 'out'> {
  if (reach >= 0.85) return 'secured'
  if (reach >= 0.6) return 'likely'
  if (reach >= 0.35) return 'bubble'
  return 'longshot'
}

export function advancementSummary(
  u: User,
  reachByTeam: Record<string, number>,
  groupFirstByTeam: Record<string, number>,
  exits: Map<string, TeamExit>,
): AdvancementSummary | null {
  const picks = predictedAdvancers(u)
  if (!picks.size) return null
  const list: PickStatus[] = []
  for (const team of picks) {
    const reach = reachByTeam[team] ?? 0
    const groupFirst = groupFirstByTeam[team] ?? 0
    const stage: PickStage = exits.has(team) ? 'out' : classifyReach(reach)
    list.push({ team, teamHe: he(team), reach, groupFirst, stage, topsGroup: stage !== 'out' && groupFirst >= 0.5, predictedRank: deepestStage(u, team).rank })
  }
  list.sort((a, b) => b.reach - a.reach)
  const count = (s: PickStage) => list.filter(p => p.stage === s).length
  const bubble = count('bubble'), longshot = count('longshot')
  return {
    picks: list,
    secured: count('secured'), likely: count('likely'), bubble, longshot, out: count('out'),
    total: list.length,
    decided: bubble === 0 && longshot === 0,
  }
}

export function advancementSummaryForLabel(
  label: string,
  reachByTeam: Record<string, number>,
  groupFirstByTeam: Record<string, number>,
  exits: Map<string, TeamExit>,
): AdvancementSummary | null {
  const u = USERS.find(x => x.label === label)
  return u ? advancementSummary(u, reachByTeam, groupFirstByTeam, exits) : null
}

// Per-team probability of *reaching* each tournament depth (cumulative — reaching
// the semis implies reaching the quarters). Built from the engine's per-round
// appearance counts so the card can quote the odds at the exact depth a bettor
// backed a team to, rather than only "advances from the group".
export interface StageReach {
  r32: number; r16: number; qf: number; sf: number; final: number; champion: number
  // P(win the third-place match). Not a depth on the reach ladder (it's a distinct bet),
  // so it sits alongside rather than feeding reachAtRank. Optional for older callers/tests.
  third?: number
}

// The reach probability at the depth a bettor predicted (deepestStage rank):
// champion(7)→title, final(6)→final, SF(5)→semis, QF(4)→quarters, R16(3)→last-16,
// group-advance(1–2)→reaching the knockouts at all.
export function reachAtRank(sr: StageReach | undefined, rank: number): number {
  if (!sr) return 0
  if (rank >= 7) return sr.champion
  if (rank === 6) return sr.final
  if (rank === 5) return sr.sf
  if (rank === 4) return sr.qf
  if (rank === 3) return sr.r16
  return sr.r32
}

// ---- build ranked rows -----------------------------------------------------
export interface StageStat { key: StageKey; label: string; val: number; field: number; edge: number }
// A bettor's finish-place ceiling, read off the simulated rank histogram:
//  - bestPlace: the *realistic* best finish — the highest place (lowest number) they
//    reach with at least a non-trivial cumulative chance (REALISTIC_PLACE_P), so it's
//    not a one-in-a-thousand fluke. bestPlacePct is that cumulative chance (finish at that
//    place or better) — the number that actually makes it "realistic".
//  - peakPlace: the theoretical best — the very best place seen in *any* sim, however
//    unlikely. peakPlacePct is its (typically near-zero) cumulative chance.
// Both are field-relative (they come from ranking every bettor each sim), which is what
// makes "the highest place you can realistically reach" a concrete number, not a bucket.
export const REALISTIC_PLACE_P = 0.10
export interface PlaceStats { bestPlace: number; bestPlacePct: number; peakPlace: number; peakPlacePct: number }
export function placeStats(counts: number[] | undefined, n: number, expRank: number): PlaceStats {
  const fallback = Math.max(1, Math.round(expRank))
  if (!counts || !n) return { bestPlace: fallback, bestPlacePct: 0, peakPlace: fallback, peakPlacePct: 0 }
  // Raw percentages (multiply before dividing to keep clean integers where possible) —
  // the display layer (fmtPct) rounds and, crucially, renders a tiny-but-nonzero peak as
  // "<0.1%" rather than a misleading "0.0%".
  const pct = (count: number) => (count * 100) / n
  let cum = 0, peakPlace = 0, peakPlacePct = 0, bestPlace = 0, bestPlacePct = 0
  for (let i = 0; i < counts.length; i++) {
    const c = counts[i]
    cum += c
    if (c > 0 && peakPlace === 0) { peakPlace = i + 1; peakPlacePct = pct(cum) }
    if (bestPlace === 0 && cum / n >= REALISTIC_PLACE_P) { bestPlace = i + 1; bestPlacePct = pct(cum) }
  }
  if (peakPlace === 0) return { bestPlace: fallback, bestPlacePct: 0, peakPlace: fallback, peakPlacePct: 0 }
  if (bestPlace === 0) { bestPlace = peakPlace; bestPlacePct = peakPlacePct }
  return { bestPlace, bestPlacePct, peakPlace, peakPlacePct }
}

// A single deep pick's fate inside the bettor's captured best-case tournament: how far
// it was backed to go vs how far it actually went in that one coherent sim.
export interface BestScenarioPick {
  team: string          // team code — for looking up the model's reach odds / pick popularity
  teamHe: string
  predictedRank: number // depth backed (7=title … 4=QF)
  reached: number       // depth actually reached in the captured sim (7=champion … 2=R32, 0=out)
}

// The bettor's coherent best-case scenario — one real simulated tournament in which they
// finished at their realistic ceiling place. Every pick's depth is mutually consistent
// (if two of their teams met, only the winner advanced), so this can be narrated as a
// single believable "here's your dream run" without contradicting the bracket.
export interface BestScenario {
  rank: number   // finishing place in this sim (= the bettor's realistic ceiling)
  pts: number    // points scored in this sim
  picks: BestScenarioPick[]
  boot: boolean  // their picked scorer took (or shared) the golden boot in this sim
  bootScorerHe: string
  third: boolean       // their predicted third-place winner took the third-place match here
  thirdTeam: string    // that team's code — empty when the bet is settled / not made
  thirdTeamHe: string  // that team's Hebrew name — empty when the bet is settled / not made
}

export interface Row {
  label: string; winPct: number; top3Pct: number; top5Pct: number; avgPts: number
  std: number; ceiling: number; curRank: number; expRank: number; turkey: string
  // The realistic best finish + the theoretical peak, from the simulated rank histogram.
  bestPlace: number; bestPlacePct: number; peakPlace: number; peakPlacePct: number
  // The coherent optimal-scenario snapshot at the realistic ceiling place (null when the
  // bettor has no deep picks / the sim never captured a landing at that place).
  bestScenario?: BestScenario
  championHe: string; championTeam: string; championAlive: boolean; scorer: string; reason: string
  // Model probability the bettor's picked scorer wins or *shares* the golden boot —
  // the exact condition on the +10 bonus, so the card can explain that reward.
  scorerBootPct: number
  // "מה אם" — the conditional read on the champion pick. `championWinPct` is the model's
  // chance the bettor's predicted champion actually lifts the trophy; `condWinPct` /
  // `condTop3Pct` / `condTop5Pct` are their chances to finish first / top-3 / top-5 in the
  // pool *given* that champion comes through (all null when they backed no champion, or the
  // sim never crowned it — an impossible condition).
  championWinPct: number
  condWinPct: number | null
  condTop3Pct: number | null
  condTop5Pct: number | null
  stages: StageStat[]
}

// The champion-conditioned finish read for one bettor: how likely their predicted champion
// is to actually win, and — restricted to exactly those simulated tournaments — their
// chances to finish first / top-3 / top-5 in the pool. The conditional fields are null when
// the bet is moot: no champion picked, or the model never crowned it (so the condition can't
// occur).
function condChampion(real: SimAgg, u: User, n: number): {
  championWinPct: number; condWinPct: number | null; condTop3Pct: number | null; condTop5Pct: number | null
} {
  const champ = u.predictedChampion
  const none = { condWinPct: null, condTop3Pct: null, condTop5Pct: null }
  if (!champ) return { championWinPct: 0, ...none }
  const champCount = real.champFreq.get(champ) ?? 0
  const championWinPct = (champCount / n) * 100
  if (champCount === 0) return { championWinPct, ...none }
  const cond = (m?: Map<string, Map<string, number>>) => ((m?.get(champ)?.get(u.label) ?? 0) / champCount) * 100
  return {
    championWinPct,
    condWinPct: cond(real.condWinByChamp),
    condTop3Pct: cond(real.condTop3ByChamp),
    condTop5Pct: cond(real.condTop5ByChamp),
  }
}

export function buildRows(real: SimAgg, n: number, played: PredictionsState, playerGoals?: Record<string, number>): Row[] {
  const cur = currentResults(played, playerGoals)
  const curScores = USERS.map(u => ({ label: u.label, pts: computeUserPoints(u, cur).total }))
    .sort((a, b) => b.pts - a.pts)
  const curRank = new Map(curScores.map((s, i) => [s.label, i + 1]))
  const signals = teamSignals(played)
  const avgWin = 100 / USERS.length

  // The tournament as it *really* stands now — used to keep the best-case scenario
  // forward-looking: a pick whose team is already out, or has already reached the depth
  // it was backed to, is settled history and drops out of "what can still happen". So the
  // scenario naturally shrinks and sharpens as more matches are played.
  const realExits = realEliminations(cur)
  const curDepthByTeam = new Map<string, number>()
  {
    const setD = (t: string | undefined, d: number) => { if (t && (curDepthByTeam.get(t) ?? 0) < d) curDepthByTeam.set(t, d) }
    const ks = cur.knockoutStages
    for (const m of ks.r32) { setD(m.home, 2); setD(m.away, 2) }
    for (const m of ks.r16) { setD(m.home, 3); setD(m.away, 3) }
    for (const m of ks.qf) { setD(m.home, 4); setD(m.away, 4) }
    for (const m of ks.sf) { setD(m.home, 5); setD(m.away, 5) }
    for (const m of ks.final) { setD(m.home, 6); setD(m.away, 6) }
    if (cur.champion) setD(cur.champion, 7)
  }

  // field average per stage
  const fieldStage = zeroStages()
  for (const u of USERS) {
    const st = real.stages.get(u.label)!
    for (const k of STAGE_KEYS) fieldStage[k] += st[k] / n
  }
  for (const k of STAGE_KEYS) fieldStage[k] /= USERS.length

  return USERS.map(u => {
    const winPct = (real.win.get(u.label)! / n) * 100
    const mean = real.sumPts.get(u.label)! / n
    const std = Math.sqrt(Math.max(0, real.sumSq.get(u.label)! / n - mean * mean))
    const ceiling = real.series ? percentile(real.series.get(u.label)!, 0.95) : 0
    const expRankVal = real.sumRank.get(u.label)! / n
    const places = placeStats(real.rankCounts?.get(u.label), n, expRankVal)
    const st = real.stages.get(u.label)!
    const stages: StageStat[] = STAGE_KEYS.map(k => {
      const val = st[k] / n
      return { key: k, label: STAGE_LABEL[k], val, field: fieldStage[k], edge: val - fieldStage[k] }
    })
    // The coherent best case: the captured highest-scoring sim in which this bettor
    // finished at their realistic ceiling place. Its per-pick depths came from one real
    // tournament, so they can't contradict the bracket (colliding picks resolve there).
    const slot = real.bestByRank?.get(u.label)?.[places.bestPlace - 1] ?? null
    let bestScenario: BestScenario | undefined
    if (slot) {
      const deep = deepScenarioPicks(u)
      // The third-place bet lives in ONE coherent tournament: the team lost its semi and
      // then took the third-place match. So it can only be credited when, in this very
      // captured run, it reached the semis (depth ≥ 5) — a team that went further (final/
      // title) or fell short (out before the semis) can't also be the third-place winner.
      // We also require the real bet to still be open: not yet decided, and the team either
      // alive or already a semi-loser (exit rank 5). Its captured depth is read by its index
      // in `deep` (stable order, same array the per-sim depths were stored against).
      const thirdPick = u.predictedThirdPlaceWinner
      const thirdIdx = thirdPick ? deep.findIndex(p => p.team === thirdPick) : -1
      const thirdDepth = thirdIdx >= 0 ? (slot.depths[thirdIdx] ?? 0) : 0
      let thirdTeamHe = ''
      if (thirdPick && !cur.thirdPlaceWinner && thirdDepth >= 5) {
        const exit = realExits.get(thirdPick)
        if (!exit || exit.rank === 5) thirdTeamHe = he(thirdPick)
      }
      // Keep only picks still in play: team not eliminated, and not yet at the depth it
      // was backed to. Map by the *original* index first so the stored depth array stays
      // aligned with the pick list after filtering. Lookups use the team code (realExits /
      // curDepthByTeam are code-keyed), while the display carries the Hebrew name. The
      // credited third-place team is capped at the semis here so it isn't shown reaching the
      // final in the same scenario it's said to win the third-place match.
      const livePicks = deep
        .map((p, i) => {
          const raw = slot.depths[i] ?? 0
          const reached = thirdTeamHe && p.team === thirdPick ? Math.min(raw, 5) : raw
          return { team: p.team, teamHe: p.teamHe, predictedRank: p.predictedRank, reached }
        })
        .filter(p => !realExits.has(p.team) && (curDepthByTeam.get(p.team) ?? 0) < p.predictedRank)
      // Rank-favourable collision resolution. Two picks backed to the same round give you
      // the same points whichever goes through — so when the captured run advanced one and
      // dropped the other, hand the deeper run to whichever FEWER rivals also backed (see
      // rivalBackers): the outcome that lifts you highest above the field, not an arbitrary
      // coin-flip. Coherence-safe: it only permutes the reached depths among picks at the
      // same backed depth (same multiset of outcomes, reassigned). The third-place pick is
      // steered separately, so it sits out.
      const byRank = new Map<number, typeof livePicks>()
      for (const p of livePicks) {
        if (thirdTeamHe && p.team === thirdPick) continue
        const g = byRank.get(p.predictedRank)
        if (g) g.push(p); else byRank.set(p.predictedRank, [p])
      }
      for (const [rank, g] of byRank) {
        if (g.length < 2) continue
        const depths = g.map(p => p.reached).sort((a, b) => b - a)
        const order = [...g].sort((a, b) =>
          rivalBackers(a.team, rank, u.label) - rivalBackers(b.team, rank, u.label) ||
          (a.team < b.team ? -1 : 1))
        order.forEach((p, i) => { p.reached = depths[i] })
      }
      const picks = livePicks.map(p => ({ team: p.team, teamHe: p.teamHe, predictedRank: p.predictedRank, reached: p.reached }))
      // The golden boot and the third-place bonus are *additive* bets that never fight the
      // bracket: winning the boot only ever adds its +10 (plus goals), and a still-live
      // third-place pick can always land. So the genuine ceiling scenario collects both —
      // yet the captured sim is just one sampled draw and may miss them (e.g. the picked
      // scorer finishing second in that particular run). Showing that as "✕ won't win" reads
      // as if losing were *better*, which is wrong. So whenever the bonus is still winnable
      // we assert it here and credit the points the captured sim happened to leave on the
      // table. (Team picks stay as the sim played them — those collisions are real.)
      const bootWinnable = !!u.topGoalscorer && (real.bootFreq.get(u.topGoalscorer) ?? 0) > 0
      const bootWon = bootWinnable || slot.boot
      const thirdWon = !!thirdTeamHe || slot.third
      const bonusFix =
        (bootWon && !slot.boot ? GOLDEN_BOOT_BONUS : 0) +
        (thirdWon && !slot.third ? OLEH_POINTS.thirdPlaceWinner : 0)
      bestScenario = {
        rank: places.bestPlace,
        pts: slot.pts + bonusFix,
        picks,
        boot: bootWon,
        bootScorerHe: bootWinnable ? he(u.topGoalscorer) : '',
        third: thirdWon,
        thirdTeam: thirdTeamHe ? (thirdPick ?? '') : '',
        thirdTeamHe,
      }
    }
    return {
      label: u.label, winPct,
      top3Pct: (real.top3.get(u.label)! / n) * 100,
      top5Pct: (real.top5.get(u.label)! / n) * 100,
      avgPts: mean, std, ceiling,
      bestPlace: places.bestPlace, bestPlacePct: places.bestPlacePct,
      peakPlace: places.peakPlace, peakPlacePct: places.peakPlacePct,
      bestScenario,
      curRank: curRank.get(u.label)!,
      expRank: expRankVal,
      turkey: turkeyDepth(u),
      championHe: u.predictedChampion ? he(u.predictedChampion) : '—',
      championTeam: u.predictedChampion ?? '',
      championAlive: !u.predictedChampion || (real.champFreq.get(u.predictedChampion) ?? 0) > 0,
      scorer: u.topGoalscorer || '—',
      scorerBootPct: u.topGoalscorer ? (real.bootFreq.get(u.topGoalscorer) ?? 0) / n * 100 : 0,
      ...condChampion(real, u, n),
      reason: explain(u, winPct, avgWin, signals),
      stages,
    }
  }).sort(compareRows)
}

// Rank the win-probability board so the order matches the *expected final standing*: first
// the chance to finish *first* (the headline), then the expected finishing place (lower is
// better) — this is what makes the order agree with the "מקום צפוי" column, so a bettor who's
// nearly certain of 4th sits above one who's a coin-flip for 5th (top-3/top-5 alone used to
// invert that). Top-3, then top-5, then average points break any remaining ties, and finally
// the name so the order is fully stable.
export function compareRows(a: Row, b: Row): number {
  return (
    b.winPct - a.winPct ||
    a.expRank - b.expRank ||
    b.top3Pct - a.top3Pct ||
    b.top5Pct - a.top5Pct ||
    b.avgPts - a.avgPts ||
    a.label.localeCompare(b.label, 'he')
  )
}

// ---- HTML report -----------------------------------------------------------
export interface HtmlMeta {
  n: number
  playedList: string[]
  updatedAt: Date
  live?: boolean
  source?: string
  refreshSecs?: number
  historyHref?: string
}

export function buildHtml(rows: Row[], meta: HtmlMeta): string {
  const maxWin = Math.max(...rows.map(r => r.winPct), 1)
  const COLSPAN = 12
  const tableRows = rows.map((r, i) => {
    const barW = (r.winPct / maxWin) * 100
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''
    const maxAbs = Math.max(...r.stages.map(s => Math.abs(s.edge)), 1)
    const chips = r.stages.map(s => {
      const cls = s.edge > 0.5 ? 'pos' : s.edge < -0.5 ? 'neg' : 'mid'
      const sign = s.edge >= 0 ? '+' : '−'
      const barPct = (Math.abs(s.edge) / maxAbs) * 100
      return `<div class="stage ${cls}">
            <div class="stage-top"><span class="stage-name">${s.label}</span><span class="stage-edge">${sign}${Math.abs(s.edge).toFixed(1)}</span></div>
            <div class="stage-bar"><div class="stage-fill" style="width:${barPct.toFixed(0)}%"></div></div>
            <div class="stage-val">${s.val.toFixed(0)} <span class="stage-field">(שדה ${s.field.toFixed(0)})</span></div>
          </div>`
    }).join('')
    const totalEdge = r.stages.reduce((a, s) => a + s.edge, 0)
    const teSign = totalEdge >= 0 ? '+' : '−'
    return `      <tr class="main" onclick="tg(${i})">
        <td class="rank">${i + 1} ${medal}</td>
        <td class="name">${r.label}</td>
        <td class="num"><div class="bar-wrap"><div class="bar" style="width:${barW.toFixed(1)}%"></div><span>${r.winPct.toFixed(1)}%</span></div></td>
        <td class="num">${r.top3Pct.toFixed(1)}%</td>
        <td class="num">${r.avgPts.toFixed(0)}</td>
        <td class="num">±${r.std.toFixed(0)}</td>
        <td class="num">${r.ceiling.toFixed(0)}</td>
        <td class="num">${r.curRank}</td>
        <td class="champ">${r.championHe}</td>
        <td class="champ">${r.scorer}</td>
        <td class="reason">${r.reason}</td>
        <td class="num toggle"><span id="ti${i}">▸</span> פירוק</td>
      </tr>
      <tr class="detail" id="d${i}" hidden>
        <td colspan="${COLSPAN}">
          <div class="bd-head">פירוק נק' צפויות לפי שלב — מול ממוצע השדה <b class="${totalEdge >= 0 ? 'pos' : 'neg'}">(סה"כ ${teSign}${Math.abs(totalEdge).toFixed(0)})</b></div>
          <div class="stages">${chips}</div>
        </td>
      </tr>`
  }).join('\n')

  const liveBadge = meta.live
    ? `<span class="badge">● LIVE</span> מקור: ${meta.source ?? 'openfootball'} • `
    : ''
  const refreshTag = meta.live && meta.refreshSecs
    ? `<meta http-equiv="refresh" content="${meta.refreshSecs}">`
    : ''
  const refreshBtn = meta.live
    ? `<a class="refresh" href="/?t=${Date.now()}">🔄 רענן עכשיו</a>`
    : ''
  const historyBtn = meta.historyHref
    ? ` <a class="refresh alt" href="${meta.historyHref}">📈 היסטוריית הסתברויות</a>`
    : ''

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${refreshTag}
<title>הסתברות זכייה — משחק 1</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; font-family: "Segoe UI", Arial, sans-serif; background: #0f1117; color: #e8eaf0; line-height: 1.5; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  .sub { color: #9aa3b2; font-size: 13px; margin-bottom: 14px; }
  .badge { color:#22d3ee; font-weight:700; }
  .refresh { display:inline-block; margin-bottom:16px; background:#2563eb; color:#fff; text-decoration:none;
             padding:8px 16px; border-radius:8px; font-weight:600; font-size:14px; }
  .refresh:hover { background:#1d4ed8; }
  .refresh.alt { background:#7c3aed; } .refresh.alt:hover { background:#6d28d9; }
  .cards { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
  .card { background: #1a1d27; border: 1px solid #2a2f3d; border-radius: 10px; padding: 12px 16px; font-size: 13px; }
  .card b { color: #fff; font-size: 15px; }
  table { width: 100%; border-collapse: collapse; background: #1a1d27; border-radius: 12px; overflow: hidden; font-size: 14px; }
  thead th { background: #232838; color: #cdd3e0; text-align: right; padding: 11px 12px; font-weight: 600; white-space: nowrap; }
  tbody td { padding: 10px 12px; border-top: 1px solid #262b38; vertical-align: middle; }
  tbody tr:hover { background: #20242f; }
  .rank { font-weight: 700; color: #aab2c2; white-space: nowrap; }
  .name { font-weight: 600; white-space: nowrap; }
  .num { text-align: center; font-variant-numeric: tabular-nums; }
  .champ { color: #8fd0ff; white-space: nowrap; }
  .reason { color: #c4cbd8; font-size: 13px; min-width: 320px; }
  .bar-wrap { position: relative; background: #11141c; border-radius: 6px; height: 22px; min-width: 120px; }
  .bar { position: absolute; inset: 0 auto 0 0; height: 100%; background: linear-gradient(90deg,#3b82f6,#22d3ee); border-radius: 6px; }
  .bar-wrap span { position: relative; z-index: 1; padding: 0 8px; line-height: 22px; font-weight: 700; font-size: 12px; }
  tbody tr:first-child .name { color: #ffd54a; }
  .note { color: #9aa3b2; font-size: 12px; margin-top: 16px; }
  details { margin-top: 14px; background:#1a1d27; border:1px solid #2a2f3d; border-radius:10px; padding:10px 14px; }
  summary { cursor: pointer; color:#cdd3e0; font-weight:600; }
  code { background:#11141c; padding:1px 5px; border-radius:4px; }
  tr.main { cursor: pointer; }
  .toggle { color:#8fd0ff; white-space:nowrap; font-size:13px; }
  .toggle span { display:inline-block; transition:transform .15s; }
  tr.main.open .toggle span { transform: rotate(90deg); }
  tr.detail > td { background:#141822; padding:14px 16px; }
  .bd-head { color:#cdd3e0; font-size:13px; margin-bottom:10px; }
  .bd-head .pos { color:#4ade80; } .bd-head .neg { color:#f87171; }
  .stages { display:grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap:10px; }
  .stage { background:#1a1d27; border:1px solid #2a2f3d; border-radius:8px; padding:8px 10px; }
  .stage-top { display:flex; justify-content:space-between; align-items:center; font-size:12px; }
  .stage-name { color:#aab2c2; }
  .stage-edge { font-weight:700; font-variant-numeric: tabular-nums; }
  .stage.pos { border-color:#1f5132; } .stage.pos .stage-edge { color:#4ade80; }
  .stage.neg { border-color:#5b2330; } .stage.neg .stage-edge { color:#f87171; }
  .stage.mid .stage-edge { color:#9aa3b2; }
  .stage-bar { height:5px; background:#11141c; border-radius:3px; margin:6px 0 5px; overflow:hidden; }
  .stage.pos .stage-fill { height:100%; background:#22c55e; }
  .stage.neg .stage-fill { height:100%; background:#ef4444; }
  .stage.mid .stage-fill { height:100%; background:#475569; }
  .stage-val { font-size:11px; color:#cdd3e0; font-variant-numeric: tabular-nums; }
  .stage-field { color:#6b7385; }
</style>
</head>
<body>
  <h1>הסתברות זכייה — משחק 1 (החבר'ה)</h1>
  <div class="sub">${liveBadge}סימולציית Monte Carlo (${meta.n.toLocaleString()} ריצות) • עודכן: ${meta.updatedAt.toLocaleString('he-IL')}</div>
  ${refreshBtn}${historyBtn}

  <div class="cards">
    <div class="card">פייבוריט<br><b>${rows[0].label} — ${rows[0].winPct.toFixed(1)}%</b></div>
    <div class="card">משחקים ששוחקו<br><b>${meta.playedList.length}</b></div>
    <div class="card">מתמודדים<br><b>${rows.length}</b></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th><th>מתמודד</th><th>סיכוי זכייה</th><th>טופ-3</th>
        <th>נק' צפויות</th><th>תנודתיות (σ)</th><th>תקרה (P95)</th><th>מיקום כעת</th><th>אלופה שבחר</th><th>מלך שערים</th><th>הסבר</th><th>פירוק</th>
      </tr>
    </thead>
    <tbody>
${tableRows}
    </tbody>
  </table>

  <p class="note">
    <b>איך לקרוא:</b> הטבלה ממוינת לפי <b>סיכוי זכייה</b> (אחוז הסימולציות בהן המתמודד סיים <b>ראשון מול כל ה‑26</b>),
    ולא לפי נק' צפויות. לכן ייתכן שמתמודד עם <b>ממוצע ותקרה גבוהים יותר</b> ידורג <b>נמוך</b> יותר:
    אם הברקט שלו <b>דומה למתמודדים החזקים האחרים</b>, אז בתרחישים שבהם הוא מזנק — גם הם מזנקים, והוא נוחת שני.
    מי שהברקט שלו <b>מבודל מהקהל</b> נשאר לבד בראש ולכן זוכה יותר. (σ = תנודתיות, P95 = תקרה.)
  </p>

  <details>
    <summary>פירוט: ${meta.playedList.length} משחקים ששוחקו (הבסיס לחישוב)</summary>
    <p style="color:#c4cbd8;font-size:13px;">${meta.playedList.join(' &nbsp;•&nbsp; ')}</p>
  </details>

  <p class="note">
    <b>מה נכלל (זהה לכל 26):</b> נקודות עלייה בכל שלב, ניקוד משחקים (צליפה/כיוון), נקודות מיקום, אלופה, מקום 3,
    ומלך שערים. המצב הנוכחי נלקח בחשבון דרך התוצאות המקובעות (כולל הפרש שערים).
    מודל: Poisson, λ = 1.3·att·def. הערכה יחסית, לא תחזית מדויקת.
  </p>

  <p class="note">
    <b>על הפירוק:</b> לחיצה על שורה פותחת את <b>פירוק הנקודות הצפויות לפי שלב</b> מול ממוצע כל השדה.
    כך רואים מאיפה בא היתרון/החיסרון: למשל פער חיובי גדול ב<b>שלב הבתים</b> (צליפות, דירוג, עולים) שווה הרבה יותר
    מפער בחצי הגמר, שבו רוב המתמודדים בחרו רביעייה דומה ולכן הוא כמעט לא מבדל.
  </p>

  <script>
    function tg(i){
      var d=document.getElementById('d'+i);
      var t=document.getElementById('ti'+i);
      var row=d.previousElementSibling;
      if(d.hidden){d.hidden=false; if(row)row.classList.add('open'); if(t)t.textContent='▾';}
      else{d.hidden=true; if(row)row.classList.remove('open'); if(t)t.textContent='▸';}
    }
  </script>
</body>
</html>`
}
