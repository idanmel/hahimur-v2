import FormPage from './pages/form/FormPage'
import FormsPage from './pages/forms/FormsPage'
import HomePage from './pages/home/HomePage'
import LeaderboardPage from './leaderboard/LeaderboardPage'
import MatchPredictionsPage from './pages/match/MatchPredictionsPage'
import SimPage from './pages/sim/SimPage'
import ResultsPage from './pages/results/ResultsPage'
import StatsPage from './pages/stats/StatsPage'
import GroupStatsPage from './pages/stats/group/GroupStatsPage'
import type { GroupLetter } from './shared/groups'
import { ALL_GROUP_LETTERS } from './shared/groups'
import { prepareResultsData } from './pages/results/prepareResultsData'

const GROUP_STATS_RE = /^\/stats\/groups\/([a-l])$/
import * as results from './results'
import { useUpdateCheck } from './shared/useUpdateCheck'
import UpdateBanner from './shared/UpdateBanner'

const FIVE_MINUTES = 5 * 60 * 1000
const FAST_CHECK = 5 * 1000

export default function App() {
  const pathname = window.location.pathname.toLowerCase()
  const interval = new URLSearchParams(window.location.search).has('fastCheck') ? FAST_CHECK : FIVE_MINUTES
  const { updateAvailable } = useUpdateCheck(interval)
  const matchId = pathname.startsWith('/matches/') ? pathname.slice('/matches/'.length).toUpperCase() : null
  const groupStatsMatch = GROUP_STATS_RE.exec(pathname)
  const groupStatsLetter = groupStatsMatch ? (groupStatsMatch[1].toUpperCase() as GroupLetter) : null

  return (
    <>
      <UpdateBanner updateAvailable={updateAvailable} />
      {matchId                                            ? <MatchPredictionsPage matchId={matchId} /> :
       groupStatsLetter && ALL_GROUP_LETTERS.includes(groupStatsLetter) ? <GroupStatsPage groupLetter={groupStatsLetter} /> :
       pathname === '/leaderboard'                         ? <LeaderboardPage /> :
       pathname === '/results'                            ? <ResultsPage data={prepareResultsData(results.predictions)} /> :
       pathname === '/sim'                                ? <SimPage /> :
       pathname === '/stats'                             ? <StatsPage /> :
       pathname === '/forms'                              ? <FormsPage /> :
       pathname === '/form'                               ? <FormPage /> :
       <HomePage />}
    </>
  )
}
