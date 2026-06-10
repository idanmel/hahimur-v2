import { useState } from 'react'
import PageLayout from '../shared/PageLayout'
import { USERS_SORTED } from '../users/index'
import LeaderboardTable from './LeaderboardTable'
import HitsTable from './HitsTable'
import { tournamentResults } from '../tournament-results'
import { buildLeaderboardRows, buildHitsRows, groupScopeLabel } from './leaderboardRows'
import type { Scope } from './leaderboardRows'
import LeaderboardScopeBar from './LeaderboardScopeBar'
import LeaderboardModeBar from './LeaderboardModeBar'
import type { Mode } from './LeaderboardModeBar'
import './LeaderboardPage.css'

export default function LeaderboardPage() {
  const [scope, setScope] = useState<Scope>('all')
  const [mode, setMode] = useState<Mode>('points')

  const pointsRows = buildLeaderboardRows(USERS_SORTED, tournamentResults, scope)
  const hitsRows = buildHitsRows(USERS_SORTED, tournamentResults, scope)
  const scopeLabel = groupScopeLabel(scope)

  return (
    <PageLayout title="לוח המובילים">
      <div className="lb-page" dir="rtl">
        <div className="lb-scope-wrap">
          <LeaderboardScopeBar scope={scope} onScopeChange={setScope} />
          <LeaderboardModeBar mode={mode} onModeChange={setMode} />
        </div>
        {mode === 'points'
          ? <LeaderboardTable rows={pointsRows} scopeLabel={scopeLabel} />
          : <HitsTable rows={hitsRows} />
        }
      </div>
    </PageLayout>
  )
}
