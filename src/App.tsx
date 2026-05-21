import { useMemo, useState } from 'react'
import './App.css'
import type { Match, MatchScores } from './types'
import { GROUP_MATCHES, GROUP_HEBREW, TEAMS } from './lib/groups'
import { calculateStandings } from './lib/standings'
import { getThirdPlaceTeams, qualifyBestThirdPlace } from './lib/thirdPlace'
import MatchRow from './components/MatchRow'
import StandingsTable from './components/StandingsTable'
import ThirdPlaceTable from './components/ThirdPlaceTable'

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
  const { standings: activeStandings, tiedTeams: activeTiedTeams } = useMemo(
    () => calculateStandings(activeMatches, predictions),
    [activeGroup, predictions]
  )
  const activeAllFilled = activeMatches.length > 0 && activeMatches.every(m => {
    const pred = predictions[m.id]
    return pred && pred.home !== null && pred.away !== null
  })

  const { thirdPlaceQual, groupsWithTies, completedGroups, allGroupsFilled } = useMemo(() => {
    const allGroupData = ALL_GROUP_LETTERS
      .filter(l => l in GROUP_MATCHES)
      .map(l => {
        const matches = GROUP_MATCHES[l] ?? []
        const { standings, tiedTeams } = calculateStandings(matches, predictions)
        const allFilled = matches.length > 0 && matches.every(m => {
          const pred = predictions[m.id]
          return pred && pred.home !== null && pred.away !== null
        })
        const isComplete = allFilled && tiedTeams.size === 0
        return { group: l as string, standings, tiedTeams, allFilled, isComplete }
      })
    const groupsWithTies = new Set<string>()
    const completedGroups = new Set<string>()
    for (const d of allGroupData) {
      if (d.allFilled && d.tiedTeams.size > 0) groupsWithTies.add(d.group)
      if (d.isComplete) completedGroups.add(d.group)
    }
    return {
      thirdPlaceQual: qualifyBestThirdPlace(getThirdPlaceTeams(allGroupData)),
      groupsWithTies,
      completedGroups,
      allGroupsFilled: allGroupData.every(d => d.allFilled),
    }
  }, [predictions])

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
            const cls = [
              'group-cell',
              activeGroup === letter && 'group-cell--active',
              !hasData && 'group-cell--empty',
              groupsWithTies.has(letter) && 'group-cell--error',
              completedGroups.has(letter) && 'group-cell--complete',
            ].filter(Boolean).join(' ')
            return (
              <button
                key={letter}
                className={cls}
                onClick={() => hasData && setActiveGroup(letter)}
                disabled={!hasData}
              >
                {GROUP_HEBREW[letter]}
              </button>
            )
          })}
        </div>

        <section className="content-section">
          {activeAllFilled && activeTiedTeams.size > 0 && (
            <div role="alert" className="tie-warning">
              {[...activeTiedTeams].map(t => TEAMS[t].he).join(' · ')} — שוות בכל הקריטריונים
            </div>
          )}
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

        <section className="content-section">
          <div className="section-tag">דירוג נבחרות במקום השלישי</div>
          <ThirdPlaceTable qualification={thirdPlaceQual} allGroupsFilled={allGroupsFilled} />
        </section>
      </main>
    </>
  )
}
