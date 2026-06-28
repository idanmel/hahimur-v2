import type { KnockoutMatch, MatchScores } from '../../shared/types'
import type { User } from '../../users/index'
import { predictedPairing, orientPrediction } from '../../formView/knockout/koRounds'

// A bettor "participates" in a knockout match when they predicted both teams that
// actually reached it — matched by pairing within the round, not bracket slot.
// Returns their called score oriented to the real fixture's home/away, or null if
// they're not in this match.
export function knockoutParticipantScore(actualMatch: KnockoutMatch, user: User): MatchScores | null {
  if (!actualMatch.resolved) return null
  const um = predictedPairing(user.knockoutStages, actualMatch)
  if (!um || !um.resolved) return null
  return orientPrediction(um, actualMatch)
}
