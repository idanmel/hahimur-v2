import type { R32Match, MatchScores } from '../types'
import ScoreInput from './ScoreInput'
import TeamSlot from './TeamSlot'

interface Props {
  matches: R32Match[]
  predictions: Record<string, MatchScores>
  onChange: (matchId: string, scores: MatchScores) => void
}

export default function Round32Table({ matches, predictions, onChange }: Props) {
  return (
    <div className="r32-grid">
      {matches.map(m => {
        const pred = predictions[String(m.matchNum)] ?? { home: null, away: null }
        return (
          <div key={m.matchNum} className={`r32-card${m.resolved ? ' r32-card--resolved' : ''}`}>
            <span className="r32-matchnum">{m.matchNum}</span>
            <TeamSlot name={m.home} />
            {m.resolved && (
              <div className="r32-score-zone">
                <ScoreInput
                  label={m.home}
                  value={pred.home}
                  onChange={v => onChange(String(m.matchNum), { home: v, away: pred.away })}
                />
                <span className="r32-divider-word">:</span>
                <ScoreInput
                  label={m.away}
                  value={pred.away}
                  onChange={v => onChange(String(m.matchNum), { home: pred.home, away: v })}
                />
              </div>
            )}
            {!m.resolved && (
              <div className="r32-divider">
                <span className="r32-divider-line" />
                <span className="r32-divider-word">נגד</span>
                <span className="r32-divider-line" />
              </div>
            )}
            <TeamSlot name={m.away} />
          </div>
        )
      })}
    </div>
  )
}
