import { buildKnockoutBracket } from '../../formView/knockout/knockout'
import { tournamentResults } from '../../tournament-results'
import type { KnockoutMatch, PredictionsState } from '../../shared/types'

// The actual group scores, flattened into the predictions-shaped map the bracket
// builder consumes. Unresolved knockout slots come back as descriptor strings
// ("סגנית א") until the feeding groups are complete.
export function realGroupScores(): PredictionsState {
  const scores: PredictionsState = {}
  for (const matches of Object.values(tournamentResults.groupMatches))
    for (const m of matches) scores[m.id] = m.scores
  return scores
}

export function findKnockoutMatch(matchNum: number): KnockoutMatch | null {
  return buildKnockoutBracket(realGroupScores()).find(m => m.matchNum === matchNum) ?? null
}

const ROUND_LABELS: { upTo: number; label: string }[] = [
  { upTo: 88,  label: 'שלב ה-32' },
  { upTo: 96,  label: 'שמינית גמר' },
  { upTo: 100, label: 'רבע גמר' },
  { upTo: 102, label: 'חצי גמר' },
  { upTo: 103, label: 'מקום שלישי' },
  { upTo: 104, label: 'גמר' },
]

export function roundLabel(matchNum: number): string {
  return ROUND_LABELS.find(r => matchNum <= r.upTo)?.label ?? ''
}
