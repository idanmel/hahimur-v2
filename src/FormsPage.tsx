import PredictionsView from './PredictionsView'
import { predictions as talPredictions, topGoalscorer as talGoalscorer } from './users/tal-lichter'

export default function FormsPage() {
  return (
    <>
      <header className="poster-header">
        <div className="poster-bar poster-bar--top" />
        <div className="poster-center">
          <p className="poster-overline">גביע העולם FIFA</p>
          <div className="poster-mundial">MUNDIAL <span className="poster-year">2026</span></div>
          <h1 className="poster-subtitle">הטפסים</h1>
        </div>
        <div className="poster-bar poster-bar--bottom" />
      </header>

      <main>
        <section>
          <h2>טל ליכטר</h2>
          <PredictionsView predictions={talPredictions} topGoalscorer={talGoalscorer} />
        </section>
      </main>
    </>
  )
}
