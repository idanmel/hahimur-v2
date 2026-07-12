import type { MatchScores, TournamentResults, KnockoutMatch } from '../../shared/types'
import type { User } from '../../users'
import { computeUserPoints, OLEH_POINTS, singleMatchPoints, GOLDEN_BOOT_BONUS, POINTS_PER_GOAL } from '../points'
import { predictedPairing, orientPrediction } from '../../formView/knockout/koRounds'
import { TEAMS } from '../../shared/groups'
import { TEAM_BY_PICKED } from '../../shared/scorers'
import { matchLambdas } from '../../shared/lambdas'

// ─────────────────────────────────────────────────────────────────────────────
// "מה אם" — the end-game scenario explorer.
//
// With only the final four (two semis, third-place match, final) left, the pool is a
// small, *finite* set of concrete outcomes. Unlike the earlier winner-only sketch,
// this models the FULL scoring exactly — every point that can still move:
//   • scoreline points (פגיעה / צליפה) on each of the four matches
//   • reaching the final  → the SF עלייה (16) for each finalist's backers
//   • winning the final    → the אלופה bonus (25)
//   • the third-place match → its winner's מדליה bonus (20)
//   • the golden boot +10 → its backers, for a *projected* boot winner (see bootInfo);
//     the boot hinges on who scores, not on a result, so it's a separate scenario axis
//     (a selected winner for the table/odds, swept across candidates for reachability).
//
// The incremental scorer below is verified in scenarios.test.ts to match the real
// points engine (computeUserPoints) exactly, so the fast enumeration is trustworthy.
// ─────────────────────────────────────────────────────────────────────────────

export const teamHe = (t: string): string => TEAMS[t]?.he ?? t
export const teamIso = (t: string): string | undefined => TEAMS[t]?.iso

export const MATCH_NUM = { sf1: 101, sf2: 102, third: 103, final: 104 } as const

export interface SfInfo {
  matchNum: number
  teams: [string, string]
  winner: string | null // decided (already played) or null while open
  scores: MatchScores | null // the real played scoreline, when decided
}

export interface RemainingInfo {
  valid: boolean
  sf: SfInfo[]
  finalWinner: string | null
  finalScores: MatchScores | null
  thirdWinner: string | null
  thirdScores: MatchScores | null
  finalOpen: boolean
  thirdOpen: boolean
  anyRemaining: boolean
}

const isRealTeam = (t: string | undefined | null): t is string => !!t && !!TEAMS[t]

// The team that goes through given a (possibly level) knockout scoreline.
export function winnerOf(home: string, away: string, s: MatchScores): string {
  if (s.home == null || s.away == null) return home
  if (s.home > s.away) return home
  if (s.away > s.home) return away
  return s.drawWinner === 'away' ? away : home
}

function advancingTeam(m: KnockoutMatch): string | null {
  if (!m.scores || m.scores.home == null || m.scores.away == null || !m.home || !m.away) return null
  return winnerOf(m.home, m.away, m.scores)
}

export function getRemaining(results: TournamentResults): RemainingInfo {
  const ko = results.knockoutStages
  const sfMatches = ko.sf ?? []
  const empty: RemainingInfo = { valid: false, sf: [], finalWinner: null, finalScores: null, thirdWinner: null, thirdScores: null, finalOpen: false, thirdOpen: false, anyRemaining: false }
  if (sfMatches.length !== 2) return empty
  if (!sfMatches.every(m => isRealTeam(m.home) && isRealTeam(m.away))) return empty

  const sf: SfInfo[] = sfMatches.map(m => ({
    matchNum: m.matchNum,
    teams: [m.home, m.away],
    winner: advancingTeam(m),
    scores: advancingTeam(m) ? m.scores! : null,
  }))

  const finalMatch = ko.final?.[0]
  const thirdMatch = ko.thirdPlace?.[0]
  const finalWinner = finalMatch ? advancingTeam(finalMatch) : null
  const thirdWinner = thirdMatch ? advancingTeam(thirdMatch) : null

  const anyRemaining = sf.some(s => s.winner === null) || finalWinner === null || thirdWinner === null
  return {
    valid: true,
    sf,
    finalWinner,
    finalScores: finalWinner ? finalMatch!.scores! : null,
    thirdWinner,
    thirdScores: thirdWinner ? thirdMatch!.scores! : null,
    finalOpen: finalWinner === null,
    thirdOpen: thirdWinner === null,
    anyRemaining,
  }
}

