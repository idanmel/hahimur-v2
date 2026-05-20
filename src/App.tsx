import { useMemo, useState } from 'react'
import './App.css'
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
    <>
      <header className="poster-header">
        <div className="poster-bar poster-bar--top" />
        <div className="poster-center">
          <p className="poster-overline">גביע העולם FIFA</p>
          <div className="poster-mundial">MUNDIAL <span className="poster-year">2026</span></div>
          <h1 className="poster-subtitle">ההימור 2026</h1>
        </div>
        <div className="poster-bar poster-bar--bottom" />
      </header>

      <main>
        <section className="content-section">
          <h2 className="section-tag">קבוצה א׳</h2>
          {GROUP_A_MATCHES.map(match => (
            <MatchRow
              key={match.id}
              match={match}
              scores={predictions[match.id]}
              onChange={(scores) => updateScores(match.id, scores)}
            />
          ))}
        </section>

        <section className="content-section">
          <h2 className="section-tag">טבלת דירוג</h2>
          <StandingsTable standings={standings} />
        </section>
      </main>
    </>
  )
}
