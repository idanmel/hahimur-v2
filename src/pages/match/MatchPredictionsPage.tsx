import { useState } from 'react'
import Nav from '../../Nav'
import type { Match, Score } from '../../shared/types'
import type { User } from '../../users/index'
import MatchHeader from './MatchHeader'
import PredictionSummary from './PredictionSummary'
import ScoreFrequencyTable from './ScoreFrequencyTable'
import PredictionsList from './PredictionsList'
import './MatchPredictionsPage.css'

type Team = { iso: string; he: string }

type Props = {
  match: Match | null
  home: Team | null
  away: Team | null
  users: User[]
}

export default function MatchPredictionsPage({ match, home, away, users }: Props) {
  const [homeScore, setHomeScore] = useState<Score>(null)
  const [awayScore, setAwayScore] = useState<Score>(null)

  if (!match || !home || !away) {
    return (
      <>
        <Nav />
        <p style={{ textAlign: 'center', marginTop: '2rem' }}>משחק לא נמצא</p>
      </>
    )
  }

  return (
    <>
      <MatchHeader
        match={match} home={home} away={away}
        homeScore={homeScore} awayScore={awayScore}
        onHomeScore={setHomeScore} onAwayScore={setAwayScore}
      />
      <Nav />

      <div className="match-predictions">
        <header className="section-heading" dir="rtl">
          <span className="section-heading__eyebrow">ניחושים</span>
          <h2 className="section-heading__title">סך הכל</h2>
        </header>
        <PredictionSummary matchId={match.id} homeLabel={home.he} awayLabel={away.he} users={users} />

        <header className="section-heading" dir="rtl">
          <span className="section-heading__eyebrow">סטטיסטיקה</span>
          <h2 className="section-heading__title">התפלגות תוצאות</h2>
        </header>
        <ScoreFrequencyTable matchId={match.id} users={users} />

        <header className="section-heading" dir="rtl">
          <span className="section-heading__eyebrow">ניחושים</span>
          <h2 className="section-heading__title">פירוט</h2>
        </header>
        <PredictionsList matchId={match.id} users={users} actualScore={homeScore !== null && awayScore !== null ? { home: homeScore, away: awayScore } : null} />
      </div>
    </>
  )
}
