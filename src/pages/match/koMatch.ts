import { buildKnockoutBracket } from '../../formView/knockout/knockout'
import { tournamentResults } from '../../tournament-results'
import type { KnockoutMatch, PredictionsState } from '../../shared/types'

// The actual group scores, flattened into the predictions-shaped map the bracket
// builder consumes. Unresolved knockout slots come back as descriptor strings
// ("סגנית א") until the feeding groups are complete.
export function realGroupScores(): PredictionsState {
  const scores: PredictionsState = {}
  for (const matches of Object.values(tournamentResults.groupMatches))
    for (const m of matches) if (m.scores) scores[m.id] = m.scores
  return scores
}

// TEMP / local testing only: match 73's real teams aren't decided until groups
// A & B finish, so its participating-bettors table can't be exercised yet. With
// `?mockko` on a dev build, stand in a resolved South Korea vs Canada fixture
// (the runner-up A / runner-up B pairing most bettors predicted) so the table
// lights up. Never fires in a production build. Remove when 73 truly resolves.
const MOCK_KO: Record<number, KnockoutMatch> = {
  73: { matchNum: 73, home: 'South Korea', away: 'Canada', resolved: true, scores: { home: 1, away: 0 }, matchDate: '28 ביוני', kickoffIST: '22:00' },
}

function mockEnabled(): boolean {
  return import.meta.env.DEV
    && typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).has('mockko')
}

export function findKnockoutMatch(matchNum: number): KnockoutMatch | null {
  if (mockEnabled() && MOCK_KO[matchNum]) return MOCK_KO[matchNum]
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
