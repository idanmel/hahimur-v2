import type { PredictionsState } from '../../shared/types'
import PredictionsView from '../../predictionsView/PredictionsView'
import Nav from '../../Nav'

interface Results {
  predictions: PredictionsState
  topGoalscorer: string
}

interface Props {
  results: Results
}

export default function ResultsPage({ results }: Props) {
  return (
    <>
      <header className="poster-header">
        <div className="poster-bar poster-bar--top" />
        <div className="poster-center">
          <p className="poster-overline">גביע העולם FIFA</p>
          <div className="poster-mundial">MUNDIAL <span className="poster-year">2026</span></div>
          <h1 className="poster-subtitle">תוצאות</h1>
        </div>
        <div className="poster-bar poster-bar--bottom" />
      </header>
      <Nav />

      <main>
        <PredictionsView predictions={results.predictions} topGoalscorer={results.topGoalscorer} />
      </main>
    </>
  )
}
