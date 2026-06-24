import type { ReactNode } from 'react'
import { GROUPS } from '../../shared/groups'
import type { MatchScores, Score } from '../../shared/types'
import ScoreInput from '../../formView/ScoreInput'

// A resolved slot has a flag (iso); a knockout slot that is still a descriptor
// ("סגנית א") has only a name.
type Team = { iso?: string; he: string }
type Match = { id: string; matchDate?: string; kickoffIST?: string }

function TeamName({ team }: { team: Team }) {
  return (
    <div className="match-team">
      {team.iso && <span className={`fi fi-${team.iso} match-team__flag`} />}
      <span className="match-team__name">{team.he}</span>
    </div>
  )
}

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
  // Set only while the match is actually in progress (from the live feed), so a
  // finished match never keeps the "חי" badge. `clock` is the match minute.
  liveScore?: { clock: string | null } | null
  // Ids of the chronologically adjacent matches, or null at the schedule edges.
  prevId?: string | null
  nextId?: string | null
  // Replaces the default group-stats badge — knockout pages pass their round
  // label here, with no href since there's no per-round stats page to link to.
  badge?: { label: ReactNode; href?: string }
}

export default function MatchHeader({ match, home, away, homeScore, awayScore, onHomeScore, onAwayScore, realScore = null, live = false, liveScore = null, prevId = null, nextId = null, badge }: Props) {
  const showLive = live && !realScore
  // A score that is showing while the match is still in progress is provisional,
  // so it gets a "חי" badge (with the minute) instead of "נגמר".
  const showLiveScore = !!realScore && !!liveScore
  return (
    <div className="match-header">
      {badge
        ? badge.href
          ? <a className="match-header__group-badge" href={badge.href}>{badge.label}</a>
          : <span className="match-header__group-badge" dir="rtl">{badge.label}</span>
        : <a className="match-header__group-badge" href={`/stats/groups/${match.id[0].toLowerCase()}`}>בית {GROUPS[match.id[0]]?.he} · משחק {match.id[1]} ›</a>}

      <div className="match-header__teams">
        {/* Step through matches in kickoff order. Previous sits on the right
            (›, backwards), next on the left (‹, forwards). They're anchored to
            the teams row and lifted above the flags so they never sit on top of
            a flag, which matters most on a narrow phone. Hidden at the edges. */}
        {prevId && (
          <a className="match-header__nav match-header__nav--prev" href={`/matches/${prevId.toLowerCase()}`} aria-label="המשחק הקודם">›</a>
        )}
        {nextId && (
          <a className="match-header__nav match-header__nav--next" href={`/matches/${nextId.toLowerCase()}`} aria-label="המשחק הבא">‹</a>
        )}

        <TeamName team={away} />

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
                {liveScore?.clock && <span className="match-header__live-clock">{liveScore.clock}</span>}
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

        <TeamName team={home} />
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
