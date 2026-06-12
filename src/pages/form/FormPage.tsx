import { useState, useEffect, useMemo } from 'react'
import './FormPage.css'
import type { Match, MatchScores, PredictionsState, KnockoutMatch } from '../../shared/types'
import { GROUP_MATCHES, GROUP_HEBREW, TEAMS, ALL_GROUP_LETTERS, type GroupLetter } from '../../shared/groups'
import { calculateStandings } from '../../shared/standings'
import { clearUnresolvedKOScores } from '../../formView/knockout/knockout'
import { useTournament } from '../../shared/useTournament'
import PageLayout from '../../shared/PageLayout'
import { USER_STORAGE_EVENT } from '../../Nav'
import MatchRow from '../../formView/groupStage/MatchRow'
import StandingsTable from '../../formView/groupStage/StandingsTable'
import ThirdPlaceTable from '../../formView/thirdPlace/ThirdPlaceTable'
import KnockoutTable from '../../formView/knockout/KnockoutTable'
import ChampionBanner from '../../formView/knockout/ChampionBanner'
import type { User } from '../../users'
import { derivePredictions } from '../../users'

const STORAGE_KEY = 'user'

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-')
}

const ALL_MATCHES = Object.values(GROUP_MATCHES).flat() as Match[]

const KNOCKOUT_IDS = Array.from({ length: 32 }, (_, i) => String(73 + i))

const initialPredictions: PredictionsState = Object.fromEntries([
  ...ALL_MATCHES.map(m => [m.id, { home: null, away: null }]),
  ...KNOCKOUT_IDS.map(id => [id, { home: null, away: null }]),
])

function loadFromStorage(): { predictions: PredictionsState; topGoalscorer: string; userName: string } {
  if (new URLSearchParams(window.location.search).get('fill') === 'random') {
    const r = () => Math.floor(Math.random() * 4)
    const predictions = Object.fromEntries(
      Object.keys(initialPredictions).map(id => [id, { home: r(), away: r() }])
    )
    return { predictions, topGoalscorer: '', userName: '' }
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const u = JSON.parse(stored) as Partial<User>
      if (u.groupMatches) {
        return {
          predictions: { ...initialPredictions, ...derivePredictions(u.groupMatches, u.knockoutStages ?? { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] }) },
          topGoalscorer: u.topGoalscorer ?? '',
          userName: u.label ?? '',
        }
      }
    }
    // migrate from old separate keys
    const oldPredictions = localStorage.getItem('predictions')
    const oldGoalscorer = localStorage.getItem('topGoalscorer')
    const oldUserName = localStorage.getItem('userName')
    if (oldPredictions || oldGoalscorer || oldUserName) {
      return {
        predictions: oldPredictions ? { ...initialPredictions, ...JSON.parse(oldPredictions) } : initialPredictions,
        topGoalscorer: oldGoalscorer ?? '',
        userName: oldUserName ?? '',
      }
    }
  } catch {
    // ignore malformed storage
  }
  return { predictions: initialPredictions, topGoalscorer: '', userName: '' }
}

