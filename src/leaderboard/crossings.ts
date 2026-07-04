import type { KnockoutMatch, KnockoutStages, MatchScores } from '../shared/types'
import { isUnpredicted } from '../shared/types'
import { TEAMS } from '../shared/groups'
import { roundKeyForMatch, isPairing } from '../formView/knockout/koRounds'
import { advancingTeam, singleMatchOutcome, singleMatchPoints } from './points'
import type { MatchOutcome } from './points'

// The knockout rounds this view walks through, in order. Third place is its own
// odd one-off (a single match between the semi losers), but it's still a pairing
// the bettor called, so it gets a tab like the rest.
export type RoundKey = 'r32' | 'r16' | 'qf' | 'sf' | 'thirdPlace' | 'final'

// One side of a crossing: a team the bettor paired into this R32 slot, and
// whether it has already actually reached it (confirmed) or is still a hope.
export interface CrossingTeam {
  team: string
  confirmed: boolean
  // For a team not yet in the slot: the real bracket position it must finish in for
  // this crossing to come true, e.g. "סגנית ו" or "שלישית א/ב/ג". Undefined once the
  // team is confirmed in the slot.
  needsSlot?: string
}

// A "crossing" = one R32 cross-bracket pairing the bettor predicted.
export interface Crossing {
  matchNum: number
  teams: [CrossingTeam, CrossingTeam]
  // Hebrew descriptors of the real bracket slots still open for this crossing,
  // e.g. "מנצח א" or "שלישית א/ב/ג". Empty once both teams are confirmed.
  pendingSlots: string[]
  // The bettor's predicted scoreline for this R32 match, oriented to teams[0]
  // (home) / teams[1] (away). Null when they left the score blank. Used to show
  // "the score you bet" on a locked crossing — the match that will actually happen.
  predicted: { home: number; away: number } | null
  // For a *missed* crossing only: the real team(s) that actually landed in this
  // slot (at least one of which the bettor didn't pick, which is what broke it),
  // so the card can show "what happened instead". Undefined for live crossings.
  actualTeams?: string[]
  // True for a crossing counted as locked because the simulation makes it inevitable
  // (100%) even though the bracket slot isn't formally filled yet — the card flags it
  // with a badge so it reads apart from a pairing whose teams have physically arrived.
  certain?: boolean
  // Set on a locked crossing whose match has *actually been played*, so the card can
  // read as a final result rather than a pending fixture: the real scoreline, who
  // advanced, and how the bettor's own predicted score scored against it. Attached
  // only when a real score for this slot is supplied (see actualScoreByNum).
  result?: CrossingResult
}

// The played outcome of a crossing's match, everything oriented to the *real*
// fixture's home/away so a card can be rendered straight from it. `predHome`/
// `predAway` re-express the bettor's predicted scoreline in that same orientation
// (null when they left it blank); `outcome`/`points` score that prediction against
// the real result exactly like the rest of the app (singleMatchOutcome/Points).
export interface CrossingResult {
  home: string
  away: string
  homeScore: number
  awayScore: number
  advancer: string | null
  predHome: number | null
  predAway: number | null
  outcome: MatchOutcome
  points: number
}

export interface UserCrossings {
  locked: Crossing[]
  potential: Crossing[]
  // Crossings already broken — a confirmed team the bettor didn't pair is in the
  // slot, so this pairing can no longer happen. Kept (not dropped) so the view can
  // account for all of the round's matches, not only the live ones.
  missed: Crossing[]
}

// A pairing the simulation makes inevitable: at/above this probability we treat the
// matchup as already closed, even when the bracket slot is still a placeholder the
// engine hasn't formally filled (e.g. a third-place allocation it waits on all groups
// for). The strict 0.9999 floor keeps a merely-near-certain 99%+ pairing "open".
export const CERTAIN_PROB = 0.9999