export const sfLoser = (s: SfInfo, winner: string): string => (s.teams[0] === winner ? s.teams[1] : s.teams[0])

// ─── golden boot ─────────────────────────────────────────────────────────────
//
// The boot pays +10 to everyone who picked the tournament's top scorer. It isn't
// pinned by any match result (it hinges on who scores), so we treat the winner as a
// separate scenario axis: the UI picks a projected winner (default = current leader),
// and reachability sweeps every candidate who could still (co-)win. Only *picked*
// scorers can pay anyone — if an unpicked player (e.g. Messi) wins, nobody gets it,
// which is the `null` candidate.

export interface BootOption {
  name: string
  goals: number
  picked: boolean // a participant chose them → winning pays their backers +10
  alive: boolean // their national team is still playing (can add goals)
}

export interface BootInfo {
  options: BootOption[] // real contenders for the selector, goals desc
  sweep: (string | null)[] // distinct boot outcomes for reachability: each relevant PICKED name + null (an unpicked leader wins → nobody)
  leader: string | null // current top scorer overall — the default projected winner
  goals: Record<string, number> // current goals for every known contender (for the click-detail)
}

// A chaser can realistically add at most ~2 goals across the final matches, so anyone
// more than this behind the lead is out of the boot race for scoring purposes.
const BOOT_GAP = 2

// The +10 a bettor gets if the projected boot winner is their pick. Kept OUT of
// remainingDelta (which must mirror the points engine, where the bonus is unset until
// the tournament ends) and applied on top wherever we project a final standing. An
// unpicked leader as bootWinner pays nobody (no user has them as a pick) — exactly right.
export function bootBonus(user: User, bootWinner: string | string[] | null): number {
  if (!bootWinner) return 0
  // A tie at the top means several co-winners — the engine pays every tied winner's backers,
  // so a set of names is accepted (any one matching the user's pick earns the +10).
  const winners = Array.isArray(bootWinner) ? bootWinner : [bootWinner]
  return winners.includes(user.topGoalscorer) ? GOLDEN_BOOT_BONUS : 0
}

// Points for the projected boot king's *future* goals: every goal he scores beyond his
// current tally pays each backer POINTS_PER_GOAL (3), exactly like the engine's goalsPoints.
// This is what makes picking a lower-tally player (e.g. Kane behind Mbappé) coherent —
// he only wins by scoring more, and those extra goals earn his backers 3 apiece.
export function bootGoalPoints(user: User, bootWinner: string | null, extraGoals: number): number {
  if (!bootWinner || user.topGoalscorer !== bootWinner || extraGoals <= 0) return 0
  return POINTS_PER_GOAL * extraGoals
}

