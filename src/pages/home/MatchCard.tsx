import { GROUPS, TEAMS } from '../../shared/groups'
import type { GroupMatch, MatchScores } from '../../shared/types'
import type { User } from '../../users/index'
import { singleMatchOutcome, singleMatchPoints, OUTCOME_LABEL, POINTS_PER_GOAL } from '../../leaderboard/points'
import { isLive } from '../../shared/matchOrder'
import { topPrediction } from './nextMatch'
import './MatchCard.css'

type Props = {
  users: User[]
  match: GroupMatch
  currentUser?: User
  isNext?: boolean
  // When set, the match has been played: show the real score and, if the user
  // predicted it, how they did. This is what turns a "next" card into a "result" card.
  result?: MatchScores
  // player → match ID → goals, so we can credit the user's picked scorer for this match.
  playerMatchGoals?: Record<string, Record<string, number>>
  // "Now" for deciding whether the match is in progress; injectable for tests.
  now?: Date
  // The live feed's in-progress matches (match id → status). When supplied, it is
  // the source of truth for "live" — a finished match drops out of it immediately,
  // so the badge can't linger like the wall-clock window does. Absent (tests /
  // no feed) we fall back to the kickoff window.
  liveMatches?: Record<string, { clock: string | null }>
}

export default function MatchCard({ users, match, currentUser, isNext = false, result, playerMatchGoals = {}, now = new Date(), liveMatches }: Props) {
  const home = TEAMS[match.homeTeam]
  const away = TEAMS[match.awayTeam]
  const consensus = topPrediction(users, match.id)
  const mine = currentUser?.predictions[match.id]
  const outcome = result && mine ? singleMatchOutcome(mine, result) : null
  const points = result && mine ? singleMatchPoints(match.id, mine, result) : 0
  const scorerGoals = currentUser ? playerMatchGoals[currentUser.topGoalscorer]?.[match.id] ?? 0 : 0
  const scorerPoints = scorerGoals * POINTS_PER_GOAL
  // The match is in progress: the live feed is authoritative when present,
  // otherwise fall back to the kickoff window. Never live once a final score is in.
  const live = !result && (liveMatches ? !!liveMatches[match.id] : isLive(match, now))

  return (
    <div dir="rtl" className={`next-match${live ? ' next-match--live' : ''}`} data-testid="next-match">
      <div className="next-match__heading">{isNext ? 'המשחק הבא · ' : ''}בית {GROUPS[match.id[0]].he}</div>

      <div className="next-match__teams">
        <div className="next-match__team">
          <span className={`fi fi-${home.iso} next-match__flag`} />
          <span className="next-match__name">{home.he}</span>
        </div>
        {result ? (
          <div className="next-match__score-block">
            <div className="next-match__when">{match.matchDate} · {match.kickoffIST}</div>
            <div className="next-match__score" data-testid="match-result" dir="ltr">
              {result.away}–{result.home}
            </div>
          </div>
        ) : live ? (
          <div className="next-match__live" data-testid="live-indicator">
            <span className="next-match__live-badge">
              <span className="next-match__live-dot" />
              משחק חי
            </span>
            <span className="next-match__live-time">{match.kickoffIST}</span>
          </div>
        ) : (
          <div className="next-match__kickoff">
            <span className="next-match__date">{match.matchDate}</span>
            <span className="next-match__time">{match.kickoffIST}</span>
          </div>
        )}
        <div className="next-match__team">
          <span className={`fi fi-${away.iso} next-match__flag`} />
          <span className="next-match__name">{away.he}</span>
        </div>
      </div>

      {consensus && (
        <div className="next-match__consensus" data-testid="consensus">
          הניחוש הנפוץ: <strong dir="ltr">{consensus.away}–{consensus.home}</strong>
          {' '}({consensus.count} מתוך {consensus.total})
        </div>
      )}

      {outcome && mine ? (
        <div className={`match-verdict match-verdict--${outcome}`} data-testid="your-outcome">
          <span className="match-verdict__pick">
            <span className="match-verdict__label">הניחוש שלך</span>
            <strong dir="ltr">{mine.away}–{mine.home}</strong>
          </span>
          <span className="match-verdict__result">
            {OUTCOME_LABEL[outcome]}{points > 0 ? ` · ${points} נק׳` : ''}
          </span>
        </div>
      ) : mine ? (
        <div className="next-match__mine" data-testid="your-prediction">
          הניחוש שלך: <strong dir="ltr">{mine.away}–{mine.home}</strong>
        </div>
      ) : null}

      {scorerGoals > 0 && (
        <div className="next-match__scorer" data-testid="your-scorer">
          <span className="next-match__scorer-who">
            <span className="next-match__scorer-crown" aria-hidden="true">👑</span>
            המלך שלך · <strong>{currentUser!.topGoalscorer}</strong>
          </span>
          <span className="next-match__scorer-tally">
            כבש {scorerGoals} {scorerGoals === 1 ? 'שער' : 'שערים'}
            <strong className="next-match__scorer-pts">+{scorerPoints} נק׳</strong>
          </span>
        </div>
      )}

      <a className="next-match__link" href={`/matches/${match.id}`}>לעמוד המשחק ›</a>
    </div>
  )
}
