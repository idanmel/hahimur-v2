import type { KnockoutMatch, KnockoutStages, MatchScores, PredictionsState } from '../../shared/types'
import { buildKnockoutBracket } from './knockout'
import { KO_ROUND_RANGES } from './koRounds'

// Build the real knockout bracket from the entered group results AND the entered
// knockout results. The group scores resolve the R32 teams; the koScores resolve
// who advances into R16 and beyond (via the bracket's outcomeOf), and are overlaid
// onto each fixture as its `scores` so the match page and leaderboard can read them.
//
// koScores is keyed by matchNum (e.g. '73'); group predictions are keyed by match
// id (e.g. 'A1'). buildKnockoutBracket consumes both from one flat map.
export function deriveKnockoutStages(
  groupScores: PredictionsState,
  koScores: Record<string, MatchScores>,
): KnockoutStages {
  const bracket = buildKnockoutBracket({ ...groupScores, ...koScores })
  const withScores = bracket.map(m => {
    const scores = koScores[String(m.matchNum)]
    return scores ? { ...m, scores } : m
  })

  return Object.fromEntries(
    KO_ROUND_RANGES.map(({ key, lo, hi }) =>
      [key, withScores.filter(m => m.matchNum >= lo && m.matchNum <= hi)]),
  ) as Record<keyof KnockoutStages, KnockoutMatch[]>
}
