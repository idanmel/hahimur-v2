import type { Match, MatchScores, Score } from '../../shared/types'
import { TEAMS } from '../../shared/groups'
import ScoreInput from '../../shared/ScoreInput'

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
}

export default function MatchRow({ match, scores, onChange, readOnly = false }: Props) {
  const set = (home: Score, away: Score) => onChange({ home, away })
  return (
    <div className="match-card">
      {(match.matchDate || match.kickoffIST) && (
        <div className="match-meta">
          {match.matchDate && <span>{dayOfWeek(match.matchDate)}, {match.matchDate}</span>}
          {match.matchDate && match.kickoffIST && <span className="match-meta-sep">|</span>}
          {match.kickoffIST && <span>{match.kickoffIST}</span>}
        </div>
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
    </div>
  )
}
