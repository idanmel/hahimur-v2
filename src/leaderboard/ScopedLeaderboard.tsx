import LeaderboardTable from './LeaderboardTable'
import GroupScopeTable from './GroupScopeTable'
import { buildLeaderboardRows, buildGroupScopeRows, buildLastXRows } from './leaderboardRows'
import type { Scope } from './leaderboardRows'
import type { TournamentResults } from '../shared/types'
import type { User } from '../users'

// key resets the table's sort state when switching scopes
export default function ScopedLeaderboard({ users, results, scope, lastX }: {
  users: User[]
  results: TournamentResults
  scope: Scope
  lastX: number
}) {
  if (scope === 'all') return <LeaderboardTable rows={buildLeaderboardRows(users, results)} />
  if (scope === 'lastX') return <GroupScopeTable key="lastX" variant="lastX" rows={buildLastXRows(users, results, lastX)} />
  return <GroupScopeTable key={scope} rows={buildGroupScopeRows(users, results, scope)} />
}
