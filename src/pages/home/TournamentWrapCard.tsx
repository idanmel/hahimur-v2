import type { TournamentResults } from '../../shared/types'
import type { User } from '../../users/index'
import { TEAMS } from '../../shared/groups'
import { buildLeaderboardRows } from '../../leaderboard/leaderboardRows'
import { competitionRanks } from '../../leaderboard/rank'
import './TournamentWrapCard.css'

type Props = { users: User[]; results: TournamentResults }

// The home feed's permanent replacement: with no fixtures left to show, this
// card closes the tournament — world champion and final score, golden boot,
// and the pool winner — all derived from the same baked results the
// leaderboard reads.
export default function TournamentWrapCard({ users, results }: Props) {
  const champion = results.champion ? TEAMS[results.champion] : undefined

  const bootWinners = Array.isArray(results.goldenBootWinner)
    ? results.goldenBootWinner
    : results.goldenBootWinner ? [results.goldenBootWinner] : []
  const bootGoals = bootWinners[0] ? results.playerGoals?.[bootWinners[0]] : undefined

  // Pool winner(s) — competition ranking, so a tie at the top crowns everyone in it.
  const rows = buildLeaderboardRows(users, results)
  const ranks = competitionRanks(rows, row => row.total)
  const winners = rows.filter((_, i) => ranks[i] === 1)

  return (
    <section className="wrap-card" dir="rtl" data-testid="tournament-wrap">
      <div className="wrap-card__label">המונדיאל הסתיים</div>

      {champion && (
        <div className="wrap-card__champion">
          <span className="wrap-card__trophy" aria-hidden="true">🏆</span>
          {champion.iso && <span className={`fi fi-${champion.iso} fis wrap-card__flag`} aria-hidden="true" />}
          <div className="wrap-card__champion-name">{champion.he}</div>
          <div className="wrap-card__champion-sub">אלופת העולם 2026</div>
        </div>
      )}

      {bootWinners.length > 0 && (
        <p className="wrap-card__line">
          <span className="wrap-card__line-emoji" aria-hidden="true">⚽</span>
          נעל הזהב: <strong>{bootWinners.join(' + ')}</strong>
          {bootGoals != null && ` — ${bootGoals} שערים`}
        </p>
      )}

      {winners.length > 0 && (
        <p className="wrap-card__line wrap-card__line--pool">
          <span className="wrap-card__line-emoji" aria-hidden="true">🥇</span>
          זוכה ההימור: <strong>{winners.map(w => w.label).join(' + ')}</strong>
          {' — '}{winners[0].total} נק׳
        </p>
      )}

      <a className="wrap-card__link" href="/results">לכל התוצאות ›</a>
    </section>
  )
}
