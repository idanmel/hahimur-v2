import { TEAMS } from '../../shared/groups'
import type { KnockoutMatch, KnockoutStages, TournamentResults } from '../../shared/types'
import type { User } from '../../users'
import { eliminatedTeams } from './compareStats'
import { allKO } from '../../formView/knockout/koRounds'

export interface TeamSurvival {
  team: string
  alive: boolean
}

export interface StageSurvival {
  key: string
  label: string
  total: number
  alive: number
  teams: TeamSurvival[]
}

// The stages we surface, in tournament order. Each maps to the user's predicted
// bracket for that round — the teams they sent through to it.
const STAGE_DEFS: { key: keyof KnockoutStages; label: string }[] = [
  { key: 'r32', label: 'שלב ה-32' },
  { key: 'r16', label: 'שמינית גמר' },
  { key: 'qf', label: 'רבע גמר' },
  { key: 'sf', label: 'חצי גמר' },
  { key: 'thirdPlace', label: 'מקום 3-4' },
  { key: 'final', label: 'גמר' },
]

// Distinct real teams appearing in a stage's matches, in slot order. Descriptor
// slots like "סגנית א" (unresolved feeders) are skipped — only named teams count.
function stageTeams(matches: KnockoutMatch[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of matches) {
    for (const slot of [m.home, m.away]) {
      if (slot in TEAMS && !seen.has(slot)) {
        seen.add(slot)
        out.push(slot)
      }
    }
  }
  return out
}

/** Per knockout stage: how many of the teams the user predicted into that stage
 *  are still in the real tournament (not eliminated). Deliberately plain — a count
 *  of "how alive my bracket still is", no odds or probabilities. */
export function buildStageSurvival(user: User, results: TournamentResults): StageSurvival[] {
  const out = eliminatedTeams(results)
  const toSurvival = (team: string): TeamSurvival => ({ team, alive: !out.has(team) })

  const stages: StageSurvival[] = STAGE_DEFS.map(({ key, label }) => {
    const teams = stageTeams(user.knockoutStages[key]).map(toSurvival)
    return { key, label, total: teams.length, alive: teams.filter(t => t.alive).length, teams }
  })

  if (user.predictedChampion) {
    const champ = toSurvival(user.predictedChampion)
    stages.push({ key: 'champion', label: 'אלופה', total: 1, alive: champ.alive ? 1 : 0, teams: [champ] })
  }

  return stages
}

// Two of a bettor's still-alive picks that share a path in the real bracket and so
// can't both reach the stage in question — they have to knock each other out first.
export interface Collision {
  teams: string[]
  // Where their paths first merge, e.g. "שלב 32" / "שמינית".
  roundLabel: string
}

export interface LiveTeamsStanding {
  label: string
  total: number
  alive: number
  // Of the alive picks, the most that can *simultaneously* reach this stage given
  // the real bracket — i.e. alive minus the ones doomed to meet each other first.
  // Equals `alive` when there's no collision.
  reachable: number
  aliveTeams: string[]
  outTeams: string[]
  collisions: Collision[]
}

// Every distinct real team a bettor has riding anywhere in their bracket — across
// all knockout stages plus their predicted champion. Deduplicated, slot order.
function allBracketTeams(user: User): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const add = (slot: string) => {
    if (slot in TEAMS && !seen.has(slot)) {
      seen.add(slot)
      out.push(slot)
    }
  }
  for (const m of allKO(user.knockoutStages)) {
    add(m.home)
    add(m.away)
  }
  if (user.predictedChampion) add(user.predictedChampion)
  return out
}

/** Cross-player board of how many teams each bettor still has in the running.
 *  "Out" here means knocked out on the pitch — a team that simply isn't in the
 *  real bracket yet is still counted alive. Ranked most-alive first, ties broken
 *  alphabetically. */
