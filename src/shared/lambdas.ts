import { TEAM_STRENGTH } from '../pages/results/teamStrength'

// The Poisson goal-rate model, shared by the Monte-Carlo engine (sim-core) and
// the per-match odds shown on the cards, so the two can never disagree: a side's
// expected goals is λ = BASE × attacker.att × defender.def, with a light host
// edge for the 2026 co-hosts. Single source — change the football here once.
export const BASE = 1.3
const strength = (team: string) => TEAM_STRENGTH[team] ?? { att: 1.0, def: 1.0 }

// Host-nation edge. The 2026 hosts play on home soil (crowd, no travel,
// familiarity), an advantage the Elo priors — built from mostly-neutral and
// mixed-venue history — don't capture. World Cup home advantage is real but
// smaller and streakier than club football, so we keep it light: a host scores
// ~10% more and concedes ~8% fewer. Applied to the host regardless of nominal
// home/away; cancels out when both sides are hosts.
export const HOST_TEAMS = new Set(['United States', 'Mexico', 'Canada'])
export const HOST_ATT = 1.10
export const HOST_DEF = 0.92

// Expected goals [home, away] for a fixture, before any random draw.
export function matchLambdas(home: string, away: string): [number, number] {
  const h = strength(home), a = strength(away)
  let lh = BASE * h.att * a.def
  let la = BASE * a.att * h.def
  const homeHost = HOST_TEAMS.has(home), awayHost = HOST_TEAMS.has(away)
  if (homeHost && !awayHost) { lh *= HOST_ATT; la *= HOST_DEF }
  else if (awayHost && !homeHost) { la *= HOST_ATT; lh *= HOST_DEF }
  return [lh, la]
}