// Build a *sensible* boot picture: only the players still realistically in the race —
// the current leaders plus alive chasers within reach — including UNPICKED real leaders
// (e.g. Messi) when the live race board is supplied, so "if he wins, nobody gets +10"
// is visible instead of padding the list with irrelevant picks.
export function bootInfo(
  users: User[],
  results: TournamentResults,
  info: RemainingInfo,
  opts?: { race?: Record<string, number>; teamByPlayer?: Record<string, string> },
): BootInfo {
  const picks = new Set(users.map(u => u.topGoalscorer))
  const teamOf = opts?.teamByPlayer ?? (TEAM_BY_PICKED as Record<string, string>)
  const race = opts?.race ?? results.playerGoals ?? {}
  const aliveTeams = new Set(info.sf.flatMap(s => s.teams))

  // Every contender we have a goal count for: the race board (picked + unpicked leaders)
  // when provided, otherwise just the picked scorers.
  const goalsOf: Record<string, number> = { ...race }
  for (const p of picks) if (!(p in goalsOf)) goalsOf[p] = results.playerGoals?.[p] ?? 0

  const names = Object.keys(goalsOf)
  const lead = Math.max(0, ...names.map(n => goalsOf[n] ?? 0))

  const entries: BootOption[] = names.map(name => {
    const team = teamOf[name]
    return { name, goals: goalsOf[name] ?? 0, picked: picks.has(name), alive: !!team && aliveTeams.has(team) }
  })

  // Relevant = still able to (co-)win: at the lead, or within a reachable gap AND still playing.
  const relevant = entries
    .filter(o => o.goals >= lead || (o.alive && o.goals >= lead - BOOT_GAP))
    .sort((a, b) => b.goals - a.goals || (a.picked === b.picked ? 0 : a.picked ? -1 : 1) || a.name.localeCompare(b.name, 'he'))

  const sweep: (string | null)[] = [...relevant.filter(o => o.picked).map(o => o.name), null]
  return { options: relevant, sweep, leader: relevant[0]?.name ?? null, goals: goalsOf }
}

// ─── a fully-specified scenario: the exact scoreline of each remaining match ──

export interface ScenarioScores {
  // oriented to each fixture's own home/away as listed in `info`
  sf: [MatchScores, MatchScores] // by info.sf order
  final: MatchScores // home = SF1 winner, away = SF2 winner
  third: MatchScores // home = SF1 loser, away = SF2 loser
}

export interface ResolvedScenario {
  finalists: [string, string]
  losers: [string, string]
  champion: string
  thirdWinner: string
  matches: { matchNum: number; id: string; home: string; away: string; scores: MatchScores }[]
}

// Turn a set of scorelines into concrete teams (finalists, losers, champion, medal)
// plus the four oriented fixtures ready for scoring.
export function resolveScenario(info: RemainingInfo, sc: ScenarioScores): ResolvedScenario {
  const [a, b] = info.sf
  const w1 = winnerOf(a.teams[0], a.teams[1], sc.sf[0])
  const w2 = winnerOf(b.teams[0], b.teams[1], sc.sf[1])
  const l1 = sfLoser(a, w1)
  const l2 = sfLoser(b, w2)
  const champion = winnerOf(w1, w2, sc.final)
  const thirdWinner = winnerOf(l1, l2, sc.third)
  return {
    finalists: [w1, w2],
    losers: [l1, l2],
    champion,
    thirdWinner,
    matches: [
      { matchNum: a.matchNum, id: String(a.matchNum), home: a.teams[0], away: a.teams[1], scores: sc.sf[0] },
      { matchNum: b.matchNum, id: String(b.matchNum), home: b.teams[0], away: b.teams[1], scores: sc.sf[1] },
      { matchNum: MATCH_NUM.third, id: String(MATCH_NUM.third), home: l1, away: l2, scores: sc.third },
      { matchNum: MATCH_NUM.final, id: String(MATCH_NUM.final), home: w1, away: w2, scores: sc.final },
    ],
  }
}

// ─── base totals (everything already banked, all four remaining matches at 0) ──

export function computeBaseTotals(users: User[], results: TournamentResults): Map<string, number> {
  return new Map(users.map(u => [u.label, computeUserPoints(u, results).total]))
}

// The finalists a bettor backed — the explicit pick, or (mirroring the points engine)
// the two teams sitting in their bracket's final when the pick is absent.
function predictedFinalists(user: User): Set<string> {
  const explicit = user.predictedFinalTeams
  if (explicit && explicit.length) return new Set(explicit)
  const fromBracket = (user.knockoutStages?.final ?? []).flatMap(m => [m.home, m.away]).filter(Boolean) as string[]
  return new Set(fromBracket)
}

