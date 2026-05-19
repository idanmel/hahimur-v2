import { useState } from 'react'
import MatchRow from './components/MatchRow'

interface Scores {
  home: number | null
  away: number | null
}

export default function App() {
  const [scores, setScores] = useState<Scores>({ home: null, away: null })

  return (
    <main>
      <h1>2026 World Cup Predictions</h1>
      <MatchRow
        homeTeam="Mexico"
        awayTeam="South Africa"
        homeScore={scores.home}
        awayScore={scores.away}
        onChange={(home, away) => setScores({ home, away })}
      />
    </main>
  )
}
