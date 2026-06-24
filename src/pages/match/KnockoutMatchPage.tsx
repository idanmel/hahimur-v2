import { useState } from 'react'
import PageLayout from '../../shared/PageLayout'
import type { Score } from '../../shared/types'
import type { User } from '../../users/index'
import { TEAMS } from '../../shared/groups'
import { useLiveResults } from '../../shared/useLiveResults'
import { useCurrentUser } from '../../shared/useCurrentUser'
import { findKnockoutMatch, roundLabel, vennStage } from './koMatch'
import MatchHeader from './MatchHeader'
import KnockoutMatchLeaderboard from './KnockoutMatchLeaderboard'
import KnockoutParticipantsList from './KnockoutParticipantsList'
import KnockoutSurvivorsList from './KnockoutSurvivorsList'
import KnockoutVenn from './KnockoutVenn'
import './MatchPredictionsPage.css'

// The knockout matches are numbered 73–104, in kickoff order.
const FIRST_KO = 73
const LAST_KO = 104

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

  return (
    <PageLayout title="ההימור 2026">
      <div data-testid="knockout-match-page">
        <MatchHeader
          match={{ id: String(matchNum), matchDate: match.matchDate, kickoffIST: match.kickoffIST }}
          home={teamForSlot(match.home)} away={teamForSlot(match.away)}
          homeScore={homeScore} awayScore={awayScore} onHomeScore={setHomeScore} onAwayScore={setAwayScore}
          realScore={realScore}
          badge={{ label: `${roundLabel(matchNum)} · משחק ${matchNum}` }}
          prevId={matchNum > FIRST_KO ? String(matchNum - 1) : null}
          nextId={matchNum < LAST_KO ? String(matchNum + 1) : null}
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

          <header className="section-heading" dir="rtl">
            <span className="section-heading__eyebrow">משתתפים</span>
            <h2 className="section-heading__title">מי ניחש את המשחק</h2>
          </header>
          <KnockoutParticipantsList actualMatch={match} users={users} />

          {users.length > 0 && venn && (
            <>
              <header className="section-heading" dir="rtl">
                <span className="section-heading__eyebrow">{venn.label}</span>
                <h2 className="section-heading__title">
                  מי ניחש את {teamForSlot(match.home).he} ואת {teamForSlot(match.away).he}
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
