import type { Match, MatchScores, Score } from '../types'
import { TEAM_NAMES_HE, TEAM_ISO } from '../lib/groups'
import ScoreInput from './ScoreInput'

interface Props {
  match: Match
  scores: MatchScores
  onChange: (scores: MatchScores) => void
}

export default function MatchRow({ match, scores, onChange }: Props) {
  const set = (home: Score, away: Score) => onChange({ home, away })
  return (
    <div className="match-card">
      {(match.matchDate || match.kickoffIST) && (
        <div className="match-meta">
          {match.matchDate && <span>{match.matchDate}</span>}
          {match.matchDate && match.kickoffIST && <span className="match-meta-sep">|</span>}
          {match.kickoffIST && <span>{match.kickoffIST}</span>}
        </div>
      )}
      <div className="match-team match-team--home">
        <span className={`fi fi-${TEAM_ISO[match.homeTeam]} match-team-flag`} />
        <span className="match-team-name">{TEAM_NAMES_HE[match.homeTeam]}</span>
      </div>
      <div className="match-score-zone">
        <ScoreInput
          label={TEAM_NAMES_HE[match.homeTeam]}
          value={scores.home}
          onChange={(v) => set(v, scores.away)}
        />
        <span className="match-score-sep">:</span>
        <ScoreInput
          label={TEAM_NAMES_HE[match.awayTeam]}
          value={scores.away}
          onChange={(v) => set(scores.home, v)}
        />
      </div>
      <div className="match-team match-team--away">
        <span className="match-team-name">{TEAM_NAMES_HE[match.awayTeam]}</span>
        <span className={`fi fi-${TEAM_ISO[match.awayTeam]} match-team-flag`} />
      </div>
    </div>
  )
}
