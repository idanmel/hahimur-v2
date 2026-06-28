import AdminPage from './pages/admin/AdminPage'
import UpdatesPage from './pages/updates/UpdatesPage'
import FormsPage from './pages/forms/FormsPage'
import HomePage from './pages/home/HomePage'
import MatchPredictionsPage from './pages/match/MatchPredictionsPage'
import KnockoutMatchPage from './pages/match/KnockoutMatchPage'
import ResultsPage from './pages/results/ResultsPage'
import BracketPage from './pages/bracket/BracketPage'
import WinProbPage from './pages/winprob/WinProbPage'
import RivalryPage from './pages/rivalry/RivalryPage'
import StatsPage from './pages/stats/StatsPage'
import GroupStatsPage from './pages/stats/group/GroupStatsPage'
import type { GroupLetter } from './shared/groups'
import { ALL_GROUP_LETTERS } from './shared/groups'
import { useUpdateCheck } from './shared/useUpdateCheck'
import { resolveMatch } from './pages/match/matchUtils'
import { USERS, USERS_SORTED } from './users/index'

const GROUP_STATS_RE = /^\/stats\/groups\/([a-l])$/
import UpdateBanner from './shared/UpdateBanner'

const FIVE_MINUTES = 5 * 60 * 1000
const FAST_CHECK = 5 * 1000

export default function App() {
  const pathname = window.location.pathname.toLowerCase()
  const interval = new URLSearchParams(window.location.search).has('fastCheck') ? FAST_CHECK : FIVE_MINUTES
  const { updateAvailable } = useUpdateCheck(interval)
  const matchId = pathname.startsWith('/matches/') ? pathname.slice('/matches/'.length).toUpperCase() : null
  // Group matches carry letter ids (A1, B2…); knockout matches are numbered, so a
  // purely numeric id routes to the knockout page. Unready slots render gracefully
  // (descriptors, no participants) until their feeding groups resolve.
  const koMatchNum = matchId && /^\d+$/.test(matchId) ? Number(matchId) : null
  const groupStatsMatch = GROUP_STATS_RE.exec(pathname)
  const groupStatsLetter = groupStatsMatch ? (groupStatsMatch[1].toUpperCase() as GroupLetter) : null

  return (
    <>
      <UpdateBanner updateAvailable={updateAvailable} />
      {koMatchNum !== null                                ? <KnockoutMatchPage matchNum={koMatchNum} users={USERS_SORTED} /> :
       matchId                                            ? <MatchPredictionsPage {...resolveMatch(matchId)} users={USERS} /> :
       groupStatsLetter && ALL_GROUP_LETTERS.includes(groupStatsLetter) ? <GroupStatsPage groupLetter={groupStatsLetter} /> :
       pathname === '/results'                            ? <ResultsPage users={USERS_SORTED} /> :
       pathname === '/bracket'                            ? <BracketPage /> :
       pathname === '/odds-9k2'                            ? <WinProbPage /> :
       pathname === '/stats'                             ? <StatsPage users={USERS} /> :
       pathname === '/forms'                              ? <FormsPage users={USERS} usersSorted={USERS_SORTED} /> :
       pathname === '/updates'                           ? <UpdatesPage /> :
       pathname === '/rivalry'                            ? <RivalryPage /> :
       pathname === '/admin'                            ? <AdminPage /> :
       <HomePage />}
    </>
  )
}
