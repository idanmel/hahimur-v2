import { useEffect, useState } from 'react'
import PageLayout from '../../shared/PageLayout'
import Bracket from '../../shared/Bracket'
import ScopedLeaderboard from '../../leaderboard/ScopedLeaderboard'
import LeaderboardScopeBar from '../../leaderboard/LeaderboardScopeBar'
import type { Scope } from '../../leaderboard/leaderboardRows'
import { playedGroupMatchesChrono, playedMatchLabel } from '../../leaderboard/leaderboardRows'
import { useCurrentUser } from '../../shared/useCurrentUser'
import { reportUsage } from '../../shared/reportUsage'
import type { User } from '../../users/index'
import { tournamentResults } from '../../tournament-results'
import '../../leaderboard/LeaderboardPage.css'
import '../results/ResultsPage.css'

// Chronological timeline the "טווח" range selectors choose from. Read-only here:
// the bracket isn't interactive yet (slice 4), so this is fixed to the committed
// real results.
const PLAYED_MATCH_LABELS = playedGroupMatchesChrono(tournamentResults).map(playedMatchLabel)

export default function BracketPage({ users }: { users: User[] }) {
  const { me } = useCurrentUser()
  const [scope, setScope] = useState<Scope>('all')
  const [rangeFrom, setRangeFrom] = useState(1)
  const [rangeTo, setRangeTo] = useState(PLAYED_MATCH_LABELS.length)

  // keep the stretch valid (from ≤ to) as either end moves
  const setFrom = (n: number) => { setRangeFrom(n); if (n > rangeTo) setRangeTo(n) }
  const setTo = (n: number) => { setRangeTo(n); if (n < rangeFrom) setRangeFrom(n) }

  // fire-and-forget on load so we can later measure whether people open this page
  useEffect(() => { reportUsage('bracket-view') }, [])

  return (
    <PageLayout title="הטבלה">
      <div className="pg-page" dir="rtl">
        <section className="pg-lb-section">
          <div className="pg-lb-header">
            <h2 className="pg-lb-title">טבלת ניקוד</h2>
            <span className="pg-lb-live-dot" aria-hidden="true" />
            <span className="pg-lb-subtitle">מתעדכן בזמן אמת</span>
          </div>
          <LeaderboardScopeBar
            scope={scope} onScopeChange={setScope}
            rangeFrom={rangeFrom} rangeTo={rangeTo} onRangeFromChange={setFrom} onRangeToChange={setTo}
            playedMatchLabels={PLAYED_MATCH_LABELS}
          />
          <ScopedLeaderboard
            users={users}
            results={tournamentResults}
            realResults={tournamentResults}
            scope={scope}
            rangeFrom={rangeFrom}
            rangeTo={rangeTo}
            me={me}
          />
        </section>
      </div>
      <Bracket stages={tournamentResults.knockoutStages} />
    </PageLayout>
  )
}
