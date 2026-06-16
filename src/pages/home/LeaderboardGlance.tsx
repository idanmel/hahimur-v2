import type { TournamentResults } from '../../shared/types'
import type { User } from '../../users/index'
import { buildLeaderboardRows } from '../../leaderboard/leaderboardRows'
import { MEDALS } from '../../leaderboard/medals'
import { competitionRanks } from '../../leaderboard/rank'
import './LeaderboardGlance.css'

type Props = { users: User[]; results: TournamentResults; currentUser?: User }

export default function LeaderboardGlance({ users, results, currentUser }: Props) {
  const rows = buildLeaderboardRows(users, results)
  const ranks = competitionRanks(rows, row => row.total)
  const ranked = rows.map((row, i) => ({ ...row, rank: ranks[i] }))
  const topThree = ranked.filter(row => row.rank <= 3)

  // Surface the viewer's own standing right here when they aren't already on
  // the podium — otherwise they'd have to click through to the full table.
  const me = currentUser && ranked.find(row => row.label === currentUser.label)
  const showMe = me && me.rank > 3

  return (
    <div dir="rtl" className="top-three" data-testid="top-three">
      <div className="top-three__heading">הצמרת</div>
      {topThree.map(row => (
        <div
          key={row.label}
          className={`top-three__row top-three__row--rank-${row.rank}`}
          data-testid="top-three-row"
        >
          <span className="top-three__medal">{MEDALS[row.rank]}</span>
          <span className="top-three__name">{row.label}</span>
          <span className="top-three__points" dir="ltr">{row.total}</span>
        </div>
      ))}
      {showMe && (
        <div className="top-three__row top-three__row--you" data-testid="top-three-you">
          <span className="top-three__medal top-three__rank" dir="ltr">{me.rank}</span>
          <span className="top-three__name">{me.label}</span>
          <span className="top-three__points" dir="ltr">{me.total}</span>
        </div>
      )}
      <a className="top-three__link" href="/results">לכל התוצאות ›</a>
    </div>
  )
}
