import type { TournamentResults } from '../../shared/types'
import type { User } from '../../users/index'
import { buildLeaderboardRows } from '../../leaderboard/leaderboardRows'
import { competitionRanks } from '../../leaderboard/rank'
import './ChampionHero.css'

type Props = { users: User[]; results: TournamentResults }

const CONFETTI_COUNT = 14

// The home page's centerpiece now that the tournament is over: the pool
// champion, poster-sized. Derived from the same baked results as the
// leaderboard, so a tie at the top would crown everyone in it.
export default function ChampionHero({ users, results }: Props) {
  const rows = buildLeaderboardRows(users, results)
  if (rows.length === 0) return null

  const ranks = competitionRanks(rows, row => row.total)
  const winners = rows.filter((_, i) => ranks[i] === 1)

  return (
    <section className="champion-hero" dir="rtl" data-testid="champion-hero">
      <div className="champion-hero__rays" aria-hidden="true" />
      <div className="champion-hero__confetti" aria-hidden="true">
        {Array.from({ length: CONFETTI_COUNT }, (_, i) => (
          <i key={i} className={`champion-hero__piece champion-hero__piece--${i}`} />
        ))}
      </div>

      <p className="champion-hero__eyebrow">זוכה ההימור · מונדיאל 2026</p>
      <span className="champion-hero__trophy" aria-hidden="true">🏆</span>
      <h2 className="champion-hero__name">{winners.map(w => w.label).join(' + ')}</h2>
      <div className="champion-hero__points" dir="rtl">
        <span className="champion-hero__points-value" dir="ltr">{winners[0].total}</span>
        <span className="champion-hero__points-unit">נקודות</span>
      </div>
      <a className="champion-hero__link" href="/results">לטבלה המלאה ›</a>
    </section>
  )
}