// A resolved knockout slot holds a real team name (a TEAMS key); an unresolved
// one holds a Hebrew placeholder like "מנצח א" / "שלישית א/ב/ג".
const isRealTeam = (name: string | null | undefined): name is string =>
  !!name && !!TEAMS[name]

const confirmedCount = (c: Crossing) => c.teams.filter(t => t.confirmed).length

// Is there a real, played scoreline for this match? (An unpredicted placeholder
// score doesn't count — the slot's teams may be set before the match is played.)
const playedScore = (
  matchNum: number,
  actualScoreByNum: Record<number, MatchScores>,
): MatchScores | null => {
  const s = actualScoreByNum[matchNum]
  return s && !isUnpredicted(s) ? s : null
}

// Build the played-outcome record for a *locked* crossing: the real score + who
// advanced (from the real fixture), with the bettor's predicted score re-oriented
// to that fixture and scored against it. `rm` is the real match (both sides real).
function buildCrossingResult(c: Crossing, rm: KnockoutMatch, score: MatchScores): CrossingResult {
  const home = rm.home as string
  const away = rm.away as string
  // c.predicted is oriented to c.teams[0]/[1]; re-express it in rm's home/away.
  let predHome: number | null = null
  let predAway: number | null = null
  if (c.predicted) {
    const sameOrder = c.teams[0].team === home
    predHome = sameOrder ? c.predicted.home : c.predicted.away
    predAway = sameOrder ? c.predicted.away : c.predicted.home
  }
  const predScores: MatchScores | null =
    predHome === null || predAway === null ? null : { home: predHome, away: predAway }
  return {
    home,
    away,
    homeScore: score.home as number,
    awayScore: score.away as number,
    advancer: advancingTeam({ ...rm, scores: score }),
    predHome,
    predAway,
    outcome: predScores ? singleMatchOutcome(predScores, score) : 'miss',
    points: predScores ? singleMatchPoints(String(c.matchNum), predScores, score) : 0,
  }
}

// The played result for a *determined* board pairing (both teams real): real score
// and advancer only — the shared board has no single bettor, so no prediction/points.
function realOnlyResult(matchNum: number, home: string, away: string, score: MatchScores): CrossingResult {
  return {
    home,
    away,
    homeScore: score.home as number,
    awayScore: score.away as number,
    advancer: advancingTeam({ matchNum, home, away, resolved: true, scores: score }),
    predHome: null,
    predAway: null,
    outcome: 'miss',
    points: 0,
  }
}

// Side-agnostic key for a knockout pairing — must match the engine's koPairKey so
// a bettor's pair (in either order) lines up with the simulated matchup counts.
export function crossingPairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

// The simulated probability that a crossing's exact pairing actually happens,
// read from the win-prob engine's per-match pair distribution. Returns null when
// there's no simulation data yet for that match (so the UI can stay quiet while
// the sims run), and 0 when the pairing simply never came up.
export function crossingProbability(
  crossing: Crossing,
  crossingProbByMatch: Record<number, Record<string, number>>,
): number | null {
  const rec = crossingProbByMatch[crossing.matchNum]
  if (!rec) return null
  return rec[crossingPairKey(crossing.teams[0].team, crossing.teams[1].team)] ?? 0
}

// How the crossing's chance breaks down, read straight from the simulation's
// per-match pairing distribution:
//   • reachA / reachB — how often *each* team reaches this match (the share of all
//     simulated pairings at this slot that include it). Each run yields exactly one
//     pairing here, so these are true marginals.
//   • joint — how often the two meet *together* (the crossing itself).
// joint is measured directly, not reachA·reachB: the two teams reaching the same
// slot are dependent events, so a simple product would be wrong.
export interface CrossingBreakdown {
  reachA: number
  reachB: number
  joint: number
}

