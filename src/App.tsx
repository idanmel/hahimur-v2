import FormPage from './pages/form/FormPage'
import FormsPage from './pages/forms/FormsPage'
import HomePage from './pages/home/HomePage'
import MatchPredictionsPage from './pages/match/MatchPredictionsPage'
import ResultsPage from './pages/results/ResultsPage'
import * as results from './results'
import { useUpdateCheck } from './shared/useUpdateCheck'
import UpdateBanner from './shared/UpdateBanner'

const FIVE_MINUTES = 5 * 60 * 1000

export default function App() {
  const pathname = window.location.pathname.toLowerCase()
  const { updateAvailable } = useUpdateCheck(FIVE_MINUTES)
  return (
    <>
      <UpdateBanner updateAvailable={updateAvailable} />
      {pathname === '/match/a1' ? <MatchPredictionsPage /> :
       pathname === '/results'  ? <ResultsPage results={results} /> :
       pathname === '/forms'    ? <FormsPage /> :
       pathname === '/form'     ? <FormPage /> :
       <HomePage />}
    </>
  )
}
