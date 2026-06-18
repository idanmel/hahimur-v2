import LeaderboardTable from './LeaderboardTable'
import GroupScopeTable from './GroupScopeTable'
import WinProbabilityView from './winprob/WinProbabilityView'
import { buildLeaderboardRows, buildGroupScopeRows, buildRangeRows, rangePlaceMovement, rankTrajectories } from './leaderboardRows'
import type { Scope } from './leaderboardRows'
import type { TournamentResults } from '../shared/types'
import type { User } from '../users'

// key resets the table's sort state when switching scopes
export default function ScopedLeaderboard({ users, results, realResults, scope, rangeFrom, rangeTo, me }: {
  users: User[]
  results: TournamentResults
  // real played results for the win-probability view (independent of manual edits)
  realResults: TournamentResults
  scope: Scope
  rangeFrom: number
  rangeTo: number
  me?: string
}) {
  if (scope === 'prob') return <WinProbabilityView results={realResults} me={me} />
  if (scope === 'all') return <LeaderboardTable rows={buildLeaderboardRows(users, results)} me={me} trajectories={rankTrajectories(users, results)} />
  if (scope === 'range') return (
    <GroupScopeTable
      key="range"
      variant="window"
      rows={buildRangeRows(users, results, rangeFrom, rangeTo)}
      movements={rangePlaceMovement(users, results, rangeFrom, rangeTo)}
      me={me}
    />
  )
  return <GroupScopeTable key={scope} rows={buildGroupScopeRows(users, results, scope)} me={me} />
}