export function crossingBreakdown(
  crossing: Crossing,
  crossingProbByMatch: Record<number, Record<string, number>>,
): CrossingBreakdown | null {
  const rec = crossingProbByMatch[crossing.matchNum]
  if (!rec) return null
  const a = crossing.teams[0].team
  const b = crossing.teams[1].team
  let reachA = 0
  let reachB = 0
  for (const [key, p] of Object.entries(rec)) {
    const [x, y] = key.split('|')
    if (x === a || y === a) reachA += p
    if (x === b || y === b) reachB += p
  }
  return { reachA, reachB, joint: rec[crossingPairKey(a, b)] ?? 0 }
}


// The minimal shape these helpers need from a bettor: a label and their knockout
// predictions, keyed by round ('r32' | 'r16' | 'qf' | 'sf' | 'final' | ...).
// `User` satisfies it, but keeping it local avoids a heavy import cycle through
// users/index (which pulls in all 26 user modules).
export interface CrossingsBettor {
  label: string
  knockoutStages?: KnockoutStages
}

// Labels of all bettors who predicted the *same* pairing (side-agnostic) in the same
// round as this match — i.e. who else is "in" this crossing. Matched by the pairing
// within the round, NOT by the exact slot: a bettor whose group finishes route the
// two teams into a different R32 slot than reality still called the same meeting, so
// they count. Optionally excludes one label (the viewer).
export function crossingParticipants(
  bettors: CrossingsBettor[],
  matchNum: number,
  teamA: string,
  teamB: string,
  exclude?: string,
): string[] {
  const roundKey = roundKeyForMatch(matchNum)
  if (!roundKey) return []
  const out: string[] = []
  for (const u of bettors) {
    if (u.label === exclude) continue
    const matches = u.knockoutStages?.[roundKey] ?? []
    if (matches.some(m => isPairing(m, teamA, teamB))) {
      out.push(u.label)
    }
  }
  return out
}

// A knockout pairing that's already *determined* (both sides are real teams), plus
// everyone who predicted exactly that pairing. This is the tournament-wide "who
// called it" picture — independent of any selected viewer — for a clear overview
// of all the settled matches.
export interface DeterminedCrossing {
  matchNum: number
  // Both real teams for a settled pairing; a single real team for a `partial` slot
  // (one side has advanced, the opponent's feeder isn't decided yet).
  teams: string[]
  predictors: string[]
  // True when the pairing isn't *formally* in the bracket yet but the simulation
  // makes it inevitable (100%) — a "closed match" the card flags with a badge.
  certain?: boolean
  // True when only ONE side of this slot has a real team so far — the other is still
  // an open placeholder. Emitted so the shared board can still show the team that has
  // already advanced to the next stage, rather than hiding the slot entirely.
  partial?: boolean
  // Real result when this determined pairing has actually been played (real score +
  // advancer). Undefined for partials and for pairings not yet played.
  result?: CrossingResult
}

// The pairing the simulation fixes at 100% for a match, if any — the two teams that
// are guaranteed to meet there even though the bracket slot is still a placeholder.
// Returns the team pair (split from the engine's "a|b" key) or null when nothing is
// certain yet for that match.
function certainPairing(
  matchNum: number,
  crossingProbByMatch: Record<number, Record<string, number>>,
): [string, string] | null {
  const rec = crossingProbByMatch[matchNum]
  if (!rec) return null
  for (const [key, p] of Object.entries(rec)) {
    if (p >= CERTAIN_PROB) {
      const [a, b] = key.split('|')
      if (isRealTeam(a) && isRealTeam(b)) return [a, b]
    }
  }
  return null
}

