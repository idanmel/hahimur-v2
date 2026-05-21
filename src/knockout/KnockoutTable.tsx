import type { KnockoutMatch, MatchScores } from '../shared/types'
import ScoreInput from '../shared/ScoreInput'
import TeamSlot from '../shared/TeamSlot'

interface Props {
  matches: KnockoutMatch[]
  predictions: Record<string, MatchScores>
  onChange: (matchId: string, scores: MatchScores) => void
}

export default function KnockoutTable({ matches, predictions, onChange }: Props) {
  return (
    <div className="r32-grid">
      {matches.map(m => {
        const pred = predictions[m.matchId] ?? { home: null, away: null }
        return (
          <div key={m.matchNum} className={`r32-card${m.resolved ? ' r32-card--resolved' : ''}`}>
            <span className="r32-matchnum">{m.matchNum}</span>
            <div className="r32-team-row">
              <TeamSlot name={m.home} />
              <ScoreInput
                label={m.home}
                value={pred.home}
                onChange={v => onChange(m.matchId, { home: v, away: pred.away })}
              />
            </div>
            <div className="r32-row-divider" />
            <div className="r32-team-row">
              <TeamSlot name={m.away} />
              <ScoreInput
                label={m.away}
                value={pred.away}
                onChange={v => onChange(m.matchId, { home: pred.home, away: v })}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
