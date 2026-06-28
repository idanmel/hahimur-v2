import { useEffect } from 'react'
import PageLayout from '../../shared/PageLayout'
import Bracket from '../../shared/Bracket'
import { reportUsage } from '../../shared/reportUsage'
import { tournamentResults } from '../../tournament-results'

export default function BracketPage() {
  // fire-and-forget on load so we can later measure whether people open this page
  useEffect(() => { reportUsage('bracket-view') }, [])

  return (
    <PageLayout title="הטבלה">
      <Bracket stages={tournamentResults.knockoutStages} />
    </PageLayout>
  )
}