// The scoreline points a bettor earns on one resolved fixture: matched to their
// bracket by the two teams meeting (either orientation), then oriented and scored
// exactly as the real engine does.
function scorelinePoints(user: User, m: { matchNum: number; id: string; home: string; away: string; scores: MatchScores }): number {
  const pred = predictedPairing(user.knockoutStages, { matchNum: m.matchNum, home: m.home, away: m.away })
  if (!pred) return 0
  const oriented = orientPrediction(pred, { home: m.home })
  if (!oriented || oriented.home == null) return 0
  return singleMatchPoints(m.id, oriented, m.scores)
}

// The bettor's points from the four remaining matches under a resolved scenario —
// scorelines + finalist עלייה + champion + medal. Added on top of `base` this equals
// computeUserPoints exactly (see scenarios.test.ts).
export function remainingDelta(user: User, r: ResolvedScenario, info: RemainingInfo): number {
  let d = 0
  for (const m of r.matches) d += scorelinePoints(user, m)
  const fp = predictedFinalists(user)
  for (const s of info.sf) {
    if (s.winner !== null) continue // finalist already in base
    const w = r.finalists[info.sf.indexOf(s)]
    if (fp.has(w)) d += OLEH_POINTS.sf
  }
  if (info.finalOpen && user.predictedChampion && user.predictedChampion === r.champion) d += OLEH_POINTS.champion
  if (info.thirdOpen && user.predictedThirdPlaceWinner && user.predictedThirdPlaceWinner === r.thirdWinner) d += OLEH_POINTS.thirdPlaceWinner
  return d
}

export interface ProjectedRow {
  label: string
  pts: number
  bonus: number // points gained from the four remaining matches
  boot: number // projected golden-boot bonus (0 or 10)
  rank: number
}

const byPts = (base: Map<string, number>) => (a: { label: string; pts: number }, b: { label: string; pts: number }) =>
  b.pts - a.pts || (base.get(b.label) ?? 0) - (base.get(a.label) ?? 0) || a.label.localeCompare(b.label, 'he')

export function projectStandings(users: User[], base: Map<string, number>, info: RemainingInfo, sc: ScenarioScores, bootWinner: string | string[] | null = null): ProjectedRow[] {
  const r = resolveScenario(info, sc)
  return users
    .map(u => {
      const bonus = remainingDelta(u, r, info)
      const boot = bootBonus(u, bootWinner)
      return { label: u.label, bonus, boot, pts: (base.get(u.label) ?? 0) + bonus + boot }
    })
    .sort(byPts(base))
    .map((row, i) => ({ ...row, rank: i + 1 }))
}

// Which of the four remaining matches the user has actually pinned down. A locked
// (already-played) match counts as entered. Used for the live, "credit only what's
// decided" table and for clinch detection.
export interface EnteredFlags {
  sf: [boolean, boolean]
  final: boolean
  third: boolean
}

// The points a bettor has banked from the remaining matches *so far* — counting only
// matches whose result is in. An unentered match contributes nothing (no scoreline,
// no עלייה), so with nothing entered this is 0 and the table equals the live standings.
function provisionalDelta(user: User, r: ResolvedScenario, info: RemainingInfo, entered: EnteredFlags): number {
  const [mSf1, mSf2, mThird, mFinal] = r.matches
  let d = 0
  if (entered.sf[0]) d += scorelinePoints(user, mSf1)
  if (entered.sf[1]) d += scorelinePoints(user, mSf2)
  if (entered.third) d += scorelinePoints(user, mThird)
  if (entered.final) d += scorelinePoints(user, mFinal)
  const fp = predictedFinalists(user)
  info.sf.forEach((s, i) => {
    if (s.winner !== null || !entered.sf[i]) return // already banked, or not decided yet
    if (fp.has(r.finalists[i])) d += OLEH_POINTS.sf
  })
  // A champion/medal only counts once both finalists (resp. both losers) are actually known.
  const sfsKnown = info.sf.every((s, i) => s.winner !== null || entered.sf[i])
  if (info.finalOpen && entered.final && sfsKnown && user.predictedChampion === r.champion) d += OLEH_POINTS.champion
  if (info.thirdOpen && entered.third && sfsKnown && user.predictedThirdPlaceWinner === r.thirdWinner) d += OLEH_POINTS.thirdPlaceWinner
  return d
}

