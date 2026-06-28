import PageLayout from '../../shared/PageLayout'
import WinProbabilityView from '../../leaderboard/winprob/WinProbabilityView'
import { useCurrentUser } from '../../shared/useCurrentUser'
import { tournamentResults as realTournamentResults } from '../../tournament-results'
import { USERS } from '../../users'
import '../../leaderboard/LeaderboardPage.css'

// Deliberately unlinked: reachable only by its obscure URL so the win-odds model
// (which leans on theoretical team strength) stays out of the shared navigation.
export default function WinProbPage() {
  const { me } = useCurrentUser()
  return (
    <PageLayout title="סיכויי זכייה">
      <div className="pg-page" dir="rtl">
        <section className="pg-lb-section">
          <div className="pg-lb-header">
            <h2 className="pg-lb-title">סיכויי זכייה</h2>
          </div>
          <WinProbabilityView results={realTournamentResults} me={me} users={USERS} />
        </section>
      </div>
    </PageLayout>
  )
}
