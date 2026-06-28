import { GROUPS, TEAMS } from '../../shared/groups'
import type { GroupMatch, MatchScores } from '../../shared/types'
import type { User } from '../../users/index'
import { singleMatchOutcome, singleMatchPoints, OUTCOME_LABEL, POINTS_PER_GOAL } from '../../leaderboard/points'
import { isLive } from '../../shared/matchOrder'
import { topPrediction, type TopPrediction } from './nextMatch'
import './MatchCard.css'

type Props = {
  users: User[]
  match: GroupMatch
  currentUser?: User
  isNext?: boolean
  // Knockout overrides: a group card derives these from the match id, but a
  // knockout fixture has no group letter and its predictions are matched by
  // team, not id. When supplied they drive the card; when absent it falls back
  // to the group behavior. `heading` replaces "בית X" with the round label;
  // `consensus`/`mine` carry the team-matched popular and personal predictions
  // (null/undefined means "computed, nobody" — distinct from "not supplied").
  heading?: string
  consensus?: TopPrediction | null
  // null = "computed, nobody" (a KO card where the user didn't call this pairing) —
  // distinct from undefined = "not supplied" (a group card that falls back to id).
  mine?: MatchScores | null
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
  // no feed) we fall back to the kickoff window. `home`/`away` carry the current
  // live score so the card can show it without opening the match page.
  liveMatches?: Record<string, { clock: string | null; home?: number; away?: number }>
}

export default function MatchCard({ users, match, currentUser, isNext = false, result, playerMatchGoals = {}, now = new Date(), liveMatches, heading, consensus: consensusOverride, mine: mineOverride }: Props) {
  const home = TEAMS[match.homeTeam]
  const away = TEAMS[match.awayTeam]
  const consensus = consensusOverride !== undefined ? consensusOverride : topPrediction(users, match.id)
  // A KO card supplies `mine` explicitly (a score, or null when the user didn't
  // call this pairing) — never fall back to predictions[id], whose numeric KO key
  // holds the user's *slot* pick for different teams. Only an unsupplied (group)
  // override falls back to the by-id group prediction.
  const mine = mineOverride !== undefined ? (mineOverride ?? undefined) : currentUser?.predictions[match.id]
  // A KO card explicitly says "nobody" (null) when the selected user didn't call
  // this pairing — show "לא משתתף" rather than nothing, so it's clear they're out
  // of this match (not just missing a score). Only meaningful with a user picked.
  const koNonParticipant = mineOverride === null && !!currentUser
  const outcome = result && mine ? singleMatchOutcome(mine, result) : null
  const points = result && mine ? singleMatchPoints(match.id, mine, result) : 0
  const scorerGoals = currentUser ? playerMatchGoals[currentUser.topGoalscorer]?.[match.id] ?? 0 : 0
  const scorerPoints = scorerGoals * POINTS_PER_GOAL
  // The match is in progress: the live feed is authoritative when present,
  // otherwise fall back to the kickoff window. Never live once a final score is in.
  const liveStatus = liveMatches?.[match.id]
  const live = !result && (liveMatches ? !!liveStatus : isLive(match, now))
  // The live score, shown on the card mid-match (away–home, matching consensus
  // order). Only present once the feed reports both teams' goals.
  const liveScore = liveStatus && liveStatus.home != null && liveStatus.away != null
    ? { home: liveStatus.home, away: liveStatus.away }
    : null

  return (
    <div dir="rtl" className={`next-match${live ? ' next-match--live' : ''}`} data-testid="next-match">
      <div className="next-match__heading">{isNext ? 'המשחק הבא · ' : ''}{heading ?? `בית ${GROUPS[match.id[0]].he}`}</div>

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
            {liveScore && (
              <div className="next-match__score next-match__score--live" data-testid="live-match-result" dir="ltr">
                {liveScore.away}–{liveScore.home}
              </div>
            )}
            <span className="next-match__live-badge">
              <span className="next-match__live-dot" />
              משחק חי
            </span>
            <span className="next-match__live-time">{liveStatus?.clock ?? match.kickoffIST}</span>
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
      ) : koNonParticipant ? (
        <div className="next-match__mine next-match__mine--out" data-testid="not-participating">
          לא משתתף
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
