// Real bookmaker money-line odds for specific fixtures, so the model can lean on
// the market — which folds in current form, injuries, lineups and matchup dynamics
// that a season-long Elo prior misses — rather than Elo alone. Elo rates Spain the
// #1 side and hence a slight favourite over France, but every major book has France
// favoured for the 14 Jul 2026 semifinal; the market is folded straight into the
// shared goal model (see the λ calibration in lambdas.ts) so EVERYTHING downstream —
// the per-match card odds AND the Monte-Carlo win/top-3/champion numbers — agrees
// with what people see on the betting sites, from one basis.
//
// Odds below are American money lines from FanDuel (reported by CBS Sports / Sports
// Illustrated / The Athletic / FOX Sports); each line notes its snapshot date.
// Extend this table by hand as books post lines for later fixtures — the final and
// third-place playoff have no lines yet because their teams aren't known. We de-vig
// (normalise the implied probabilities to sum to 1) so these are true
// probabilities, not the book's margin-inflated prices.

// How much weight the real betting market gets when a fixture has posted lines. The
// market folds in current form, injuries and lineups a season-long Elo prior misses,
// so we lean on it — but keep the model in the mix so no single book's number fully
// drives the basis. Fixtures with no line stay pure model.
export const MARKET_WEIGHT = 0.65

export interface OutcomeProbs {
  homeWin: number
  draw: number
  awayWin: number
}

// `teams[0]` is treated as "home" for the odds in this record, `teams[1]` as
// "away". The lookup mirrors them when a caller asks in the opposite order.
interface MarketLine {
  teams: [string, string]
  // 3-way regulation (90') money line.
  outcome: { home: number; draw: number; away: number }
  // To-advance money line (accounts for extra time / penalties).
  advance: { home: number; away: number }
}

const MARKET_LINES: MarketLine[] = [
  {
    // WC2026 semifinal 1 · 14 Jul, Arlington (10 Jul snapshot). France +135 /
    // draw +210 / Spain +220; to advance France -144, Spain +118.
    teams: ['France', 'Spain'],
    outcome: { home: 135, draw: 210, away: 220 },
    advance: { home: -144, away: 118 },
  },
  {
    // WC2026 semifinal 2 · 15 Jul, Atlanta (12 Jul snapshot). England +170 /
    // draw +200 / Argentina +185; to advance England -114, Argentina -106.
    teams: ['England', 'Argentina'],
    outcome: { home: 170, draw: 200, away: 185 },
    advance: { home: -114, away: -106 },
  },
]

function lineFor(home: string, away: string): { line: MarketLine; flip: boolean } | null {
  for (const line of MARKET_LINES) {
    if (line.teams[0] === home && line.teams[1] === away) return { line, flip: false }
    if (line.teams[0] === away && line.teams[1] === home) return { line, flip: true }
  }
  return null
}

// American money-line odds → implied win probability (before de-vigging).
//   +150 → 100/250 = 0.40   |   -200 → 200/300 = 0.667
export function americanToImplied(odds: number): number {
  return odds >= 0 ? 100 / (odds + 100) : -odds / (-odds + 100)
}

// De-vigged 3-way market probabilities for a fixture, oriented to the requested
// home/away, or null when no line is on file.
export function marketOutcomeOdds(home: string, away: string): OutcomeProbs | null {
  const found = lineFor(home, away)
  if (!found) return null
  const { line, flip } = found
  const h = americanToImplied(line.outcome.home)
  const d = americanToImplied(line.outcome.draw)
  const a = americanToImplied(line.outcome.away)
  const total = h + d + a || 1
  return {
    homeWin: (flip ? a : h) / total,
    draw: d / total,
    awayWin: (flip ? h : a) / total,
  }
}

// De-vigged to-advance market probabilities, oriented to home/away, or null.
export function marketAdvanceOdds(home: string, away: string): { home: number; away: number } | null {
  const found = lineFor(home, away)
  if (!found) return null
  const { line, flip } = found
  const h = americanToImplied(line.advance.home)
  const a = americanToImplied(line.advance.away)
  const total = h + a || 1
  return {
    home: (flip ? a : h) / total,
    away: (flip ? h : a) / total,
  }
}

// Whether we have real bookmaker lines for this fixture (either order).
export function hasMarketLine(home: string, away: string): boolean {
  return lineFor(home, away) !== null
}
