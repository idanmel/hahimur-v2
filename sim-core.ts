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
import { computeUserPoints } from './src/leaderboard/points'
import { TEAM_STRENGTH } from './src/pages/results/teamStrength'
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

// Scorers actually picked by bettors — the only ones whose real goals we track,
// so only these get the banked-goals treatment in the golden-boot model.
const TRACKED_SCORERS = new Set(USERS.map(u => u.topGoalscorer).filter(Boolean))

const BASE = 1.3
const strength = (team: string) => TEAM_STRENGTH[team] ?? { att: 1.0, def: 1.0 }
function lambdas(home: string, away: string): [number, number] {
  const h = strength(home), a = strength(away)
  return [BASE * h.att * a.def, BASE * a.att * h.def]
}
function sampleScore(home: string, away: string): MatchScores {
  const [lh, la] = lambdas(home, away)
  return { home: poisson(lh), away: poisson(la) }
}
function sampleKOScore(home: string, away: string): MatchScores {
  const [lh, la] = lambdas(home, away)
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
  // For *tracked* scorers (the ones bettors picked, whose real goals we record)
  // banked goals carry over and only the team's remaining games are randomized —
  // so a scorer who's already scored (or leading) keeps that edge in both the
  // golden-boot race and the 3-pts-per-goal. Untracked competitors (unpicked
  // stars) keep the full-tournament estimate, since we don't have their real
  // tallies and mustn't deflate the field they compete against.
  const playerGoals: Record<string, number> = {}
  let bootMax = -1, bootWinners: string[] = []
  for (const sc of SCORERS) {
    let goals: number
    if (TRACKED_SCORERS.has(sc.name)) {
      const banked = realGoals[sc.name] ?? 0
      const remaining = Math.max(0, teamGames(sc.team) - (realGames.get(sc.team) ?? 0))
      goals = banked + poisson(sc.ratePerMatch * remaining)
    } else {
      goals = poisson(sc.ratePerMatch * teamGames(sc.team))
    }
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
  series?: Map<string, number[]>
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

export function runSims(played: PredictionsState, n: number, seed: number, collect = false, realGoals: Record<string, number> = {}): SimAgg {
  reseed(seed)
  // Only adjust for banked goals when we actually have them — otherwise keep the
  // original behavior (sample over the full tournament from zero).
  const realGames = Object.keys(realGoals).length ? realGamesByTeam(played) : new Map<string, number>()
  const win = new Map<string, number>(), top3 = new Map<string, number>(), top5 = new Map<string, number>(), sumPts = new Map<string, number>(), sumSq = new Map<string, number>()
  const sumRank = new Map<string, number>()
  const stages = new Map<string, Stages>()
  const champFreq = new Map<string, number>()
  const series = collect ? new Map<string, number[]>() : undefined
  for (const u of USERS) { win.set(u.label, 0); top3.set(u.label, 0); top5.set(u.label, 0); sumPts.set(u.label, 0); sumSq.set(u.label, 0); sumRank.set(u.label, 0); stages.set(u.label, zeroStages()); series?.set(u.label, []) }

  for (let i = 0; i < n; i++) {
    const results = simulateTournament(played, realGoals, realGames)
    if (results.champion) champFreq.set(results.champion, (champFreq.get(results.champion) ?? 0) + 1)
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
    for (let r = 0; r < scored.length && r < 3; r++) top3.set(scored[r].label, top3.get(scored[r].label)! + 1)
    for (let r = 0; r < scored.length && r < 5; r++) top5.set(scored[r].label, top5.get(scored[r].label)! + 1)
    // standard competition ranking (ties share the higher rank: 1,2,2,4…)
    let rank = 1
    for (let r = 0; r < scored.length; r++) {
      if (r > 0 && scored[r].pts !== scored[r - 1].pts) rank = r + 1
      sumRank.set(scored[r].label, sumRank.get(scored[r].label)! + rank)
    }
    for (const s of scored) {
      sumPts.set(s.label, sumPts.get(s.label)! + s.pts)
      sumSq.set(s.label, sumSq.get(s.label)! + s.pts * s.pts)
      series?.get(s.label)!.push(s.pts)
    }
  }
  return { win, top3, top5, sumPts, sumSq, sumRank, stages, champFreq, series }
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

function deepestStage(u: typeof USERS[number], team: string): { rank: number; label: string } {
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

// Plain-Hebrew "why" for the win% move after a played game. Covers every
// scenario that matters to this bettor: a backed team winning, losing but still
// alive, or being knocked out (real eliminations, not the sims) — and the same
// for draws. With no stake the move is purely relative to rivals. Keyed by label.
export function explainMatchForUser(
  u: User,
  home: string, away: string,
  homeScore: number, awayScore: number,
  eliminations?: Map<string, TeamExit>,
): string {
  const isOut = (team: string) => !!eliminations?.has(team)
  const draw = homeScore === awayScore
  const winner = draw ? '' : homeScore > awayScore ? home : away

  // One clause per team the bettor had backed, ordered deepest pick first so the
  // most meaningful swing (e.g. their champion) leads.
  const clause = (team: string): { rank: number; text: string } | null => {
    const d = deepestStage(u, team)
    if (d.rank === 0) return null
    const name = `${he(team)} (${d.label})`
    if (draw) {
      return { rank: d.rank, text: isOut(team) ? `${name} נפלטה בתיקו` : `${name} סיימה בתיקו ועדיין בחיים` }
    }
    if (team === winner) return { rank: d.rank, text: `${name} ניצחה` }
    return { rank: d.rank, text: isOut(team) ? `${name} הודחה מהטורניר` : `${name} הפסידה אך עדיין בחיים` }
  }

  const clauses = [clause(home), clause(away)]
    .filter((c): c is { rank: number; text: string } => c !== null)
    .sort((a, b) => b.rank - a.rank)

  if (!clauses.length) return 'לא בחרת קבוצה מהמשחק — השינוי נובע מההשפעה על היריבים'
  return `מהבחירות שלך: ${clauses.map(c => c.text).join(' · ')}`
}

export function explainLastMatch(
  label: string,
  home: string, away: string,
  homeScore: number, awayScore: number,
  eliminations?: Map<string, TeamExit>,
): string {
  const u = USERS.find(x => x.label === label)
  return u ? explainMatchForUser(u, home, away, homeScore, awayScore, eliminations) : ''
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

export interface BracketSurvival {
  alive: number
  total: number
  out: number
  // The eliminated pick the bettor backed deepest — the most painful bust.
  painful?: { teamHe: string; predictedLabel: string; exitLabel: string }
}

export function bracketSurvival(u: User, exits: Map<string, TeamExit>): BracketSurvival | null {
  const picks = u.predictedR16Teams ?? []
  if (!picks.length) return null
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
    total: picks.length,
    out: picks.length - alive,
    painful: painful
      ? { teamHe: painful.teamHe, predictedLabel: painful.predictedLabel, exitLabel: painful.exitLabel }
      : undefined,
  }
}

export function bracketSurvivalForLabel(label: string, exits: Map<string, TeamExit>): BracketSurvival | null {
  const u = USERS.find(x => x.label === label)
  return u ? bracketSurvival(u, exits) : null
}

// ---- build ranked rows -----------------------------------------------------
export interface StageStat { key: StageKey; label: string; val: number; field: number; edge: number }
export interface Row {
  label: string; winPct: number; top3Pct: number; top5Pct: number; avgPts: number
  std: number; ceiling: number; curRank: number; expRank: number; turkey: string
  championHe: string; championAlive: boolean; scorer: string; reason: string
  stages: StageStat[]
}

export function buildRows(real: SimAgg, n: number, played: PredictionsState, playerGoals?: Record<string, number>): Row[] {
  const cur = currentResults(played, playerGoals)
  const curScores = USERS.map(u => ({ label: u.label, pts: computeUserPoints(u, cur).total }))
    .sort((a, b) => b.pts - a.pts)
  const curRank = new Map(curScores.map((s, i) => [s.label, i + 1]))
  const signals = teamSignals(played)
  const avgWin = 100 / USERS.length

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
    const st = real.stages.get(u.label)!
    const stages: StageStat[] = STAGE_KEYS.map(k => {
      const val = st[k] / n
      return { key: k, label: STAGE_LABEL[k], val, field: fieldStage[k], edge: val - fieldStage[k] }
    })
    return {
      label: u.label, winPct,
      top3Pct: (real.top3.get(u.label)! / n) * 100,
      top5Pct: (real.top5.get(u.label)! / n) * 100,
      avgPts: mean, std, ceiling,
      curRank: curRank.get(u.label)!,
      expRank: real.sumRank.get(u.label)! / n,
      turkey: turkeyDepth(u),
      championHe: u.predictedChampion ? he(u.predictedChampion) : '—',
      championAlive: !u.predictedChampion || (real.champFreq.get(u.predictedChampion) ?? 0) > 0,
      scorer: u.topGoalscorer || '—',
      reason: explain(u, winPct, avgWin, signals),
      stages,
    }
  }).sort((a, b) => b.winPct - a.winPct)
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
