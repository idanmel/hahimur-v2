import type { TournamentResults } from '../../shared/types'
import type { User } from '../../users/index'
import { buildLeaderboardRows } from '../../leaderboard/leaderboardRows'
import { MEDALS } from '../../leaderboard/medals'
import { competitionRanks } from '../../leaderboard/rank'
import './TopThreeCard.css'

type Props = { users: User[]; results: TournamentResults }

export default function TopThreeCard({ users, results }: Props) {
  const rows = buildLeaderboardRows(users, results)
  const ranks = competitionRanks(rows, row => row.total)
  const topThree = rows
    .map((row, i) => ({ ...row, rank: ranks[i] }))
    .filter(row => row.rank <= 3)

  return (
    <div dir="rtl" className="top-three" data-testid="top-three">
      <div className="top-three__heading">הצמרת</div>
      {topThree.map(row => (
        <div key={row.label} className="top-three__row" data-testid="top-three-row">
          <span className="top-three__medal">{MEDALS[row.rank]}</span>
          <span className="top-three__name">{row.label}</span>
          <span className="top-three__points" dir="ltr">{row.total}</span>
        </div>
      ))}
      <a className="top-three__link" href="/results">לכל התוצאות ›</a>
    </div>
  )
}
