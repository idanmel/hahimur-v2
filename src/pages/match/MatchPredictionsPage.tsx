import { useState } from 'react'
import Nav from '../../Nav'
import type { Match, MatchScores, Score, TournamentResults } from '../../shared/types'
import type { User } from '../../users/index'
import { isLive } from '../../shared/matchOrder'
import { useLiveResults } from '../../shared/useLiveResults'
import MatchHeader from './MatchHeader'
import PredictionSummary from './PredictionSummary'
import ScoreFrequencyTable from './ScoreFrequencyTable'
import './MatchPredictionsPage.css'

type Team = { iso: string; he: string }

type Props = {
  match: Match | null
  home: Team | null
  away: Team | null
  users: User[]
  now?: Date
}

function realScoreFor(results: TournamentResults, matchId: string): MatchScores | null {
  const s = results.groupMatches[matchId[0]]?.find(m => m.id === matchId)?.scores
  return s && s.home !== null && s.away !== null ? s : null
}

export default function MatchPredictionsPage({ match, home, away, users, now = new Date() }: Props) {
  const [homeScore, setHomeScore] = useState<Score>(null)
  const [awayScore, setAwayScore] = useState<Score>(null)
  // Live-overlaid results: a live score/scorers appear here in real time while
  // the match is in progress, then settle to the baked final when it ends.
  const results = useLiveResults()

  if (!match || !home || !away) {
    return (
      <>
        <Nav />
        <p style={{ textAlign: 'center', marginTop: '2rem' }}>משחק לא נמצא</p>
      </>
    )
  }

  const live = isLive(match, now)
  const realScore = realScoreFor(results, match.id)
  const actualScore = realScore ?? (homeScore !== null && awayScore !== null ? { home: homeScore, away: awayScore } : null)
  const scorers = realScore
    ? Object.entries(results.playerMatchGoals ?? {})
        .filter(([, byMatch]) => (byMatch[match.id] ?? 0) > 0)
        .map(([player, byMatch]) => ({ player, goals: byMatch[match.id] }))
    : []

  return (
    <>
      <MatchHeader
        match={match} home={home} away={away}
        homeScore={homeScore} awayScore={awayScore}
        onHomeScore={setHomeScore} onAwayScore={setAwayScore}
        realScore={realScore} live={live}
      />
      <Nav />

      <div className="match-predictions">
        {scorers.length > 0 && (
          <div className="match-scorers" data-testid="match-scorers" dir="rtl">
            {scorers.map(s => (
              <span key={s.player} className="match-scorers__item">
                ⚽ {s.player}{s.goals > 1 ? ` ×${s.goals}` : ''}
              </span>
            ))}
          </div>
        )}

        <header className="section-heading" dir="rtl">
          <span className="section-heading__eyebrow">ניחושים</span>
          <h2 className="section-heading__title">סך הכל</h2>
        </header>
        <PredictionSummary matchId={match.id} homeLabel={home.he} awayLabel={away.he} users={users} actualScore={actualScore} />

        <header className="section-heading" dir="rtl">
          <span className="section-heading__eyebrow">סטטיסטיקה</span>
          <h2 className="section-heading__title">התפלגות תוצאות</h2>
        </header>
        {users.length === 0
          ? <p className="match-predictions__empty">אין תחזיות למשחק זה</p>
          : <ScoreFrequencyTable matchId={match.id} users={users} actualScore={actualScore} />}
      </div>
    </>
  )
}