export function buildLiveTeamsStanding(users: User[], results: TournamentResults): LiveTeamsStanding[] {
  const out = eliminatedTeams(results)
  return users
    .map(user => {
      const teams = allBracketTeams(user)
      const aliveTeams = teams.filter(t => !out.has(t))
      const outTeams = teams.filter(t => out.has(t))
      return {
        label: user.label,
        total: teams.length,
        alive: aliveTeams.length,
        reachable: aliveTeams.length,
        aliveTeams,
        outTeams,
        collisions: [],
      }
    })
    .sort((a, b) => b.alive - a.alive || a.label.localeCompare(b.label, 'he'))
}

// The stages the live-teams board can be sliced by. Each is referenced to that
// player's own form for the stage, so the count is "out of the teams I sent here"
// (the final is X/2, the champion is X/1) — never the whole-bracket total.
export type LiveStageKey = 'r32' | 'r16' | 'qf' | 'sf' | 'thirdPlace' | 'final' | 'champion'

export interface LiveStage {
  key: LiveStageKey
  label: string
  standings: LiveTeamsStanding[]
}

const LIVE_STAGE_DEFS: { key: Exclude<LiveStageKey, 'champion'>; label: string }[] = [
  { key: 'r32', label: 'שלב 32' },
  { key: 'r16', label: 'שמינית' },
  { key: 'qf', label: 'רבע גמר' },
  { key: 'sf', label: 'חצי גמר' },
  { key: 'thirdPlace', label: 'מקום 3-4' },
  { key: 'final', label: 'גמר' },
]

// The real teams a bettor sent into one stage. The champion is a single pick;
// every other stage reads its bracket matches (descriptor slots are skipped).
function teamsForStage(user: User, key: LiveStageKey): string[] {
  if (key === 'champion') {
    const champ = user.predictedChampion
    return champ && champ in TEAMS ? [champ] : []
  }
  return stageTeams(user.knockoutStages[key] ?? [])
}

// ---- Bracket collision model -------------------------------------------------
// The real knockout bracket is a fixed tree (see resolveKnockout): each R32 match's
// winner feeds a known R16 match, then QF, SF and the final. So two teams a bettor
// sent to the same later stage can't *both* arrive if their real paths merge before
// it — they'd have to eliminate each other on the way. We surface that, so "2
// finalists still alive" doesn't mislead when those two actually meet back in the
// round of 32.

// matchNum → the match its winner advances into, one rung up the bracket.
const PARENT_MATCH: Record<number, number> = {
  73: 90, 75: 90, 74: 89, 77: 89, 76: 91, 78: 91, 79: 92, 80: 92,
  83: 93, 84: 93, 81: 94, 82: 94, 86: 95, 88: 95, 85: 96, 87: 96,
  89: 97, 90: 97, 93: 98, 94: 98, 91: 99, 92: 99, 95: 100, 96: 100,
  97: 101, 98: 101, 99: 102, 100: 102,
  101: 104, 102: 104,
}

// Round index of a knockout match number (r32=0 … final=4). The third-place match
// (103) sits in the final tier since its entrants are settled by the semis.
export function roundOfMatch(n: number): number {
  if (n <= 88) return 0
  if (n <= 96) return 1
  if (n <= 100) return 2
  if (n <= 102) return 3
  return 4
}

// Walk a team's R32 match up the bracket to its ancestor match at `round`.
export function ancestorAt(r32Match: number, round: number): number {
  let cur = r32Match
  while (roundOfMatch(cur) < round && PARENT_MATCH[cur] != null) cur = PARENT_MATCH[cur]
  return cur
}

// The round where a set of teams' paths first converge (their lowest common
// ancestor) — the round in which they'd actually meet. Used to phrase the warning.
export function convergeRound(r32Matches: number[]): number {
  for (let r = 0; r <= 4; r++) {
    const anc = r32Matches.map(m => ancestorAt(m, r))
    if (anc.every(a => a === anc[0])) return r
  }
  return 4
}

