import { useMemo, useState } from 'react'
import './App.css'
import type { Match, MatchScores } from './types'
import { GROUP_MATCHES } from './lib/groups'
import { calculateStandings } from './lib/standings'
import MatchRow from './components/MatchRow'
import StandingsTable from './components/StandingsTable'

type PredictionsState = Record<string, MatchScores>

const STORAGE_KEY = 'predictions'

const ALL_GROUP_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L'] as const
type GroupLetter = typeof ALL_GROUP_LETTERS[number]

const ALL_MATCHES = Object.values(GROUP_MATCHES).flat() as Match[]

const initialPredictions: PredictionsState = Object.fromEntries(
  ALL_MATCHES.map(m => [m.id, { home: null, away: null }])
)

function loadPredictions(): PredictionsState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return { ...initialPredictions, ...JSON.parse(stored) }
  } catch {
    // ignore malformed storage
  }
  return initialPredictions
}

export default function App() {
  const [predictions, setPredictions] = useState<PredictionsState>(loadPredictions)
  const [activeGroup, setActiveGroup] = useState<GroupLetter>('A')
  const activeMatches = GROUP_MATCHES[activeGroup] ?? []
  const activeStandings = useMemo(
    () => calculateStandings(activeMatches, predictions),
    [activeGroup, predictions]
  )

  function updateScores(matchId: string, scores: MatchScores) {
    setPredictions(prev => {
      const next = { ...prev, [matchId]: scores }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
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
        <div className="group-grid">
          {ALL_GROUP_LETTERS.map(letter => {
            const hasData = letter in GROUP_MATCHES
            return (
              <button
                key={letter}
                className={`group-cell${activeGroup === letter ? ' group-cell--active' : ''}${!hasData ? ' group-cell--empty' : ''}`}
                onClick={() => hasData && setActiveGroup(letter)}
                disabled={!hasData}
              >
                {letter}
              </button>
            )
          })}
        </div>

        <section className="content-section">
          {activeMatches.map(match => (
            <MatchRow
              key={match.id}
              match={match}
              scores={predictions[match.id]}
              onChange={(scores) => updateScores(match.id, scores)}
            />
          ))}
          <StandingsTable standings={activeStandings} />
        </section>
      </main>
    </>
  )
}
