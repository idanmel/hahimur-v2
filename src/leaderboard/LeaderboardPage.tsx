import { useState } from 'react'
import PageLayout from '../shared/PageLayout'
import { USERS_SORTED } from '../users/index'
import LeaderboardTable from './LeaderboardTable'
import GroupScopeTable from './GroupScopeTable'
import { tournamentResults } from '../tournament-results'
import { buildLeaderboardRows, buildGroupScopeRows } from './leaderboardRows'
import type { Scope } from './leaderboardRows'
import LeaderboardScopeBar from './LeaderboardScopeBar'
import './LeaderboardPage.css'

export default function LeaderboardPage() {
  const [scope, setScope] = useState<Scope>('all')

  return (
    <PageLayout title="לוח המובילים">
      <div className="lb-page" dir="rtl">
        <div className="lb-scope-wrap">
          <LeaderboardScopeBar scope={scope} onScopeChange={setScope} />
        </div>
        {scope === 'all'
          ? <LeaderboardTable rows={buildLeaderboardRows(USERS_SORTED, tournamentResults)} />
          : <GroupScopeTable rows={buildGroupScopeRows(USERS_SORTED, tournamentResults, scope)} />
        }
      </div>
    </PageLayout>
  )
}
