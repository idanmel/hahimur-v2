import type { KnockoutMatch, KnockoutStages, MatchScores } from '../../shared/types'

// The matchNum span of each knockout round, in bracket order. The single source of
// truth for "which round does this real-bracket match number belong to" — used both
// to split the flat bracket into stages (deriveKnockoutStages) and to match a
// bettor's prediction to a real fixture by pairing within the round (predictedPairing).
export const KO_ROUND_RANGES: { key: keyof KnockoutStages; lo: number; hi: number }[] = [
  { key: 'r32', lo: 73, hi: 88 },
  { key: 'r16', lo: 89, hi: 96 },
  { key: 'qf', lo: 97, hi: 100 },
  { key: 'sf', lo: 101, hi: 102 },
  { key: 'thirdPlace', lo: 103, hi: 103 },
  { key: 'final', lo: 104, hi: 104 },
]

export function roundKeyForMatch(matchNum: number): keyof KnockoutStages | undefined {
  return KO_ROUND_RANGES.find(r => matchNum >= r.lo && matchNum <= r.hi)?.key
}

// Every knockout fixture across all rounds, flattened in bracket order. The one
// flattener every "walk the whole bracket" surface shares (per-match leaderboard,
// match lookup, knocked-out teams, bracket-team sweeps).
export function allKO(stages: KnockoutStages): KnockoutMatch[] {
  return [...stages.r32, ...stages.r16, ...stages.qf, ...stages.sf, ...stages.thirdPlace, ...stages.final]
}

// Advancing team of a knockout match, by goals then the penalty winner
// (drawWinner). Null when the score isn't filled in (or a draw's winner isn't) —
// so truthiness doubles as "this fixture is decided"; `m.resolved` can't say that,
// it only means both team slots are known. Shared by the predicted-matchup compare
// (a bettor's own pick) and the real-result elimination sweeps — same rule,
// different sources.
export function koAdvancer(m: KnockoutMatch): string | null {
  if (!m.scores) return null
  const { home, away, drawWinner } = m.scores
  if (home == null || away == null) return null
  if (home > away) return m.home
  if (away > home) return m.away
  if (drawWinner === 'home') return m.home
  if (drawWinner === 'away') return m.away
  return null
}

// Whether a predicted fixture is the pairing {teamA, teamB}, in either orientation.
// Empty slots (an unfilled bracket placeholder) never match.
export function isPairing(m: KnockoutMatch, teamA: string, teamB: string): boolean {
  return !!m.home && !!m.away &&
    (m.home === teamA || m.home === teamB) &&
    (m.away === teamA || m.away === teamB)
}

// The bettor's predicted fixture for an actual knockout match, matched by the two
// teams meeting within the *same round* (either order) — NOT by the exact bracket
// slot. KO scoring credits a pairing wherever its two teams meet, so a bettor whose
// group finishes routed the pair into a different slot of the same round still called
// this meeting. Undefined when they didn't predict it (or the round is unknown).
//
// This is the one matcher every "did this bettor call this fixture?" surface shares —
// the distribution, the per-match leaderboard, the crossings view, and the R32
// participation count — so they can't drift back to slot-based matching independently.
export function predictedPairing(
  stages: KnockoutStages | undefined,
  actualMatch: Pick<KnockoutMatch, 'matchNum' | 'home' | 'away'>,
): KnockoutMatch | undefined {
  if (!stages || !actualMatch.home || !actualMatch.away) return undefined
  const key = roundKeyForMatch(actualMatch.matchNum)
  if (!key) return undefined
  return stages[key].find(m => isPairing(m, actualMatch.home, actualMatch.away))
}

// Re-express a bettor's predicted score in the actual fixture's home/away terms,
// flipping the scoreline (and penalty winner) when they listed the same pairing
// reversed. Null when the prediction carries no score. Assumes `predicted` is
// already known to be the same pairing as `actual` (e.g. found via predictedPairing
// / isPairing), so `predicted.home` is one of the actual fixture's two teams.
export function orientPrediction(
  predicted: KnockoutMatch,
  actual: Pick<KnockoutMatch, 'home'>,
): MatchScores | null {
  const sc = predicted.scores
  if (!sc) return null
  if (predicted.home === actual.home) return sc
  return {
    home: sc.away,
    away: sc.home,
    drawWinner: sc.drawWinner === 'home' ? 'away' : sc.drawWinner === 'away' ? 'home' : undefined,
  }
}