export function computeDeterminedCrossings(
  bettors: CrossingsBettor[],
  actualMatches: KnockoutMatch[],
  crossingProbByMatch: Record<number, Record<string, number>> = {},
  actualScoreByNum: Record<number, MatchScores> = {},
): DeterminedCrossing[] {
  const out: DeterminedCrossing[] = []
  for (const m of actualMatches) {
    // Formally settled: both teams have actually reached the slot.
    if (isRealTeam(m.home) && isRealTeam(m.away)) {
      const predictors = crossingParticipants(bettors, m.matchNum, m.home, m.away)
        .sort((a, b) => a.localeCompare(b, 'he'))
      const score = playedScore(m.matchNum, actualScoreByNum)
      out.push({
        matchNum: m.matchNum,
        teams: [m.home, m.away],
        predictors,
        ...(score ? { result: realOnlyResult(m.matchNum, m.home, m.away, score) } : {}),
      })
      continue
    }
    // Not formally settled, but the simulation makes one pairing inevitable (100%) —
    // a closed match that just hasn't been written into the bracket yet.
    const certain = certainPairing(m.matchNum, crossingProbByMatch)
    if (certain) {
      const predictors = crossingParticipants(bettors, m.matchNum, certain[0], certain[1])
        .sort((a, b) => a.localeCompare(b, 'he'))
      out.push({ matchNum: m.matchNum, teams: certain, predictors, certain: true })
      continue
    }
    // One side already a real team, the other still open — the team that has already
    // advanced to this stage. Surface it as a partial slot so the board shows it
    // instead of hiding the whole match until both sides are known.
    const solo = isRealTeam(m.home) ? m.home : isRealTeam(m.away) ? m.away : null
    if (solo) {
      out.push({ matchNum: m.matchNum, teams: [solo], predictors: [], partial: true })
    }
  }
  // Consensus first — the pairings the most people called lead the board — then by
  // match number so ties stay in a stable order.
  out.sort((a, b) => b.predictors.length - a.predictors.length || a.matchNum - b.matchNum)
  return out
}

// One bettor's row in the "who'll hit the most" standing for a given knockout
// round: how many pairings are already locked, how many are still in play, and
// the *expected* number called correctly (locked count as 1 each, open ones
// weighted by their simulated chance). Sorting by `expected` gives the ranking.
export interface CrossingStanding {
  label: string
  locked: number
  potential: number
  // Pairings that can no longer happen: already broken (missed) plus open ones the
  // model gives a 0% chance. Tracked so locked + potential + gone covers every
  // match in the round (16 in R32), not just the live ones.
  gone: number
  expected: number
}

// Is an open crossing still on the table? A simulated 0% (once the sims are in)
// rules it out; a null prob means the sims haven't run yet, so we keep it live.
// The single home for "still possible", so every tally applies the same rule.
export function isLiveCrossing(
  crossing: Crossing,
  crossingProbByMatch: Record<number, Record<string, number>>,
): boolean {
  const p = crossingProbability(crossing, crossingProbByMatch)
  return p === null || p > 0
}

export function computeCrossingsLeaderboard(
  bettors: CrossingsBettor[],
  roundKey: RoundKey,
  actualMatches: KnockoutMatch[],
  crossingProbByMatch: Record<number, Record<string, number>>,
): CrossingStanding[] {
  return bettors
    .map(u => {
      const { locked, potential, missed } = computeUserCrossings(u.knockoutStages?.[roundKey] ?? [], actualMatches, crossingProbByMatch)
      const expectedOpen = potential.reduce((s, c) => s + (crossingProbability(c, crossingProbByMatch) ?? 0), 0)
      // Only count open pairings the model still gives a chance — a ruled-out 0%
      // shouldn't inflate the "open" tally.
      const live = potential.filter(c => isLiveCrossing(c, crossingProbByMatch))
      const gone = missed.length + (potential.length - live.length)
      return { label: u.label, locked: locked.length, potential: live.length, gone, expected: locked.length + expectedOpen }
    })
    .sort((a, b) => b.expected - a.expected || b.locked - a.locked || a.label.localeCompare(b.label, 'he'))
}

// Every knockout round that has crossings, in bracket order — the whole span the
// summary walks. (The keys of KnockoutStages, but spelled out so the sum is an
// explicit, stable list rather than whatever order the object happens to expose.)
const SUMMARY_ROUNDS: (keyof KnockoutStages)[] = ['r32', 'r16', 'qf', 'sf', 'thirdPlace', 'final']