// The live table: base + only the points from matches already entered. Updates after
// every single result, not just when all four are in.
// `bootWinner` gets the +10 (null when the projected king can't actually win yet, e.g. a chaser
// whose goals aren't raised high enough). `bootGoalScorer` earns +3 per extra goal regardless of
// winning, since goals score independently of the boot bonus. They differ only in that edge.
export function projectProvisional(users: User[], base: Map<string, number>, info: RemainingInfo, sc: ScenarioScores, entered: EnteredFlags, bootWinner: string | string[] | null = null, bootExtraGoals = 0, bootGoalScorer: string | null = null): ProjectedRow[] {
  const r = resolveScenario(info, sc)
  return users
    .map(u => {
      const bonus = provisionalDelta(u, r, info, entered)
      const boot = bootBonus(u, bootWinner) + bootGoalPoints(u, bootGoalScorer, bootExtraGoals)
      return { label: u.label, bonus, boot, pts: (base.get(u.label) ?? 0) + bonus + boot }
    })
    .sort(byPts(base))
    .map((row, i) => ({ ...row, rank: i + 1 }))
}

// ─── model-based chances (Monte-Carlo over the still-open matches) ───────────
//
// Reachability answers "can X still finish #1?"; this answers "how likely?". We hold
// the entered results fixed and sample the open matches from the app's shared Poisson
// goal model (matchLambdas — the very model behind the odds cards and sim-core), then
// tally how often each bettor lands #1 / top-3. Seeded, so the numbers are stable for
// a given entered scenario and only move when a result is entered.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function samplePoisson(lambda: number, rng: () => number): number {
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= rng()
  } while (p > L)
  return k - 1
}

// One sampled knockout scoreline: Poisson goals from the strength model, with the
// advancer on a level score weighted by each side's scoring rate (as in sim-core).
function sampleKnockout(home: string, away: string, rng: () => number): MatchScores {
  const [lh, la] = matchLambdas(home, away)
  const h = samplePoisson(lh, rng)
  const a = samplePoisson(la, rng)
  if (h === a) return { home: h, away: a, drawWinner: rng() < lh / (lh + la || 1) ? 'home' : 'away' }
  return { home: h, away: a }
}

export interface Chances {
  p1: number // P(finish first)
  p3: number // P(finish top 3)
  p5: number // P(finish top 5)
}

