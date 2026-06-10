import { useState } from 'react'
import PageLayout from '../shared/PageLayout'
import { USERS_SORTED } from '../users/index'
import ScopedLeaderboard from './ScopedLeaderboard'
import { tournamentResults } from '../tournament-results'
import type { Scope } from './leaderboardRows'
import LeaderboardScopeBar from './LeaderboardScopeBar'
import './LeaderboardPage.css'

export default function LeaderboardPage() {
  const [scope, setScope] = useState<Scope>('all')
  const [lastX, setLastX] = useState(5)

  return (
    <PageLayout title="לוח המובילים">
      <div className="lb-page" dir="rtl">
        <div className="lb-scope-wrap">
          <LeaderboardScopeBar scope={scope} onScopeChange={setScope} lastX={lastX} onLastXChange={setLastX} />
        </div>
        <ScopedLeaderboard users={USERS_SORTED} results={tournamentResults} scope={scope} lastX={lastX} />
      </div>
    </PageLayout>
  )
}