// A bettor's crossings at one granularity, split by how settled they are:
//   • played     — the pairing came true and the match has been played
//   • guaranteed — locked in (both teams in the slot / sim-certain), not yet played
//   • possible   — still open, and the sim hasn't ruled it out
// The unit the summary counts, reused for a whole tournament and for a single stage.
export interface CrossingBuckets {
  played: number
  guaranteed: number
  possible: number
}

// One knockout stage's buckets, tagged with its round key — the per-stage breakdown
// a summary row expands to show. Only stages the bettor is involved in are emitted,
// in bracket order.
export interface CrossingSummaryStage extends CrossingBuckets {
  key: keyof KnockoutStages
}

// One bettor's tournament-wide crossings involvement as the per-stage breakdown, in
// bracket order. The whole-tournament totals aren't stored here — they're a fold over
// `byStage` (see summaryTotals), so the headline can never drift from the detail.
export interface CrossingSummaryStanding {
  label: string
  byStage: CrossingSummaryStage[]
}

const emptyBuckets = (): CrossingBuckets => ({ played: 0, guaranteed: 0, possible: 0 })
const bucketsTotal = (b: CrossingBuckets): number => b.played + b.guaranteed + b.possible
const addBuckets = (a: CrossingBuckets, b: CrossingBuckets): CrossingBuckets => ({
  played: a.played + b.played,
  guaranteed: a.guaranteed + b.guaranteed,
  possible: a.possible + b.possible,
})

// The whole-tournament totals for a standing: a plain fold over its per-stage split.
// Derived on demand rather than stored, so there's one source of truth for the row.
export function summaryTotals(standing: CrossingSummaryStanding): CrossingBuckets {
  return standing.byStage.reduce(addBuckets, emptyBuckets())
}

// The field-wide participation data: for every bettor, classify their crossings in
// each round against the real bracket into the three buckets. Uses the same
// computeUserCrossings the per-round view does — locked (both teams in / sim-certain)
// splits into played vs guaranteed by whether the match carries a real score, and an
// open pairing the sim hasn't ruled out is "possible". Pure per-stage data, in
// bracket order — no ranking (that's presentation policy; see rankedCrossingsSummary).
export function computeCrossingsSummary(
  bettors: CrossingsBettor[],
  fullBracket: KnockoutMatch[],
  crossingProbByMatch: Record<number, Record<string, number>> = {},
  actualScoreByNum: Record<number, MatchScores> = {},
): CrossingSummaryStanding[] {
  const matchesByRound = new Map<keyof KnockoutStages, KnockoutMatch[]>()
  for (const m of fullBracket) {
    const key = roundKeyForMatch(m.matchNum)
    if (!key) continue
    const list = matchesByRound.get(key) ?? []
    list.push(m)
    matchesByRound.set(key, list)
  }

  return bettors.map(u => {
    const byStage: CrossingSummaryStage[] = []
    for (const key of SUMMARY_ROUNDS) {
      const actual = matchesByRound.get(key) ?? []
      const userMatches = u.knockoutStages?.[key] ?? []
      const { locked, potential } = computeUserCrossings(userMatches, actual, crossingProbByMatch, actualScoreByNum)
      const buckets: CrossingBuckets = {
        played: locked.filter(c => c.result).length,
        guaranteed: locked.filter(c => !c.result).length,
        possible: potential.filter(c => isLiveCrossing(c, crossingProbByMatch)).length,
      }
      if (bucketsTotal(buckets) > 0) byStage.push({ key, ...buckets })
    }
    return { label: u.label, byStage }
  })
}

// The board's ordering: most guaranteed involvement (played + locked) first, then
// most still-possible, then name. Kept apart from the computation — it's a ranking
// decision the view makes, over data that stands on its own.
export function rankedCrossingsSummary(standings: CrossingSummaryStanding[]): CrossingSummaryStanding[] {
  const guaranteed = (b: CrossingBuckets) => b.played + b.guaranteed
  return [...standings].sort((a, b) => {
    const ta = summaryTotals(a)
    const tb = summaryTotals(b)
    return guaranteed(tb) - guaranteed(ta) || tb.possible - ta.possible || a.label.localeCompare(b.label, 'he')
  })
}

