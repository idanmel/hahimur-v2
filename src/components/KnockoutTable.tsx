import type { KnockoutMatch, MatchScores } from '../types'
import ScoreInput from './ScoreInput'
import TeamSlot from './TeamSlot'

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
            <TeamSlot name={m.home} />
            <div className="r32-score-zone">
              <ScoreInput
                label={m.home}
                value={pred.home}
                onChange={v => onChange(m.matchId, { home: v, away: pred.away })}
              />
              <span className="r32-divider-word">:</span>
              <ScoreInput
                label={m.away}
                value={pred.away}
                onChange={v => onChange(m.matchId, { home: pred.home, away: v })}
              />
            </div>
            <TeamSlot name={m.away} />
          </div>
        )
      })}
    </div>
  )
}
