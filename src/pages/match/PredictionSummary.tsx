import { isUnpredicted, type MatchScores } from '../../shared/types'
import type { User } from '../../users/index'

type Props = {
  matchId: string
  homeLabel: string
  awayLabel: string
  users: User[]
  actualScore?: MatchScores | null
  // How to read a user's predicted score for this match. Defaults to the flat
  // predictions map; knockout pages pass an orientation-corrected lookup so a
  // bettor who had the two teams reversed still counts toward the real side.
  scoreFor?: (u: User) => MatchScores | null | undefined
}

export default function PredictionSummary({ matchId, homeLabel, awayLabel, users, actualScore = null, scoreFor }: Props) {
  let homeWins = 0, draws = 0, awayWins = 0
  for (const u of users) {
    const p = scoreFor ? scoreFor(u) : u.predictions[matchId]
    if (!p || isUnpredicted(p)) continue
    if (p.home! > p.away!) homeWins++
    else if (p.home! < p.away!) awayWins++
    else draws++
  }
  const total = homeWins + draws + awayWins
  const pct = (n: number) => total === 0 ? 33.333 : (n / total) * 100

  const actual = actualScore
    ? actualScore.home! > actualScore.away! ? 'home' : actualScore.home! < actualScore.away! ? 'away' : 'draw'
    : null
  const colClass = (col: 'home' | 'draw' | 'away') =>
    `pred-summary__col pred-summary__col--${col}${actual ? (actual === col ? ' pred-summary__col--actual' : ' pred-summary__col--off') : ''}`

  return (
    <div className="pred-summary">
      <div className="pred-summary__cols">
        <div className={colClass('away')}>
          <span className="pred-summary__count" data-testid="pred-count">{awayWins}</span>
          <span className="pred-summary__label">{awayLabel}</span>
        </div>
        <div className={colClass('draw')}>
          <span className="pred-summary__count" data-testid="pred-count">{draws}</span>
          <span className="pred-summary__label">תיקו</span>
        </div>
        <div className={colClass('home')}>
          <span className="pred-summary__count" data-testid="pred-count">{homeWins}</span>
          <span className="pred-summary__label">{homeLabel}</span>
        </div>
      </div>
      <div className="pred-summary__bar" aria-hidden="true">
        <div className="pred-summary__seg pred-summary__seg--away" style={{ width: `${pct(awayWins)}%` }} />
        <div className="pred-summary__seg pred-summary__seg--draw" style={{ width: `${pct(draws)}%` }} />
        <div className="pred-summary__seg pred-summary__seg--home" style={{ width: `${pct(homeWins)}%` }} />
      </div>
    </div>
  )
}
