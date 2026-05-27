import PageLayout from '../shared/PageLayout'
import { USERS_SORTED } from '../users/index'
import { calculatePointsBreakdown } from './points'
import LeaderboardTable from './LeaderboardTable'
import * as results from '../results'
import './LeaderboardPage.css'

export default function LeaderboardPage() {
  const rows = USERS_SORTED.map(user => ({
    label: user.label,
    ...calculatePointsBreakdown(user.predictions, results.predictions),
  })).sort((a, b) => b.total - a.total)

  return (
    <PageLayout title="לוח המובילים">
      <div className="lb-page" dir="rtl">
        <LeaderboardTable rows={rows} />
      </div>
    </PageLayout>
  )
}
