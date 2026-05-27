import { useState, useEffect } from 'react'
import PageLayout from '../../shared/PageLayout'
import MatchRow from '../../formView/groupStage/MatchRow'
import StandingsTable from '../../formView/groupStage/StandingsTable'
import KnockoutTable from '../../formView/knockout/KnockoutTable'
import ThirdPlaceTable from '../../formView/thirdPlace/ThirdPlaceTable'
import { USERS_SORTED } from '../../users/index'
import { calculatePointsBreakdown } from '../../leaderboard/points'
import type { PointsBreakdown } from '../../leaderboard/points'
import { calculateStandings } from '../../shared/standings'
import { clearUnresolvedKOScores } from '../../formView/knockout/knockout'
import { useTournament } from '../../shared/useTournament'
import { GROUPS, ALL_GROUP_LETTERS } from '../../shared/groups'
import type { PredictionsState, MatchScores } from '../../shared/types'
import * as results from '../../results'
import '../../leaderboard/LeaderboardPage.css'
import '../../pages/form/FormPage.css'
import './PlaygroundPage.css'

interface Row extends PointsBreakdown { label: string }

export default function PlaygroundPage() {
  const [editedResults, setEditedResults] = useState<PredictionsState>({ ...results.predictions })
  const [activeGroup, setActiveGroup] = useState('A')

  const updateMatch = (matchId: string, scores: MatchScores) => {
    setEditedResults(prev => ({ ...prev, [matchId]: scores }))
  }

  const randomize = () => {
    const r = () => Math.floor(Math.random() * 4)
    setEditedResults(prev =>
      Object.fromEntries(Object.keys(prev).map(id => {
        const home = r()
        const away = r()
        const isKO = !isNaN(Number(id))
        const drawWinner = isKO && home === away
          ? (Math.random() < 0.5 ? 'home' : 'away') as 'home' | 'away'
          : undefined
        return [id, { home, away, ...(drawWinner ? { drawWinner } : {}) }]
      }))
    )
  }

  const reset = () => {
    setEditedResults({ ...results.predictions })
  }

  const { thirdPlaceQual, allGroupsFilled, round32Matches, knockout } = useTournament(editedResults)

  useEffect(() => {
    const allKOMatches = [
      ...round32Matches,
      ...knockout.r16, ...knockout.qf, ...knockout.sf,
      knockout.thirdPlace, knockout.final,
    ]
    const cleaned = clearUnresolvedKOScores(allKOMatches, editedResults)
    if (cleaned !== editedResults) setEditedResults(cleaned)
  }, [round32Matches, knockout])

  const rows: Row[] = USERS_SORTED.map(user => ({
    label: user.label,
    ...calculatePointsBreakdown(user.predictions, editedResults),
  })).sort((a, b) => b.total - a.total)

  return (
    <PageLayout title="פלייגראונד">
      <div className="pg-page" dir="rtl">

        <div className="pg-toolbar">
          <div className="pg-groups">
            {ALL_GROUP_LETTERS.map(letter => (
              <button
                key={letter}
                type="button"
                className={`pg-group-btn${activeGroup === letter ? ' pg-group-btn--active' : ''}`}
                onClick={() => setActiveGroup(letter)}
              >
                {GROUPS[letter].he}
              </button>
            ))}
          </div>
          <button type="button" className="pg-random-btn" onClick={randomize}>
            ערבב תוצאות
          </button>
          <button type="button" className="pg-reset-btn" onClick={reset}>
            איפוס
          </button>
        </div>

        <div className="pg-matches">
          {GROUPS[activeGroup].matches.map(match => (
            <MatchRow
              key={match.id}
              match={match}
              scores={editedResults[match.id] ?? { home: null, away: null }}
              onChange={scores => updateMatch(match.id, scores)}
            />
          ))}
        </div>

        <StandingsTable
          standings={calculateStandings(GROUPS[activeGroup].matches, editedResults).standings}
        />

        <section className="content-section">
          <div className="section-tag">דירוג נבחרות במקום השלישי</div>
          <ThirdPlaceTable qualification={thirdPlaceQual} allGroupsFilled={allGroupsFilled} />
        </section>

        <section className="content-section">
          <div className="section-tag">שלב ה-32</div>
          <KnockoutTable matches={round32Matches} predictions={editedResults} onChange={updateMatch} />
        </section>

        <section className="content-section">
          <div className="section-tag">שמינית גמר</div>
          <KnockoutTable matches={knockout.r16} predictions={editedResults} onChange={updateMatch} />
        </section>

        <section className="content-section">
          <div className="section-tag">רבע גמר</div>
          <KnockoutTable matches={knockout.qf} predictions={editedResults} onChange={updateMatch} />
        </section>

        <section className="content-section">
          <div className="section-tag">חצי גמר</div>
          <KnockoutTable matches={knockout.sf} predictions={editedResults} onChange={updateMatch} />
        </section>

        <section className="content-section">
          <div className="section-tag">מקום שלישי</div>
          <KnockoutTable matches={[knockout.thirdPlace]} predictions={editedResults} onChange={updateMatch} />
        </section>

        <section className="content-section">
          <div className="section-tag">גמר</div>
          <KnockoutTable matches={[knockout.final]} predictions={editedResults} onChange={updateMatch} />
        </section>

        <div className="pg-lb-section">
          <div className="lb-scroll">
            <table className="lb-table">
              <thead>
                <tr>
                  <th className="lb-th lb-th--rank">#</th>
                  <th className="lb-th lb-th--name">מהמר</th>
                  <th className="lb-th">בתים</th>
                  <th className="lb-th">שלב 32</th>
                  <th className="lb-th">שמינית</th>
                  <th className="lb-th">רבע</th>
                  <th className="lb-th">חצי</th>
                  <th className="lb-th">ארד</th>
                  <th className="lb-th">גמר</th>
                  <th className="lb-th">מלך שערים</th>
                  <th className="lb-th lb-th--total">סה"כ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.label} className="lb-row lb-row--other">
                    <td className="lb-td lb-td--rank">{i + 1}</td>
                    <td className="lb-td lb-td--name">{row.label}</td>
                    <td className="lb-td">{row.group || '—'}</td>
                    <td className="lb-td">{row.r32 || '—'}</td>
                    <td className="lb-td">{row.r16 || '—'}</td>
                    <td className="lb-td">{row.qf || '—'}</td>
                    <td className="lb-td">{row.sf || '—'}</td>
                    <td className="lb-td">{row.third || '—'}</td>
                    <td className="lb-td">{row.final || '—'}</td>
                    <td className="lb-td">{row.goldenBoot || '—'}</td>
                    <td className="lb-td lb-td--total">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </PageLayout>
  )
}
