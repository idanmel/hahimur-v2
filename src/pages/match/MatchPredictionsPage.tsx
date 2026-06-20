import { useState } from 'react'
import PageLayout from '../../shared/PageLayout'
import type { Match, MatchScores, Score, TournamentResults } from '../../shared/types'
import type { User } from '../../users/index'
import { isLive } from '../../shared/matchOrder'
import { useLiveResults } from '../../shared/useLiveResults'
import { useCurrentUser } from '../../shared/useCurrentUser'
import { GROUP_HEBREW, GROUP_MATCHES } from '../../shared/groups'
import { adjacentMatches } from './matchUtils'
import { calculateStandings, liveGroupScores } from '../../shared/standings'
import StandingsTable from '../../formView/groupStage/StandingsTable'
import MatchHeader from './MatchHeader'
import PredictionSummary from './PredictionSummary'
import ScoreFrequencyTable from './ScoreFrequencyTable'
import MatchLeaderboard from './MatchLeaderboard'
import BestResultCard from '../../formView/groupStage/BestResultCard'
import MatchRecommendation from './MatchRecommendation'
import { bestRemainingResult } from '../../leaderboard/bestResult'
import { settledState } from '../stats/group/recommendation'
import { thirdPickFromQualification, protectedThirdsForGroup } from '../stats/group/selfScore'
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
  const { me, currentUser } = useCurrentUser()

  if (!match || !home || !away) {
    return (
      <PageLayout title="ההימור 2026">
        <p style={{ textAlign: 'center', marginTop: '2rem' }}>משחק לא נמצא</p>
      </PageLayout>
    )
  }

  const live = isLive(match, now)
  const realScore = realScoreFor(results, match.id)
  // Present only while the match is actually being played (from the live feed),
  // which is how the header tells "in progress" from "finished".
  const liveScore = results.live?.[match.id] ?? null
  // "Decided" means a FINAL result — not a live, still-changing score. While the
  // match is in progress the recommendation stays useful (the result isn't locked
  // yet), so we only treat it as decided once it's final and no longer live.
  const decided = !!realScore && !liveScore
  const actualScore = realScore ?? (homeScore !== null && awayScore !== null ? { home: homeScore, away: awayScore } : null)
  const scorers = realScore
    ? Object.entries(results.playerMatchGoals ?? {})
        .filter(([, byMatch]) => (byMatch[match.id] ?? 0) > 0)
        .map(([player, byMatch]) => ({ player, goals: byMatch[match.id] }))
    : []

  // The group table as it stands right now, with this match's live score folded
  // in via useLiveResults — the two teams playing are highlighted.
  const groupLetter = match.id[0]
  const { standings } = calculateStandings(GROUP_MATCHES[groupLetter] ?? [], liveGroupScores(results, groupLetter))
  // The viewer's own predicted final table for this group, shown beneath the
  // live one so they can compare their call to how it's actually unfolding.
  const myGroupTable = currentUser?.groupTables[groupLetter]

  // The result to root for across this group's remaining matches, from your bet.
  const myOrder = myGroupTable?.map(s => s.team) ?? []
  const bestResult = currentUser && myGroupTable
    ? bestRemainingResult({
        groupLetter,
        predictions: currentUser.predictions,
        predictedOrder: myOrder,
        thirdPick: thirdPickFromQualification(currentUser, groupLetter),
        settledAll: settledState(results),
        protectedThirds: protectedThirdsForGroup(currentUser.thirdPlaceQualification, groupLetter),
      })
    : null

  // Step to the chronologically adjacent matches.
  const { prev, next } = adjacentMatches(match.id)

  return (
    <PageLayout title="ההימור 2026">
      <MatchHeader
        match={match} home={home} away={away}
        homeScore={homeScore} awayScore={awayScore}
        onHomeScore={setHomeScore} onAwayScore={setAwayScore}
        realScore={realScore} live={live} liveScore={liveScore}
        prevId={prev?.id ?? null} nextId={next?.id ?? null}
      />

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

        {users.length > 0 && (
          <>
            <header className="section-heading" dir="rtl">
              <span className="section-heading__eyebrow">דירוג</span>
              <h2 className="section-heading__title">טבלת המנחשים</h2>
            </header>
            <MatchLeaderboard matchId={match.id} users={users} results={results} me={me} />
          </>
        )}

        <MatchRecommendation
          matchId={match.id}
          currentUser={currentUser ?? undefined}
          results={results}
          decided={decided}
        />

        {bestResult && (
          <>
            <header className="section-heading" dir="rtl">
              <span className="section-heading__eyebrow">ההמלצה שלך</span>
              <h2 className="section-heading__title">הבית כולו</h2>
            </header>
            <BestResultCard result={bestResult} />
          </>
        )}

        <header className="section-heading" dir="rtl">
          <span className="section-heading__eyebrow">בית {GROUP_HEBREW[groupLetter]}</span>
          <h2 className="section-heading__title">טבלת הבית</h2>
        </header>
        <div data-testid="live-group-table">
          <StandingsTable standings={standings} highlightTeams={[match.homeTeam, match.awayTeam]} />
        </div>

        {myGroupTable && (
          <>
            <header className="section-heading" dir="rtl">
              <span className="section-heading__eyebrow">התחזית שלך</span>
              <h2 className="section-heading__title">טבלת הבית שלי</h2>
            </header>
            <div data-testid="my-group-table">
              <StandingsTable standings={myGroupTable} highlightTeams={[match.homeTeam, match.awayTeam]} />
            </div>
          </>
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
    </PageLayout>
  )
}
