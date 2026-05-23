import type { KnockoutMatch, MatchScores } from '../../shared/types'
import ScoreInput from '../../shared/ScoreInput'
import TeamSlot from '../../shared/TeamSlot'

interface Props {
  matches: KnockoutMatch[]
  predictions: Record<string, MatchScores>
  onChange: (matchId: string, scores: MatchScores) => void
  readOnly?: boolean
}

export default function KnockoutTable({ matches, predictions, onChange, readOnly = false }: Props) {
  return (
    <div className="ko-grid">
      {matches.map(m => {
        const id = String(m.matchNum)
        const pred = m.resolved ? (predictions[id] ?? { home: null, away: null }) : { home: null, away: null }
        const isDraw = m.resolved && pred.home !== null && pred.away !== null && pred.home === pred.away
        const needsDrawWinner = isDraw && !pred.drawWinner
        return (
          <div key={m.matchNum} className={`ko-card${m.resolved ? ' ko-card--resolved' : ''}${needsDrawWinner ? ' ko-card--draw-pending' : ''}`}>
            <div className="ko-matchnum-row">
              <span className="ko-matchnum">{m.matchNum}</span>
              {isDraw && !pred.drawWinner && (
                <span className="ko-draw-badge">
                  בחר מנצחת
                </span>
              )}
            </div>
            <div className="ko-team-row">
              <div
                className={`ko-team-click${!readOnly && isDraw ? ` ko-team-click--selectable${pred.drawWinner === 'home' ? ' ko-team-click--selected' : pred.drawWinner === 'away' ? ' ko-team-click--unselected' : ''}` : ''}`}
                onClick={!readOnly && isDraw ? () => onChange(id, { ...pred, drawWinner: 'home' }) : undefined}
                role={!readOnly && isDraw ? 'button' : undefined}
                tabIndex={!readOnly && isDraw ? 0 : undefined}
              >
                <TeamSlot name={m.home} />
              </div>
              {readOnly
                ? <span className="match-score-static">{pred.home ?? '–'}</span>
                : <ScoreInput label={m.home} value={pred.home} disabled={!m.resolved} onChange={v => onChange(id, { home: v, away: pred.away })} />
              }
            </div>
            <div className="ko-row-divider" />
            <div className="ko-team-row">
              <div
                className={`ko-team-click${!readOnly && isDraw ? ` ko-team-click--selectable${pred.drawWinner === 'away' ? ' ko-team-click--selected' : pred.drawWinner === 'home' ? ' ko-team-click--unselected' : ''}` : ''}`}
                onClick={!readOnly && isDraw ? () => onChange(id, { ...pred, drawWinner: 'away' }) : undefined}
                role={!readOnly && isDraw ? 'button' : undefined}
                tabIndex={!readOnly && isDraw ? 0 : undefined}
              >
                <TeamSlot name={m.away} />
              </div>
              {readOnly
                ? <span className="match-score-static">{pred.away ?? '–'}</span>
                : <ScoreInput label={m.away} value={pred.away} disabled={!m.resolved} onChange={v => onChange(id, { home: pred.home, away: v })} />
              }
            </div>
          </div>
        )
      })}
    </div>
  )
}