export function simulateChances(
  users: User[],
  base: Map<string, number>,
  info: RemainingInfo,
  sc: ScenarioScores,
  entered: EnteredFlags,
  bootWinner: string | string[] | null = null,
  bootExtraGoals = 0,
  bootGoalScorer: string | null = null,
  n = 2000,
  seed = 0x9e3779b9,
): Map<string, Chances> {
  const [a, b] = info.sf
  const anyOpen = !entered.sf[0] || !entered.sf[1] || !entered.final || !entered.third
  const iters = anyOpen ? n : 1 // fully specified → one deterministic pass is exact
  const rng = mulberry32(seed)
  const cmp = byPts(base)
  const win = new Map<string, number>(users.map(u => [u.label, 0]))
  const t3 = new Map<string, number>(users.map(u => [u.label, 0]))
  const t5 = new Map<string, number>(users.map(u => [u.label, 0]))

  for (let i = 0; i < iters; i++) {
    const s1 = entered.sf[0] ? sc.sf[0] : sampleKnockout(a.teams[0], a.teams[1], rng)
    const s2 = entered.sf[1] ? sc.sf[1] : sampleKnockout(b.teams[0], b.teams[1], rng)
    const w1 = winnerOf(a.teams[0], a.teams[1], s1)
    const l1 = sfLoser(a, w1)
    const w2 = winnerOf(b.teams[0], b.teams[1], s2)
    const l2 = sfLoser(b, w2)
    const sf = entered.final ? sc.final : sampleKnockout(w1, w2, rng)
    const st = entered.third ? sc.third : sampleKnockout(l1, l2, rng)
    const r = resolveScenario(info, { sf: [s1, s2], final: sf, third: st })
    const totals = users
      .map(u => ({ label: u.label, pts: (base.get(u.label) ?? 0) + remainingDelta(u, r, info) + bootBonus(u, bootWinner) + bootGoalPoints(u, bootGoalScorer, bootExtraGoals) }))
      .sort(cmp)
    win.set(totals[0].label, win.get(totals[0].label)! + 1)
    for (let k = 0; k < 5 && k < totals.length; k++) {
      if (k < 3) t3.set(totals[k].label, t3.get(totals[k].label)! + 1)
      t5.set(totals[k].label, t5.get(totals[k].label)! + 1)
    }
  }

  return new Map(users.map(u => [u.label, { p1: win.get(u.label)! / iters, p3: t3.get(u.label)! / iters, p5: t5.get(u.label)! / iters }]))
}

export function baseRanking(users: User[], base: Map<string, number>): Map<string, number> {
  const ranked = users
    .map(u => u.label)
    .sort((a, b) => (base.get(b) ?? 0) - (base.get(a) ?? 0) || a.localeCompare(b, 'he'))
  return new Map(ranked.map((label, i) => [label, i + 1]))
}

// ─── exact reachability over EVERY distinct outcome class ────────────────────

// Synthetic scorelines standing in for "this result, but nobody nailed the exact
// score" — one per result category, with values no bettor would have predicted.
const GENERIC: MatchScores[] = [
  { home: 8, away: 0 }, // home win
  { home: 0, away: 8 }, // away win
  { home: 6, away: 6, drawWinner: 'home' }, // level, home advances
  { home: 6, away: 6, drawWinner: 'away' }, // level, away advances
]

// The full set of *distinct* actual scorelines that matter for one fixture: every
// exact score some bettor predicted (draws expanded to both advancers, since the
// scoreline is a צליפה regardless of who goes through) plus the generic categories.
// Two actual scores with the same (צליפה-set, result, advancer) are equivalent, so this
// enumerates the outcome space exactly.
function meaningfulScores(users: User[], round: number, home: string, away: string, locked: MatchScores | null): MatchScores[] {
  if (locked) return [locked]
  const nonDraw = new Map<string, MatchScores>()
  const draws = new Map<string, { home: number; away: number }>()
  for (const u of users) {
    const pred = predictedPairing(u.knockoutStages, { matchNum: round, home, away })
    if (!pred) continue
    const o = orientPrediction(pred, { home })
    if (!o || o.home == null || o.away == null) continue
    if (o.home === o.away) draws.set(`${o.home}-${o.away}`, { home: o.home, away: o.away })
    else nonDraw.set(`${o.home}-${o.away}`, { home: o.home, away: o.away })
  }
  const out: MatchScores[] = [...nonDraw.values()]
  for (const d of draws.values()) {
    out.push({ ...d, drawWinner: 'home' })
    out.push({ ...d, drawWinner: 'away' })
  }
  out.push(...GENERIC)
  return out
}

export interface ReachStat {
  label: string
  basePts: number
  minRank: number
  maxRank: number
  canWin: boolean
  canTop3: boolean
  canTop5: boolean
  lockedTop3: boolean
  lockedTop5: boolean
}