export default function FormPage() {
  const [predictions, setPredictions] = useState<PredictionsState>(() => loadFromStorage().predictions)
  const [topGoalscorer, setTopGoalscorer] = useState<string>(() => loadFromStorage().topGoalscorer)
  const [userName, setUserName] = useState<string>(() => loadFromStorage().userName)
  const [activeGroup, setActiveGroup] = useState<GroupLetter>('A')
  const activeMatches = useMemo(() => GROUP_MATCHES[activeGroup] ?? [], [activeGroup])
  const { standings: activeStandings, tiedTeams: activeTiedTeams } = useMemo(
    () => calculateStandings(activeMatches, predictions),
    [activeMatches, predictions]
  )
  const activeAllFilled = activeMatches.length > 0 && activeMatches.every(m => {
    const pred = predictions[m.id]
    return pred && pred.home !== null && pred.away !== null
  })

  const { allGroupData, thirdPlaceQual, groupsWithTies, completedGroups, allGroupsFilled, round32Matches, knockout, finalWinner } = useTournament(predictions)

  // adjust state during render: drop scores of KO matches whose teams are no longer resolved
  const allKOMatches = [
    ...round32Matches,
    ...knockout.r16, ...knockout.qf, ...knockout.sf,
    knockout.thirdPlace, knockout.final,
  ]
  const cleaned = clearUnresolvedKOScores(allKOMatches, predictions)
  if (cleaned !== predictions) {
    setPredictions(cleaned)
  }

  const user: User = useMemo(() => {
    const groupMatchesWithScores = Object.fromEntries(
      Object.entries(GROUP_MATCHES).map(([letter, matches]) => [
        letter,
        matches.map(m => {
          const pred = predictions[m.id]
          return pred && (pred.home !== null || pred.away !== null) ? { ...m, scores: pred } : m
        }),
      ])
    )

    const groupTables = Object.fromEntries(
      allGroupData.map(({ group, standings }) => [group, standings])
    )

    const withScores = (matches: KnockoutMatch[]) =>
      matches.map(m => {
        const pred = predictions[String(m.matchNum)]
        return pred && (pred.home !== null || pred.away !== null) ? { ...m, scores: pred } : m
      })

    const resolvedTeams = (matches: KnockoutMatch[]) =>
      matches.filter(m => m.resolved).flatMap(m => [m.home, m.away])

    const thirdPred = predictions['103']
    let predictedThirdPlaceWinner: string | undefined
    if (knockout.thirdPlace.resolved && thirdPred && thirdPred.home !== null && thirdPred.away !== null) {
      if (thirdPred.home > thirdPred.away) predictedThirdPlaceWinner = knockout.thirdPlace.home
      else if (thirdPred.away > thirdPred.home) predictedThirdPlaceWinner = knockout.thirdPlace.away
      else if (thirdPred.drawWinner === 'home') predictedThirdPlaceWinner = knockout.thirdPlace.home
      else if (thirdPred.drawWinner === 'away') predictedThirdPlaceWinner = knockout.thirdPlace.away
    }

    return {
      label: userName,
      predictions,
      topGoalscorer,
      groupMatches: groupMatchesWithScores,
      groupTables,
      thirdPlaceQualification: thirdPlaceQual,
      knockoutStages: {
        r32: withScores(round32Matches),
        r16: withScores(knockout.r16),
        qf: withScores(knockout.qf),
        sf: withScores(knockout.sf),
        thirdPlace: withScores([knockout.thirdPlace]),
        final: withScores([knockout.final]),
      },
      ...(finalWinner && { predictedChampion: finalWinner }),
      ...(predictedThirdPlaceWinner && { predictedThirdPlaceWinner }),
      predictedR16Teams: resolvedTeams(knockout.r16),
      predictedQFTeams: resolvedTeams(knockout.qf),
      predictedSFTeams: resolvedTeams(knockout.sf),
      predictedFinalTeams: resolvedTeams([knockout.final]),
    }
  }, [predictions, topGoalscorer, userName, allGroupData, thirdPlaceQual, round32Matches, knockout, finalWinner])

  useEffect(() => {
    const storable = { ...user, predictions: undefined }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storable))
    window.dispatchEvent(new Event(USER_STORAGE_EVENT))
  }, [user])

  function updateScores(matchId: string, scores: MatchScores) {
    setPredictions(prev => ({ ...prev, [matchId]: scores }))
  }

  function updateTopGoalscorer(name: string) {
    setTopGoalscorer(name)
  }

  function updateUserName(name: string) {
    setUserName(name)
  }

  function saveToFile() {
    const data = { ...user, predictions: undefined }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const slug = slugify(userName)
    a.download = slug ? `wc2026-predictions-${slug}.json` : 'wc2026-predictions.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <PageLayout title="ההימור 2026">

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

        <section className="content-section">
          <div className="section-tag">שלב ה-32</div>
          <KnockoutTable matches={round32Matches} predictions={predictions} onChange={updateScores} />
        </section>

        <section className="content-section">
          <div className="section-tag">שמינית גמר</div>
          <KnockoutTable matches={knockout.r16} predictions={predictions} onChange={updateScores} />
        </section>

        <section className="content-section">
          <div className="section-tag">רבע גמר</div>
          <KnockoutTable matches={knockout.qf} predictions={predictions} onChange={updateScores} />
        </section>

        <section className="content-section">
          <div className="section-tag">חצי גמר</div>
          <KnockoutTable matches={knockout.sf} predictions={predictions} onChange={updateScores} />
        </section>

        <section className="content-section">
          <div className="section-tag">מקום שלישי</div>
          <KnockoutTable matches={[knockout.thirdPlace]} predictions={predictions} onChange={updateScores} />
        </section>

        <section className="content-section">
          <div className="section-tag">גמר</div>
          <KnockoutTable matches={[knockout.final]} predictions={predictions} onChange={updateScores} />
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
            />
          </div>
        </section>

        <section className="content-section">
          <div className="section-tag">השם שלך</div>
          <div className="goalscorer-card" dir="rtl">
            <input
              type="text"
              className="goalscorer-input"
              placeholder="שמך..."
              value={userName}
              onChange={e => updateUserName(e.target.value)}
            />
          </div>
        </section>

        <section className="content-section save-section">
          <p className="save-hint">כשתסיים למלא את כל ההימורים, שמור אותם כקובץ</p>
          <button className="save-button" onClick={saveToFile}>
            <span className="save-button-icon">↓</span>
            שמור טופס
          </button>
        </section>

        {finalWinner && <ChampionBanner winner={finalWinner} />}
      </main>
    </PageLayout>
  )
}
