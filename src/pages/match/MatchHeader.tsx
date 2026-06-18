import { GROUPS } from '../../shared/groups'
import type { MatchScores, Score } from '../../shared/types'
import ScoreInput from '../../formView/ScoreInput'

type Team = { iso: string; he: string }
type Match = { id: string; matchDate?: string; kickoffIST?: string }

type Props = {
  match: Match
  home: Team
  away: Team
  homeScore: Score
  awayScore: Score
  onHomeScore: (v: Score) => void
  onAwayScore: (v: Score) => void
  realScore?: MatchScores | null
  live?: boolean
}

export default function MatchHeader({ match, home, away, homeScore, awayScore, onHomeScore, onAwayScore, realScore = null, live = false }: Props) {
  const showLive = live && !realScore
  // A score that is showing while the match is still in progress is provisional,
  // so it gets a "חי" badge instead of "נגמר".
  const showLiveScore = !!realScore && live
  return (
    <div className="match-header">
      <a className="match-header__group-badge" href={`/stats/groups/${match.id[0].toLowerCase()}`}>בית {GROUPS[match.id[0]]?.he} · משחק {match.id[1]} ›</a>

      <div className="match-header__teams">
        <div className="match-team">
          <span className={`fi fi-${away.iso} match-team__flag`} />
          <span className="match-team__name">{away.he}</span>
        </div>

        {realScore ? (
          <div className={`match-header__vs match-header__vs--final${showLiveScore ? ' match-header__vs--live' : ''}`} data-testid="real-score">
            <div className="match-header__final-score">
              <span className="match-header__final-digit">{realScore.away}</span>
              <span className="match-header__vs-text">–</span>
              <span className="match-header__final-digit">{realScore.home}</span>
            </div>
            {showLiveScore ? (
              <span className="match-header__final-badge match-header__final-badge--live" data-testid="live-score-badge">
                <span className="match-header__live-dot" />
                חי
              </span>
            ) : (
              <span className="match-header__final-badge">נגמר</span>
            )}
          </div>
        ) : (
          <div className="match-header__vs">
            <ScoreInput label={away.he} value={awayScore} onChange={onAwayScore} />
            <span className="match-header__vs-text">–</span>
            <ScoreInput label={home.he} value={homeScore} onChange={onHomeScore} />
          </div>
        )}

        <div className="match-team">
          <span className={`fi fi-${home.iso} match-team__flag`} />
          <span className="match-team__name">{home.he}</span>
        </div>
      </div>

      {showLive ? (
        <div className="match-header__live" data-testid="live-indicator" dir="rtl">
          <span className="match-header__live-badge">
            <span className="match-header__live-dot" />
            המשחק בעיצומו
          </span>
          <span className="match-header__live-hint">הזינו את התוצאה הנוכחית וראו מי לוקח נקודות</span>
        </div>
      ) : (
        <div className="match-header__meta">
          <span>{match.matchDate}</span>
          {!realScore && (
            <>
              <span className="match-header__meta-dot" />
              <span>{match.kickoffIST}</span>
              <span className="match-header__meta-dot" />
              <span>שעון ישראל</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