// A bettor's R32 crossings (the cross-bracket pairings they predicted),
// classified against the real bracket as it stands right now:
//   • locked    — both predicted teams have actually reached this R32 slot, so the
//                 crossing is nailed and the bettor's score prediction can earn points.
//   • potential — not yet contradicted: every team already confirmed in the slot is
//                 one the bettor paired, but at least one side is still open (a group
//                 that hasn't finished, or a third-place slot not yet fixed), so the
//                 crossing can still come true.
//   • missed    — already broken: a confirmed team the bettor didn't pair is in the
//                 slot, so this pairing can't happen. Kept (with the teams that
//                 actually landed) so the view can account for every match in the
//                 round, not just the live ones.
function mkTeam(team: string, confirmed: string[], openSlots: string[]): CrossingTeam {
  if (confirmed.includes(team)) return { team, confirmed: true }
  return { team, confirmed: false, needsSlot: openSlots.shift() }
}

export function computeUserCrossings(
  userR32: KnockoutMatch[],
  actualR32: KnockoutMatch[],
  // The simulation's per-match pairing distribution. A crossing the sim makes
  // inevitable (100%) is treated as locked even before its slot is formally filled,
  // so "a closed match is closed" everywhere — your pairings, the shared board, and
  // the standing — without each surface re-deciding it. Empty = no promotion.
  crossingProbByMatch: Record<number, Record<string, number>> = {},
  // Real, played scorelines keyed by match number. When a locked crossing's match
  // has a score here, the crossing gets a `result` (real score + advancer + how the
  // bettor's prediction scored) so the view can render it as a finished match rather
  // than a still-pending fixture. Empty = treat every locked pair as not-yet-played.
  actualScoreByNum: Record<number, MatchScores> = {},
): UserCrossings {
  const locked: Crossing[] = []
  const potential: Crossing[] = []
  const missed: Crossing[] = []

  // Reality's formally-locked R32 pairings, keyed side-agnostically to the real slot
  // they occupy. Scoring (koMatchPoints) credits a predicted pairing wherever its two
  // teams actually meet, not at the slot the bettor routed them through — so a pairing
  // is "locked" the moment both teams meet *anywhere* in the round. We walk the
  // bettor's own pairings (one crossing each) and judge each against reality.
  const lockedByPair = new Map<string, KnockoutMatch>()
  // The real slot each confirmed team has reached, and every slot by match number —
  // built once so judging a pairing below is O(1) lookups rather than rescanning
  // actualR32 three times per bettor pairing. A team is in at most one R32 slot.
  const slotByTeam = new Map<string, KnockoutMatch>()
  const slotByMatchNum = new Map<number, KnockoutMatch>()
  for (const a of actualR32) {
    slotByMatchNum.set(a.matchNum, a)
    if (isRealTeam(a.home)) slotByTeam.set(a.home, a)
    if (isRealTeam(a.away)) slotByTeam.set(a.away, a)
    if (isRealTeam(a.home) && isRealTeam(a.away)) lockedByPair.set(crossingPairKey(a.home, a.away), a)
  }

  for (const um of userR32) {
    // The bettor's own bracket is fully filled, so both teams should be real; guard anyway.
    if (!isRealTeam(um.home) || !isRealTeam(um.away)) continue

    const userTeams = [um.home, um.away] as const
    const userSet = new Set<string>(userTeams)
    const predicted = um.scores && !isUnpredicted(um.scores)
      ? { home: um.scores.home as number, away: um.scores.away as number }
      : null

    // 1) The exact pairing already meets somewhere in reality → locked, keyed to the
    //    real slot it occupies (both teams confirmed there), regardless of the slot
    //    the bettor predicted it in.
    const realLock = lockedByPair.get(crossingPairKey(userTeams[0], userTeams[1]))
    if (realLock) {
      const teams: [CrossingTeam, CrossingTeam] = [
        { team: userTeams[0], confirmed: true },
        { team: userTeams[1], confirmed: true },
      ]
      locked.push({ matchNum: realLock.matchNum, teams, pendingSlots: [], predicted })
      continue
    }

    // 2) Not yet meeting anywhere. Judge the pairing against the real slot one of its
    //    teams has actually reached — NOT the slot the bettor routed it through. Reality
    //    may have routed these two teams to a different R32 slot than the bettor did
    //    (their group finishes differed), so keying off um.matchNum would judge them
    //    against strangers and wrongly break a crossing whose teams are still on track to
    //    meet. Anchoring to where a paired team really landed measures the pairing against
    //    its own future. Fall back to the bettor's slot only when neither team has reached
    //    the round yet (both sides open — nothing to contradict).
    const slot0 = slotByTeam.get(userTeams[0])
    const slot1 = slotByTeam.get(userTeams[1])
    const actual = slot0 ?? slot1 ?? slotByMatchNum.get(um.matchNum)
    if (!actual) continue

    const slots = [actual.home, actual.away]
    const confirmed = slots.filter(isRealTeam)
    const pendingSlots = slots.filter(s => !isRealTeam(s))

    // Hand each still-open predicted team the next unfilled bracket slot, so the
    // card can say exactly what that team needs to finish as. With one side open
    // this is exact; with both open the two slots map to the two teams in order.
    const openSlots = [...pendingSlots]
    const teams: [CrossingTeam, CrossingTeam] = [
      mkTeam(userTeams[0], confirmed, openSlots),
      mkTeam(userTeams[1], confirmed, openSlots),
    ]

    // Broken when a confirmed team in this slot isn't one the bettor paired, or when both
    // of the bettor's teams have already reached the round but in *different* matches — so
    // they can never meet, even if this anchored slot still has an open side.
    const bothReachedApart = !!slot0 && !!slot1 && slot0.matchNum !== slot1.matchNum
    if (bothReachedApart || confirmed.some(t => !userSet.has(t))) {
      missed.push({ matchNum: actual.matchNum, teams, pendingSlots, predicted, actualTeams: confirmed })
      continue
    }

    const crossing: Crossing = { matchNum: actual.matchNum, teams, pendingSlots, predicted }

    if (pendingSlots.length === 0) {
      locked.push(crossing)
    } else {
      // Slot still open, but if the sim makes this exact pairing inevitable (100%),
      // it's a closed match — lock it like the rest, flagged certain for the badge.
      const prob = crossingProbability(crossing, crossingProbByMatch)
      if (prob !== null && prob >= CERTAIN_PROB) locked.push({ ...crossing, certain: true })
      else potential.push(crossing)
    }
  }

  locked.sort((a, b) => a.matchNum - b.matchNum)
  // Most-resolved first: a crossing with one team already in is "hotter" than one
  // still wide open. Stable by matchNum within the same confirmed count.
  potential.sort((a, b) => confirmedCount(b) - confirmedCount(a) || a.matchNum - b.matchNum)
  missed.sort((a, b) => a.matchNum - b.matchNum)

  // Attach a played result to any locked crossing whose real slot has been played.
  // Only real-vs-real slots can be scored (a sim-`certain` pairing whose bracket
  // slot isn't filled has no real fixture yet), so guard on the slot's teams.
  for (const c of locked) {
    const rm = slotByMatchNum.get(c.matchNum)
    if (!rm || !isRealTeam(rm.home) || !isRealTeam(rm.away)) continue
    const score = playedScore(c.matchNum, actualScoreByNum)
    if (score) c.result = buildCrossingResult(c, rm, score)
  }

  return { locked, potential, missed }
}
