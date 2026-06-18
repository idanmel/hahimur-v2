import { useMemo } from 'react'
import type { TournamentResults } from './types'
import { tournamentResults } from '../tournament-results'
import { mergeLiveResults } from './liveResults'
import { useLiveScores } from './useLiveScores'

// The baked tournament results with any in-progress match's live score/scorers
// overlaid. Identical to `tournamentResults` whenever nothing is live.
export function useLiveResults(): TournamentResults {
  const overlay = useLiveScores()
  return useMemo(() => mergeLiveResults(tournamentResults, overlay), [overlay])
}
