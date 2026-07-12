import { matchLambdas } from './lambdas'
import { TEAM_STRENGTH } from '../pages/results/teamStrength'

// Analytic, closed-form odds for a single fixture from the shared Poisson model —
// no Monte-Carlo needed. With goal counts independent and ~Poisson(λh)/Poisson(λa),
// we sum the joint pmf over a score grid to read off win/draw/win. A 10-a-side
// grid captures essentially all the mass for football λ's (well under 3), and we
// renormalise the tiny tail beyond it so the three always sum to 1.
//
// The market blend lives one layer down, in matchLambdas: fixtures with bookmaker
// lines already arrive here as market-calibrated λ's. So the card is just a pure
// read of the shared λ's — the very same numbers the Monte-Carlo engine samples
// from — and the card can never disagree with the win-probability board.
const MAX_GOALS = 10

function poissonPmf(lambda: number, k: number): number {
  let p = Math.exp(-lambda) // e^-λ · λ^k / k!
  for (let i = 1; i <= k; i++) p = (p * lambda) / i
  return p
}

export interface MatchOdds {
  homeWin: number
  draw: number
  awayWin: number
}

// P(home win) / P(draw) / P(away win) in regulation (90'), read straight off the
// shared λ's. For a fixture with bookmaker lines those λ's are already market-
// calibrated (see lambdas.ts), so the card reflects the market without a second
// blend here. Both teams must be known real sides; caller guards placeholders.
export function matchOutcomeOdds(home: string, away: string): MatchOdds {
  const [lh, la] = matchLambdas(home, away)
  const hp: number[] = [], ap: number[] = []
  for (let k = 0; k <= MAX_GOALS; k++) { hp.push(poissonPmf(lh, k)); ap.push(poissonPmf(la, k)) }
  let homeWin = 0, draw = 0, awayWin = 0
  for (let h = 0; h <= MAX_GOALS; h++)
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = hp[h] * ap[a]
      if (h > a) homeWin += p
      else if (h === a) draw += p
      else awayWin += p
    }
  const total = homeWin + draw + awayWin || 1
  return { homeWin: homeWin / total, draw: draw / total, awayWin: awayWin / total }
}

// P(each side advances) for a knockout tie. A regulation draw goes to ET/pens,
// which the engine breaks in proportion to attacking rate (lh/(lh+la)) — the exact
// rule sampleKOScore uses — so the card and the simulation agree on who goes
// through. The λ's already carry any market calibration.
export function advanceOdds(home: string, away: string): { home: number; away: number } {
  const [lh, la] = matchLambdas(home, away)
  const { homeWin, draw, awayWin } = matchOutcomeOdds(home, away)
  const homeShare = lh + la > 0 ? lh / (lh + la) : 0.5
  return {
    home: homeWin + draw * homeShare,
    away: awayWin + draw * (1 - homeShare),
  }
}

// Whether we can quote odds at all: both slots must resolve to rated teams. A
// knockout fixture whose feeders are still open carries placeholder labels
// ("מנצח 74"), which have no strength — then we show nothing rather than a
// misleading 50/50.
export function hasOdds(home: string, away: string): boolean {
  return !!TEAM_STRENGTH[home] && !!TEAM_STRENGTH[away]
}