export interface Reachability {
  leafCount: number
  stats: Map<string, ReachStat>
  contenders: ReachStat[] // can finish #1, best base first
  // A concrete scoreline set + boot winner that lands each bettor at their best (min-rank)
  // finish — powers the "jump to a scenario where X finishes first" shortcuts.
  bestScenario: Map<string, ScenarioScores>
  bestBoot: Map<string, string | null>
}

// `sc`/`entered` (optional) hold already-entered results fixed, so the sweep only spans the
// still-open matches — the cards then narrow as results come in and stay consistent with the
// live table's locks. Omit them (the default) for the unconditional "from scratch" picture.
export function computeReachability(users: User[], base: Map<string, number>, info: RemainingInfo, bootCands: (string | null)[] = [null], sc?: ScenarioScores, entered?: EnteredFlags): Reachability {
  const [a, b] = info.sf
  const fixed = (flag: boolean | undefined, s: MatchScores | undefined): s is MatchScores => !!flag && !!s
  const sf1opts = fixed(entered?.sf[0], sc?.sf[0]) ? [sc!.sf[0]] : meaningfulScores(users, a.matchNum, a.teams[0], a.teams[1], a.scores)
  const sf2opts = fixed(entered?.sf[1], sc?.sf[1]) ? [sc!.sf[1]] : meaningfulScores(users, b.matchNum, b.teams[0], b.teams[1], b.scores)

  const agg = new Map<string, { min: number; max: number }>(users.map(u => [u.label, { min: Infinity, max: -Infinity }]))
  const best = new Map<string, ScenarioScores>()
  const bestBoot = new Map<string, string | null>()
  const cmp = byPts(base)
  const pickOf = new Map(users.map(u => [u.label, u.topGoalscorer]))
  let leaves = 0

  for (const s1 of sf1opts) {
    const w1 = winnerOf(a.teams[0], a.teams[1], s1)
    const l1 = sfLoser(a, w1)
    for (const s2 of sf2opts) {
      const w2 = winnerOf(b.teams[0], b.teams[1], s2)
      const l2 = sfLoser(b, w2)
      const finalOpts = fixed(entered?.final, sc?.final) ? [sc!.final] : meaningfulScores(users, MATCH_NUM.final, w1, w2, info.finalScores)
      const thirdOpts = fixed(entered?.third, sc?.third) ? [sc!.third] : meaningfulScores(users, MATCH_NUM.third, l1, l2, info.thirdScores)
      for (const sf of finalOpts) {
        for (const st of thirdOpts) {
          leaves++
          const leaf: ScenarioScores = { sf: [s1, s2], final: sf, third: st }
          const r = resolveScenario(info, leaf)
          const matchTotals = users.map(u => ({ label: u.label, pts: (base.get(u.label) ?? 0) + remainingDelta(u, r, info) }))
          for (const bw of bootCands) {
            const totals = matchTotals
              .map(t => ({ label: t.label, pts: t.pts + (bw && pickOf.get(t.label) === bw ? GOLDEN_BOOT_BONUS : 0) }))
              .sort(cmp)
            for (let i = 0; i < totals.length; i++) {
              const st2 = agg.get(totals[i].label)!
              const rank = i + 1
              if (rank < st2.min) { st2.min = rank; best.set(totals[i].label, leaf); bestBoot.set(totals[i].label, bw) }
              if (rank > st2.max) st2.max = rank
            }
          }
        }
      }
    }
  }

  const stats = new Map<string, ReachStat>()
  for (const u of users) {
    const g = agg.get(u.label)!
    stats.set(u.label, {
      label: u.label,
      basePts: base.get(u.label) ?? 0,
      minRank: g.min,
      maxRank: g.max,
      canWin: g.min === 1,
      canTop3: g.min <= 3,
      canTop5: g.min <= 5,
      lockedTop3: g.max <= 3,
      lockedTop5: g.max <= 5,
    })
  }
  const contenders = [...stats.values()].filter(s => s.canWin).sort((x, y) => y.basePts - x.basePts)
  return { leafCount: leaves, stats, contenders, bestScenario: best, bestBoot }
}
