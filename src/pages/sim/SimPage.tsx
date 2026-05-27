import { useState, useEffect } from 'react'
import PageLayout from '../../shared/PageLayout'
import MatchRow from '../../formView/groupStage/MatchRow'
import StandingsTable from '../../formView/groupStage/StandingsTable'
import KnockoutTable from '../../formView/knockout/KnockoutTable'
import ThirdPlaceTable from '../../formView/thirdPlace/ThirdPlaceTable'
import { USERS_SORTED } from '../../users/index'
import { calculatePointsBreakdown } from '../../leaderboard/points'
import LeaderboardTable from '../../leaderboard/LeaderboardTable'
import { calculateStandings } from '../../shared/standings'
import { clearUnresolvedKOScores } from '../../formView/knockout/knockout'
import { useTournament } from '../../shared/useTournament'
import { GROUPS, ALL_GROUP_LETTERS } from '../../shared/groups'
import type { PredictionsState, MatchScores } from '../../shared/types'
import * as results from '../../results'
import { TEAM_STRENGTH } from './teamStrength'
import '../../leaderboard/LeaderboardPage.css'
import '../../pages/form/FormPage.css'
import './SimPage.css'

const GROUP_MATCH_TEAMS: Record<string, { homeTeam: string; awayTeam: string }> = {}
Object.values(GROUPS).forEach(group =>
  group.matches.forEach(m => { GROUP_MATCH_TEAMS[m.id] = { homeTeam: m.homeTeam, awayTeam: m.awayTeam } })
)

export default function SimPage() {
  const [editedResults, setEditedResults] = useState<PredictionsState>({ ...results.predictions })
  const [activeGroup, setActiveGroup] = useState('A')

  const updateMatch = (matchId: string, scores: MatchScores) => {
    setEditedResults(prev => ({ ...prev, [matchId]: scores }))
  }

  const randomize = () => {
    const poisson = (lambda: number) => {
      const L = Math.exp(-lambda)
      let k = 0, p = 1
      do { k++; p *= Math.random() } while (p > L)
      return k - 1
    }
    const BASE = 1.3
    setEditedResults(prev =>
      Object.fromEntries(Object.keys(prev).map(id => {
        const teams = GROUP_MATCH_TEAMS[id]
        const avg = { att: 1.0, def: 1.0 }
        const homeStr = (teams && TEAM_STRENGTH[teams.homeTeam]) ?? avg
        const awayStr = (teams && TEAM_STRENGTH[teams.awayTeam]) ?? avg
        const home = poisson(BASE * homeStr.att * awayStr.def)
        const away = poisson(BASE * awayStr.att * homeStr.def)
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

  const rows = USERS_SORTED.map(user => ({
    label: user.label,
    ...calculatePointsBreakdown(user.predictions, editedResults),
  })).sort((a, b) => b.total - a.total)

  return (
    <PageLayout title="סימולציה">
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
          <LeaderboardTable rows={rows} />
        </div>

      </div>
    </PageLayout>
  )
}
