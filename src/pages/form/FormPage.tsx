import { useState, useEffect, useMemo } from 'react'
import './FormPage.css'
import type { Match, MatchScores, PredictionsState } from '../../shared/types'
import { GROUP_MATCHES, GROUP_HEBREW, TEAMS, ALL_GROUP_LETTERS, type GroupLetter } from '../../shared/groups'
import { calculateStandings } from '../../shared/standings'
import { clearUnresolvedKOScores } from '../../formView/knockout/knockout'
import { useTournament } from '../../shared/useTournament'
import Nav from '../../Nav'
import Countdown from '../../shared/Countdown'
import MatchRow from '../../formView/groupStage/MatchRow'
import StandingsTable from '../../formView/groupStage/StandingsTable'
import ThirdPlaceTable from '../../formView/thirdPlace/ThirdPlaceTable'
import KnockoutTable from '../../formView/knockout/KnockoutTable'
import ChampionBanner from '../../formView/knockout/ChampionBanner'

const SUBMISSION_DEADLINE = new Date('2026-06-07T00:00:00+03:00')

const STORAGE_KEY = 'predictions'
const GOALSCORER_KEY = 'topGoalscorer'

const ALL_MATCHES = Object.values(GROUP_MATCHES).flat() as Match[]

const KNOCKOUT_IDS = Array.from({ length: 32 }, (_, i) => String(73 + i))

const initialPredictions: PredictionsState = Object.fromEntries([
  ...ALL_MATCHES.map(m => [m.id, { home: null, away: null }]),
  ...KNOCKOUT_IDS.map(id => [id, { home: null, away: null }]),
])

function loadPredictions(): PredictionsState {
  if (new URLSearchParams(window.location.search).get('fill') === 'random') {
    const r = () => Math.floor(Math.random() * 4)
    const filled = Object.fromEntries(
      Object.keys(initialPredictions).map(id => [id, { home: r(), away: r() }])
    )
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filled))
    return filled
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return { ...initialPredictions, ...JSON.parse(stored) }
  } catch {
    // ignore malformed storage
  }
  return initialPredictions
}

function loadGoalscorer(): string {
  return localStorage.getItem(GOALSCORER_KEY) ?? ''
}

export default function FormPage() {
  const [predictions, setPredictions] = useState<PredictionsState>(loadPredictions)
  const [topGoalscorer, setTopGoalscorer] = useState<string>(loadGoalscorer)
  const [locked, setLocked] = useState(() => Date.now() >= SUBMISSION_DEADLINE.getTime())

  useEffect(() => {
    if (locked) return
    const id = setInterval(() => {
      if (Date.now() >= SUBMISSION_DEADLINE.getTime()) setLocked(true)
    }, 1000)
    return () => clearInterval(id)
  }, [locked])
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

  const { thirdPlaceQual, groupsWithTies, completedGroups, allGroupsFilled, round32Matches, knockout, finalWinner } = useTournament(predictions)

  useEffect(() => {
    const allKOMatches = [
      ...round32Matches,
      ...knockout.r16, ...knockout.qf, ...knockout.sf,
      knockout.thirdPlace, knockout.final,
    ]
    const cleaned = clearUnresolvedKOScores(allKOMatches, predictions)
    if (cleaned !== predictions) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned))
      setPredictions(cleaned)
    }
  }, [round32Matches, knockout])

  function updateScores(matchId: string, scores: MatchScores) {
    setPredictions(prev => {
      const next = { ...prev, [matchId]: scores }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  function updateTopGoalscorer(name: string) {
    setTopGoalscorer(name)
    localStorage.setItem(GOALSCORER_KEY, name)
  }

  function saveToFile() {
    const data = { predictions, topGoalscorer }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'wc2026-predictions.json'
    a.click()
    URL.revokeObjectURL(url)
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
      <Nav />
      <Countdown targetDate={SUBMISSION_DEADLINE} label="לסגירת הטפסים" />

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
              readOnly={locked}
            />
          ))}
          <StandingsTable standings={activeStandings} />
        </section>

        <section className="content-section">
          <div className="section-tag">דירוג נבחרות במקום השלישי</div>
          <ThirdPlaceTable qualification={thirdPlaceQual} allGroupsFilled={allGroupsFilled} />
        </section>

        <section className="content-section">
          <div className="section-tag">שלב ה-32</div>
          <KnockoutTable matches={round32Matches} predictions={predictions} onChange={updateScores} readOnly={locked} />
        </section>

        <section className="content-section">
          <div className="section-tag">שמינית גמר</div>
          <KnockoutTable matches={knockout.r16} predictions={predictions} onChange={updateScores} readOnly={locked} />
        </section>

        <section className="content-section">
          <div className="section-tag">רבע גמר</div>
          <KnockoutTable matches={knockout.qf} predictions={predictions} onChange={updateScores} readOnly={locked} />
        </section>

        <section className="content-section">
          <div className="section-tag">חצי גמר</div>
          <KnockoutTable matches={knockout.sf} predictions={predictions} onChange={updateScores} readOnly={locked} />
        </section>

        <section className="content-section">
          <div className="section-tag">מקום שלישי</div>
          <KnockoutTable matches={[knockout.thirdPlace]} predictions={predictions} onChange={updateScores} readOnly={locked} />
        </section>

        <section className="content-section">
          <div className="section-tag">גמר</div>
          <KnockoutTable matches={[knockout.final]} predictions={predictions} onChange={updateScores} readOnly={locked} />
        </section>

        <section className="content-section">
          <div className="section-tag">מלך השערים</div>
          <div className="goalscorer-card" dir="rtl">
            <input
              type="text"
              className="goalscorer-input"
              placeholder="שם השחקן..."
              value={topGoalscorer}
              onChange={e => updateTopGoalscorer(e.target.value)}
              disabled={locked}
            />
          </div>
        </section>

        <section className="content-section save-section">
          <p className="save-hint">כשתסיים למלא את כל ההימורים, שמור אותם כקובץ</p>
          <button className="save-button" onClick={saveToFile} disabled={locked}>
            <span className="save-button-icon">↓</span>
            שמור טופס
          </button>
        </section>

        {finalWinner && <ChampionBanner winner={finalWinner} />}
      </main>
    </>
  )
}