const ROUND_LABEL = ['שלב 32', 'שמינית', 'רבע גמר', 'חצי גמר', 'גמר']

// The round just *before* a stage: alive picks sharing a bracket slot at this round
// can't both reach the stage. R32 (the first knockout round) and the champion pick
// have no such barrier. Third place mirrors the final — its two entrants are the
// two losing semi-finalists, one from each half of the draw.
const STAGE_BARRIER: Partial<Record<LiveStageKey, number>> = {
  r16: 0, qf: 1, sf: 2, thirdPlace: 3, final: 3,
}

// team name → the R32 match it sits in within the *real* bracket. Built from the
// resolved round-of-32 fixtures (a team keeps its R32 leaf even after advancing).
export function teamR32Map(bracket: KnockoutMatch[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const match of bracket) {
    if (match.matchNum < 73 || match.matchNum > 88) continue
    for (const slot of [match.home, match.away]) if (slot in TEAMS) m.set(slot, match.matchNum)
  }
  return m
}

// Of a bettor's still-alive picks for a stage, how many can simultaneously reach it,
// and which ones are doomed to collide first. Teams with no known real R32 slot get
// a unique slot each, so an unresolved bracket never invents a collision.
function reachability(
  aliveTeams: string[],
  key: LiveStageKey,
  teamR32: Map<string, number>,
): { reachable: number; collisions: Collision[] } {
  const barrier = STAGE_BARRIER[key]
  if (barrier == null) return { reachable: aliveTeams.length, collisions: [] }

  const groups = new Map<string, string[]>()
  let unknown = 0
  for (const t of aliveTeams) {
    const r32 = teamR32.get(t)
    const slot = r32 == null ? `?${unknown++}` : String(ancestorAt(r32, barrier))
    groups.set(slot, [...(groups.get(slot) ?? []), t])
  }

  const collisions: Collision[] = []
  for (const teams of groups.values()) {
    if (teams.length < 2) continue
    const r32s = teams.map(t => teamR32.get(t)).filter((n): n is number => n != null)
    const round = r32s.length === teams.length ? convergeRound(r32s) : barrier
    collisions.push({ teams, roundLabel: ROUND_LABEL[round] })
  }
  return { reachable: groups.size, collisions }
}

function stageStanding(
  users: User[],
  out: Set<string>,
  teamR32: Map<string, number>,
  key: LiveStageKey,
  label: string,
): LiveStage {
  const standings = users
    .map(user => {
      const teams = teamsForStage(user, key)
      const aliveTeams = teams.filter(t => !out.has(t))
      const outTeams = teams.filter(t => out.has(t))
      const { reachable, collisions } = reachability(aliveTeams, key, teamR32)
      return { label: user.label, total: teams.length, alive: aliveTeams.length, reachable, aliveTeams, outTeams, collisions }
    })
    // Rank by how many can *actually* still get here (reachable), so two finalists
    // bound to meet don't outrank one clean finalist. Alive then name break ties.
    .sort((a, b) => b.reachable - a.reachable || b.alive - a.alive || a.label.localeCompare(b.label, 'he'))
  return { key, label, standings }
}

/** Per-stage live-teams boards: for each knockout stage (plus the 3rd-place match
 *  and the champion pick), how many of the teams each bettor sent *into that stage*
 *  are still in the real tournament — and, given the real bracket, how many can
 *  still actually reach it (picks doomed to meet each other are flagged). Pass the
 *  real bracket to enable collision detection; omit it and reachable == alive. */
export function buildLiveStages(
  users: User[],
  results: TournamentResults,
  bracket: KnockoutMatch[] = [],
): LiveStage[] {
  const out = eliminatedTeams(results)
  const teamR32 = teamR32Map(bracket)
  const stages = LIVE_STAGE_DEFS.map(d => stageStanding(users, out, teamR32, d.key, d.label))
  stages.push(stageStanding(users, out, teamR32, 'champion', 'אלופה'))
  return stages
}
