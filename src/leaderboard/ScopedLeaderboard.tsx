import LeaderboardTable from './LeaderboardTable'
import GroupScopeTable from './GroupScopeTable'
import { buildLeaderboardRows, buildGroupScopeRows, buildLastXRows, buildAsOfRows, buildRangeRows } from './leaderboardRows'
import type { Scope } from './leaderboardRows'
import type { TournamentResults } from '../shared/types'
import type { User } from '../users'

// key resets the table's sort state when switching scopes
export default function ScopedLeaderboard({ users, results, scope, lastX, asOfIndex, rangeFrom, rangeTo }: {
  users: User[]
  results: TournamentResults
  scope: Scope
  lastX: number
  asOfIndex: number
  rangeFrom: number
  rangeTo: number
}) {
  if (scope === 'all') return <LeaderboardTable rows={buildLeaderboardRows(users, results)} />
  if (scope === 'lastX') return <GroupScopeTable key="lastX" variant="window" rows={buildLastXRows(users, results, lastX)} />
  if (scope === 'asOf') return <GroupScopeTable key="asOf" variant="window" rows={buildAsOfRows(users, results, asOfIndex)} />
  if (scope === 'range') return <GroupScopeTable key="range" variant="window" rows={buildRangeRows(users, results, rangeFrom, rangeTo)} />
  return <GroupScopeTable key={scope} rows={buildGroupScopeRows(users, results, scope)} />
}
