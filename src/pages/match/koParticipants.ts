import type { KnockoutMatch, MatchScores } from '../../shared/types'
import type { User } from '../../users/index'
import { predictedPairing } from '../../formView/knockout/koRounds'

// Re-express a bettor's predicted score in the real match's home/away terms, so
// someone who stored the two teams reversed still reads in the same orientation
// as the page — the penalty winner flips sides along with the score.
export function orientToActual(actualMatch: KnockoutMatch, predicted: KnockoutMatch): MatchScores | null {
  const sc = predicted.scores
  if (!sc) return null
  if (predicted.home === actualMatch.home) return sc
  return {
    home: sc.away,
    away: sc.home,
    drawWinner: sc.drawWinner === 'home' ? 'away' : sc.drawWinner === 'away' ? 'home' : undefined,
  }
}

// A bettor "participates" in a knockout match when they predicted both teams that
// actually reached it — matched by pairing within the round, not bracket slot.
// Returns their called score oriented to the real fixture's home/away, or null if
// they're not in this match.
export function knockoutParticipantScore(actualMatch: KnockoutMatch, user: User): MatchScores | null {
  if (!actualMatch.resolved) return null
  const um = predictedPairing(user.knockoutStages, actualMatch)
  if (!um || !um.resolved) return null
  return orientToActual(actualMatch, um)
}
