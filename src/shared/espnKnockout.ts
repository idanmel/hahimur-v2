import type { MatchScores } from './types'

// A slimmed ESPN summary competitor: header.competitions[0].competitors[]. Unlike
// the scoreboard list (which returns the after-ET `score` and null linescores), the
// per-event summary carries per-period linescores, which is the only place the 90'
// regulation score is recoverable for a knockout match.
export interface EspnKnockoutCompetitor {
  homeAway: 'home' | 'away'
  winner: boolean
  linescores: { displayValue: string }[]
}

export interface ExtractedKnockout {
  // Regulation (90') score. drawWinner names the advancer when regulation ended
  // level — i.e. the match was decided in extra time or on penalties.
  scores: MatchScores
  decidedBy: 'reg' | 'et' | 'pens'
}

function toInt(ls: { displayValue: string } | undefined): number {
  const n = parseInt(ls?.displayValue ?? '', 10)
  return Number.isNaN(n) ? 0 : n
}

// Periods are [1st half, 2nd half, ET1, ET2, shootout]; a match carries only as
// many as it played, so the count tells us how it was decided. The regulation
// score — the only thing a KO prediction is judged against — is always the first
// two periods, never the after-ET aggregate.
export function extractEspnKnockoutResult(
  competitors: EspnKnockoutCompetitor[],
): ExtractedKnockout | null {
  const home = competitors.find(c => c.homeAway === 'home')
  const away = competitors.find(c => c.homeAway === 'away')
  if (!home || !away) return null

  const periods = Math.max(home.linescores.length, away.linescores.length)
  if (periods < 2) return null // 90' score not known yet

  const regHome = toInt(home.linescores[0]) + toInt(home.linescores[1])
  const regAway = toInt(away.linescores[0]) + toInt(away.linescores[1])
  const decidedBy = periods >= 5 ? 'pens' : periods >= 3 ? 'et' : 'reg'

  const scores: MatchScores = { home: regHome, away: regAway }
  // A match only goes past 90' when regulation is level, so the advancer is the
  // drawWinner exactly in the ET/penalty cases.
  if (regHome === regAway) scores.drawWinner = home.winner ? 'home' : 'away'

  return { scores, decidedBy }
}
