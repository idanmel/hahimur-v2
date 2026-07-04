import type { PodiumByAdvancer } from '../../../sim-core'
import { TEAMS } from '../../shared/groups'

// Which finish the "what if" fork reads on. A bettor who's already a lock for the
// top 5 cares about the win; everyone else cares about reaching it — so the view
// picks the metric per viewer and the pick logic stays metric-agnostic.
export type PivotalMetric = 'win' | 'podium'

export interface PivotalOutcome {
  teamHe: string
  // Both finishes are always carried so the fork can show top-5 *and* the win —
  // the race the viewer sweats is only used to rank/order the fixtures.
  podiumPct: number // 0–100, viewer's chance to reach the top 5 if this team advances
  winPct: number // 0–100, viewer's chance to finish first if this team advances
}

export interface PivotalCard {
  matchNum: number
  aHe: string
  bHe: string
  better: PivotalOutcome // the advancer that lifts the viewer more (on the ranking metric)
  worse: PivotalOutcome
  swing: number // gap between the two outcomes on the ranking metric, in percentage points (rounded)
}

// A fixture is a genuine decision point only if it's actually contested (the
// underdog advances in a real share of sims) AND the two outcomes pull the
// viewer's finish apart. This filters out foregone conclusions (a near-certain
// advancer) and games that simply don't matter to this bettor.
const CONTESTED_MIN = 0.12 // underdog advances in ≥12% of sims
const SWING_MIN = 0.03 // outcomes differ by ≥3 percentage points

// Rank the current round's fixtures by how much their outcome swings THIS
// viewer's chosen finish, and return the top few as ready-to-render forks. Pure,
// so the framing is unit-tested without the worker.
export function pickPivotal(matches: PodiumByAdvancer[], metric: PivotalMetric, limit = 2): PivotalCard[] {
  const he = (t: string) => TEAMS[t]?.he ?? t
  const scored: { card: PivotalCard; raw: number }[] = []
  for (const m of matches) {
    const total = m.nA + m.nB
    if (!total || Math.min(m.nA, m.nB) / total < CONTESTED_MIN) continue
    const ifA = metric === 'win' ? m.winIfA : m.podiumIfA
    const ifB = metric === 'win' ? m.winIfB : m.podiumIfB
    const raw = Math.abs(ifA - ifB)
    if (raw < SWING_MIN) continue
    const a: PivotalOutcome = { teamHe: he(m.teamA), podiumPct: m.podiumIfA * 100, winPct: m.winIfA * 100 }
    const b: PivotalOutcome = { teamHe: he(m.teamB), podiumPct: m.podiumIfB * 100, winPct: m.winIfB * 100 }
    const [better, worse] = ifA >= ifB ? [a, b] : [b, a]
    scored.push({
      card: { matchNum: m.matchNum, aHe: he(m.teamA), bHe: he(m.teamB), better, worse, swing: Math.round(raw * 100) },
      raw,
    })
  }
  scored.sort((x, y) => y.raw - x.raw)
  return scored.slice(0, limit).map(s => s.card)
}
