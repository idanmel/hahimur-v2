import type { KnockoutMatch, KnockoutStages } from '../shared/types'
import { isUnpredicted } from '../shared/types'
import { TEAMS } from '../shared/groups'

// The knockout rounds this view walks through, in order. (Third place is its own
// odd one-off and isn't part of the "same principle per stage" progression.)
export type RoundKey = 'r32' | 'r16' | 'qf' | 'sf' | 'final'

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

// The matchNum span of each knockout round, so a real-bracket matchNum maps to the
// round it belongs to (mirrors deriveKnockoutStages). A crossing is a *round*-level
// pairing: two teams meeting in the round of 32, regardless of which structural slot
// each bettor's group finishes route them through.
const ROUND_RANGES: { key: keyof KnockoutStages; lo: number; hi: number }[] = [
  { key: 'r32', lo: 73, hi: 88 },
  { key: 'r16', lo: 89, hi: 96 },
  { key: 'qf', lo: 97, hi: 100 },
  { key: 'sf', lo: 101, hi: 102 },
  { key: 'thirdPlace', lo: 103, hi: 103 },
  { key: 'final', lo: 104, hi: 104 },
]

function roundKeyForMatch(matchNum: number): keyof KnockoutStages | undefined {
  return ROUND_RANGES.find(r => matchNum >= r.lo && matchNum <= r.hi)?.key
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
  const key = crossingPairKey(teamA, teamB)
  const roundKey = roundKeyForMatch(matchNum)
  if (!roundKey) return []
  const out: string[] = []
  for (const u of bettors) {
    if (u.label === exclude) continue
    const matches = u.knockoutStages?.[roundKey] ?? []
    if (matches.some(m => isRealTeam(m.home) && isRealTeam(m.away) && crossingPairKey(m.home, m.away) === key)) {
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
  teams: [string, string]
  predictors: string[]
  // True when the pairing isn't *formally* in the bracket yet but the simulation
  // makes it inevitable (100%) — a "closed match" the card flags with a badge.
  certain?: boolean
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
): DeterminedCrossing[] {
  const out: DeterminedCrossing[] = []
  for (const m of actualMatches) {
    // Formally settled: both teams have actually reached the slot.
    if (isRealTeam(m.home) && isRealTeam(m.away)) {
      const predictors = crossingParticipants(bettors, m.matchNum, m.home, m.away)
        .sort((a, b) => a.localeCompare(b, 'he'))
      out.push({ matchNum: m.matchNum, teams: [m.home, m.away], predictors })
      continue
    }
    // Not formally settled, but the simulation makes one pairing inevitable (100%) —
    // a closed match that just hasn't been written into the bracket yet.
    const certain = certainPairing(m.matchNum, crossingProbByMatch)
    if (certain) {
      const predictors = crossingParticipants(bettors, m.matchNum, certain[0], certain[1])
        .sort((a, b) => a.localeCompare(b, 'he'))
      out.push({ matchNum: m.matchNum, teams: certain, predictors, certain: true })
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
      // Only count open pairings the model still gives a chance — a simulated 0%
      // is effectively ruled out, so it shouldn't inflate the "open" tally.
      const live = potential.filter(c => { const p = crossingProbability(c, crossingProbByMatch); return p === null || p > 0 })
      const gone = missed.length + (potential.length - live.length)
      return { label: u.label, locked: locked.length, potential: live.length, gone, expected: locked.length + expectedOpen }
    })
    .sort((a, b) => b.expected - a.expected || b.locked - a.locked || a.label.localeCompare(b.label, 'he'))
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
  for (const a of actualR32) {
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

    // 2) Not yet meeting anywhere — judge the pairing against the bracket slot the
    //    bettor predicted it in (which team is in, what the open side must become).
    const actual = actualR32.find(m => m.matchNum === um.matchNum)
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

    // A confirmed team the bettor didn't pair means this slot's crossing already broke.
    if (confirmed.some(t => !userSet.has(t))) {
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

  return { locked, potential, missed }
}
