import FormPage from './pages/form/FormPage'
import FormsPage from './pages/forms/FormsPage'
import HomePage from './pages/home/HomePage'
import LeaderboardPage from './leaderboard/LeaderboardPage'
import MatchPredictionsPage from './pages/match/MatchPredictionsPage'
import ResultsPage from './pages/results/ResultsPage'
import { prepareResultsData } from './pages/results/prepareResultsData'
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

  return (
    <>
      <UpdateBanner updateAvailable={updateAvailable} />
      {matchId                                            ? <MatchPredictionsPage matchId={matchId} /> :
       pathname === '/leaderboard'                         ? <LeaderboardPage /> :
       pathname === '/results'                            ? <ResultsPage data={prepareResultsData(results.predictions)} /> :
       pathname === '/forms'                              ? <FormsPage /> :
       pathname === '/form'                               ? <FormPage /> :
       <HomePage />}
    </>
  )
}
