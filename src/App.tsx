import { useMemo, useState } from 'react'
import type { MatchScores } from './types'
import { GROUP_A_MATCHES } from './lib/groups'
import { calculateStandings } from './lib/standings'
import MatchRow from './components/MatchRow'
import StandingsTable from './components/StandingsTable'

type PredictionsState = Record<string, MatchScores>

const initialPredictions: PredictionsState = Object.fromEntries(
  GROUP_A_MATCHES.map(m => [m.id, { home: null, away: null }])
)

export default function App() {
  const [predictions, setPredictions] = useState<PredictionsState>(initialPredictions)

  const standings = useMemo(() => calculateStandings(GROUP_A_MATCHES, predictions), [predictions])

  function updateScores(matchId: string, scores: MatchScores) {
    setPredictions(prev => ({ ...prev, [matchId]: scores }))
  }

  return (
    <main>
      <h1>2026 World Cup Predictions</h1>
      {GROUP_A_MATCHES.map(match => (
        <MatchRow
          key={match.id}
          match={match}
          scores={predictions[match.id]}
          onChange={(scores) => updateScores(match.id, scores)}
        />
      ))}
      <StandingsTable standings={standings} />
    </main>
  )
}
