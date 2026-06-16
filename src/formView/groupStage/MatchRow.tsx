import type { Match, MatchScores, Score } from '../../shared/types'
import { OUTCOME_LABEL, type MatchOutcome } from '../../leaderboard/points'
import { TEAMS } from '../../shared/groups'
import ScoreInput from '../ScoreInput'

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

function dayOfWeek(matchDate: string): string {
  const day = parseInt(matchDate)
  const d = new Date(2026, 5, day) // June 2026
  return `יום ${HE_DAYS[d.getDay()]}`
}

interface Props {
  match: Match
  scores: MatchScores
  onChange: (scores: MatchScores) => void
  readOnly?: boolean
  href?: string
  hideDate?: boolean
  groupLabel?: string
  outcome?: MatchOutcome
  points?: number
  actualScore?: MatchScores
}

export default function MatchRow({ match, scores, onChange, readOnly = false, href, hideDate = false, groupLabel, outcome, points, actualScore }: Props) {
  const set = (home: Score, away: Score) => onChange({ home, away })
  const Card = href && readOnly ? 'a' : 'div'
  const outcomeClass = outcome ? ` match-card--${outcome}` : ''
  const cardProps = href && readOnly
    ? { href, className: `match-card${outcomeClass}` }
    : { className: `match-card${outcomeClass}` }
  return (
    <Card {...cardProps}>
      {hideDate ? (
        (match.kickoffIST || groupLabel) && (
          <div className="match-meta">
            {groupLabel && <span className="match-meta-group">{groupLabel}</span>}
            {groupLabel && match.kickoffIST && <span className="match-meta-sep">|</span>}
            {match.kickoffIST && <span>{match.kickoffIST}</span>}
          </div>
        )
      ) : (
        (match.matchDate || match.kickoffIST) && (
          <div className="match-meta">
            {match.matchDate && <span>{dayOfWeek(match.matchDate)}, {match.matchDate}</span>}
            {match.matchDate && match.kickoffIST && <span className="match-meta-sep">|</span>}
            {match.kickoffIST && <span>{match.kickoffIST}</span>}
          </div>
        )
      )}
      <div className="match-team match-team--home">
        <span className={`fi fi-${TEAMS[match.homeTeam].iso} match-team-flag`} />
        <span className="match-team-name">{TEAMS[match.homeTeam].he}</span>
      </div>
      <div className="match-score-zone">
        {readOnly ? (
          <>
            <span data-testid="score-home" className="match-score-static">{scores.home ?? '–'}</span>
            <span className="match-score-sep">:</span>
            <span data-testid="score-away" className="match-score-static">{scores.away ?? '–'}</span>
          </>
        ) : (
          <>
            <ScoreInput
              label={TEAMS[match.homeTeam].he}
              value={scores.home}
              onChange={(v) => set(v, scores.away)}
            />
            <span className="match-score-sep">:</span>
            <ScoreInput
              label={TEAMS[match.awayTeam].he}
              value={scores.away}
              onChange={(v) => set(scores.home, v)}
            />
          </>
        )}
      </div>
      <div className="match-team match-team--away">
        <span className="match-team-name">{TEAMS[match.awayTeam].he}</span>
        <span className={`fi fi-${TEAMS[match.awayTeam].iso} match-team-flag`} />
      </div>
      {outcome && (
        <div className={`match-result match-result--${outcome}`} data-testid="match-outcome">
          <span className="match-result__label">{OUTCOME_LABEL[outcome]}</span>
          {actualScore && (
            <span className="match-result__actual-score" dir="ltr">{actualScore.away}:{actualScore.home}</span>
          )}
          <span className="match-result__points">{points! > 0 ? `+${points}` : `${points}`}</span>
        </div>
      )}
      {href && readOnly ? (
        <div className="match-card-hint" aria-hidden="true">
          <span className="match-card-hint__label">לפרטים</span>
          <span className="match-card-hint__chevron">›</span>
        </div>
      ) : href ? (
        <a href={href} className="match-card-hint" onClick={e => e.stopPropagation()}>
          <span className="match-card-hint__label">לפרטים</span>
          <span className="match-card-hint__chevron">›</span>
        </a>
      ) : null}
    </Card>
  )
}
