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
}

export interface UserCrossings {
  locked: Crossing[]
  potential: Crossing[]
  // Crossings already broken — a confirmed team the bettor didn't pair is in the
  // slot, so this pairing can no longer happen. Kept (not dropped) so the view can
  // account for all of the round's matches, not only the live ones.
  missed: Crossing[]
}

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

// The bettor's predicted match at this number, searched across every knockout
// round so callers don't have to know which round a matchNum belongs to.
function userKoMatch(u: CrossingsBettor, matchNum: number): KnockoutMatch | undefined {
  const ks = u.knockoutStages
  if (!ks) return undefined
  for (const arr of Object.values(ks) as KnockoutMatch[][]) {
    const m = arr?.find(x => x.matchNum === matchNum)
    if (m) return m
  }
  return undefined
}

// Labels of all bettors who predicted the *same* pairing (side-agnostic) at this
// knockout match — i.e. who else is "in" this crossing. Optionally excludes one
// label (the viewer), so the card can say "N other people also called it".
export function crossingParticipants(
  bettors: CrossingsBettor[],
  matchNum: number,
  teamA: string,
  teamB: string,
  exclude?: string,
): string[] {
  const key = crossingPairKey(teamA, teamB)
  const out: string[] = []
  for (const u of bettors) {
    if (u.label === exclude) continue
    const m = userKoMatch(u, matchNum)
    if (m && isRealTeam(m.home) && isRealTeam(m.away) && crossingPairKey(m.home, m.away) === key) out.push(u.label)
  }
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
      const { locked, potential, missed } = computeUserCrossings(u.knockoutStages?.[roundKey] ?? [], actualMatches)
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
): UserCrossings {
  const locked: Crossing[] = []
  const potential: Crossing[] = []
  const missed: Crossing[] = []

  for (const actual of actualR32) {
    const um = userR32.find(m => m.matchNum === actual.matchNum)
    // The bettor's own bracket is fully filled, so both teams should be real; guard anyway.
    if (!um || !isRealTeam(um.home) || !isRealTeam(um.away)) continue

    const userTeams = [um.home, um.away] as const
    const userSet = new Set<string>(userTeams)

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
    const predicted = um.scores && !isUnpredicted(um.scores)
      ? { home: um.scores.home as number, away: um.scores.away as number }
      : null

    // A confirmed team the bettor didn't pair means the crossing already broke.
    if (confirmed.some(t => !userSet.has(t))) {
      missed.push({ matchNum: actual.matchNum, teams, pendingSlots, predicted, actualTeams: confirmed })
      continue
    }

    const crossing: Crossing = { matchNum: actual.matchNum, teams, pendingSlots, predicted }

    if (pendingSlots.length === 0) locked.push(crossing)
    else potential.push(crossing)
  }

  locked.sort((a, b) => a.matchNum - b.matchNum)
  // Most-resolved first: a crossing with one team already in is "hotter" than one
  // still wide open. Stable by matchNum within the same confirmed count.
  potential.sort((a, b) => confirmedCount(b) - confirmedCount(a) || a.matchNum - b.matchNum)
  missed.sort((a, b) => a.matchNum - b.matchNum)

  return { locked, potential, missed }
}
