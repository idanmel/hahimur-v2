import { useState } from 'react'
import PageLayout from '../../shared/PageLayout'
import type { Score } from '../../shared/types'
import type { User } from '../../users/index'
import { TEAMS } from '../../shared/groups'
import { useLiveResults } from '../../shared/useLiveResults'
import { useCurrentUser } from '../../shared/useCurrentUser'
import { findKnockoutMatch, roundLabel, vennStage, knockoutChronoNav } from './koMatch'
import { LAST_GROUP_MATCH } from './matchUtils'
import MatchHeader from './MatchHeader'
import KnockoutMatchLeaderboard from './KnockoutMatchLeaderboard'
import KnockoutSurvivorsList from './KnockoutSurvivorsList'
import KnockoutVenn from './KnockoutVenn'
import PredictionSummary from './PredictionSummary'
import ScoreFrequencyTable from './ScoreFrequencyTable'
import { knockoutParticipantScore } from './koParticipants'
import './MatchPredictionsPage.css'

// A resolved slot is a real team → flag + Hebrew name; an unresolved slot is a
// descriptor string ("סגנית א", "שלישית א/ב/ג/ד/ו"), shown as-is with no flag.
function teamForSlot(slot: string): { iso?: string; he: string } {
  const team = TEAMS[slot]
  return team ? { iso: team.iso, he: team.he } : { he: slot }
}

export default function KnockoutMatchPage({ matchNum, users = [] }: { matchNum: number; users?: User[] }) {
  const match = findKnockoutMatch(matchNum)
  const results = useLiveResults()
  const { me } = useCurrentUser()
  const [homeScore, setHomeScore] = useState<Score>(null)
  const [awayScore, setAwayScore] = useState<Score>(null)

  if (!match) {
    return (
      <PageLayout title="ההימור 2026">
        <p style={{ textAlign: 'center', marginTop: '2rem' }}>משחק לא נמצא</p>
      </PageLayout>
    )
  }

  const realScore = match.resolved && match.scores && match.scores.home !== null && match.scores.away !== null
    ? match.scores
    : null

  // Which "who predicted each team this far" Venn this match feeds, if any.
  const venn = vennStage(matchNum)

  // Step the prev/next arrows through the bracket in kickoff order, not by number.
  // The opener's "previous" steps back into the group stage's final match.
  const { prevNum, nextNum } = knockoutChronoNav(matchNum)
  const prevId = prevNum !== null ? String(prevNum) : LAST_GROUP_MATCH.id
  const nextId = nextNum !== null ? String(nextNum) : null

  // The bettors playing this knockout fixture — those who predicted both teams
  // that actually reached it — each mapped to their called score, oriented to the
  // real home/away. Feeds the score-distribution summary below.
  const koScoreFor = new Map(
    users
      .map(u => [u, knockoutParticipantScore(match, u)] as const)
      .filter(([, score]) => score !== null),
  )
  const participants = users.filter(u => koScoreFor.has(u))

  return (
    <PageLayout title="ההימור 2026">
      <div data-testid="knockout-match-page">
        <MatchHeader
          match={{ id: String(matchNum), matchDate: match.matchDate, kickoffIST: match.kickoffIST }}
          home={teamForSlot(match.home)} away={teamForSlot(match.away)}
          homeScore={homeScore} awayScore={awayScore} onHomeScore={setHomeScore} onAwayScore={setAwayScore}
          realScore={realScore}
          badge={{ label: `${roundLabel(matchNum)} · משחק ${matchNum}` }}
          prevId={prevId}
          nextId={nextId}
        />
      </div>

      {!match.resolved && <KnockoutSurvivorsList actualMatch={match} users={users} />}

      {match.resolved && (
        <div className="match-predictions">
          {users.length > 0 && (
            <>
              <header className="section-heading" dir="rtl">
                <span className="section-heading__eyebrow">דירוג</span>
                <h2 className="section-heading__title">טבלת המנחשים</h2>
              </header>
              <KnockoutMatchLeaderboard match={match} users={users} results={results} me={me} />
            </>
          )}

          {participants.length > 0 && (
            <>
              <header className="section-heading" dir="rtl">
                <span className="section-heading__eyebrow">ניחושים</span>
                <h2 className="section-heading__title">סך הכל</h2>
              </header>
              <PredictionSummary
                matchId={String(matchNum)}
                homeLabel={teamForSlot(match.home).he}
                awayLabel={teamForSlot(match.away).he}
                users={participants}
                actualScore={realScore}
                scoreFor={u => koScoreFor.get(u)}
              />
            </>
          )}

          <header className="section-heading" dir="rtl">
            <span className="section-heading__eyebrow">סטטיסטיקה</span>
            <h2 className="section-heading__title">התפלגות תוצאות</h2>
          </header>
          {participants.length === 0
            ? <p className="match-predictions__empty" dir="rtl">אין משתתפים שניחשו את המשחק הזה</p>
            : <ScoreFrequencyTable
                matchId={String(matchNum)}
                users={participants}
                actualScore={realScore}
                scoreFor={u => koScoreFor.get(u)}
                homeLabel={teamForSlot(match.home).he}
                awayLabel={teamForSlot(match.away).he}
              />}

          {users.length > 0 && venn && (
            <>
              <header className="section-heading" dir="rtl">
                <span className="section-heading__eyebrow">{venn.label}</span>
                <h2 className="section-heading__title">
                  מי העלה את {teamForSlot(match.away).he} ואת {teamForSlot(match.home).he}
                </h2>
              </header>
              <KnockoutVenn teamA={match.home} teamB={match.away} stage={venn.stage} users={users} />
            </>
          )}
        </div>
      )}
    </PageLayout>
  )
}
