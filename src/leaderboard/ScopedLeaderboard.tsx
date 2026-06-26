import LeaderboardTable from './LeaderboardTable'
import GroupScopeTable from './GroupScopeTable'
import GroupDetailView from './GroupDetailView'
import CrossingsView from './CrossingsView'
import TimelapseView from './TimelapseView'
import WinProbabilityView from './winprob/WinProbabilityView'
import { buildLeaderboardRows, buildGroupScopeRows, buildGroupSummaryRows, buildGroupDetailRows, buildRangeRows, rangePlaceMovement, rankTrajectories, hitStats } from './leaderboardRows'
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
  if (scope === 'timelapse') return <TimelapseView users={users} results={results} me={me} />
  if (scope === 'crossings') return <CrossingsView user={users.find(u => u.label === me)} users={users} results={realResults} />
  if (scope === 'oleh') return (
    <GroupDetailView
      rows={buildGroupDetailRows(users, results)}
      me={me}
      actualTables={results.groupTables}
      myTables={users.find(u => u.label === me)?.groupTables}
    />
  )
  if (scope === 'all') return <LeaderboardTable rows={buildLeaderboardRows(users, results)} me={me} trajectories={rankTrajectories(users, results)} hits={hitStats(users, results)} />
  if (scope === 'summary') return <GroupScopeTable key="summary" variant="summary" rows={buildGroupSummaryRows(users, results)} me={me} />
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
