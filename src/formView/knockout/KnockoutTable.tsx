import type { KnockoutMatch, MatchScores } from '../../shared/types'
import ScoreInput from '../ScoreInput'
import TeamSlot from './TeamSlot'

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

function dayOfWeek(matchDate: string): string {
  const parts = matchDate.split(' ')
  const day = parseInt(parts[0])
  const month = parts[1] === 'ביולי' ? 6 : 5
  return `יום ${HE_DAYS[new Date(2026, month, day).getDay()]}`
}

interface Props {
  matches: KnockoutMatch[]
  predictions: Record<string, MatchScores>
  onChange: (matchId: string, scores: MatchScores) => void
  readOnly?: boolean
  lockedMatchIds?: Set<string>
}

export default function KnockoutTable({ matches, predictions, onChange, readOnly = false, lockedMatchIds }: Props) {
  return (
    <div className="ko-grid">
      {matches.map(m => {
        const id = String(m.matchNum)
        const isLocked = readOnly || (lockedMatchIds?.has(id) ?? false)
        const pred = (isLocked || m.resolved) ? (m.scores ?? predictions[id] ?? { home: null, away: null }) : { home: null, away: null }
        const isDraw = m.resolved && pred.home !== null && pred.away !== null && pred.home === pred.away
        const needsDrawWinner = isDraw && !pred.drawWinner
        return (
          <div key={m.matchNum} className={`ko-card${m.resolved ? ' ko-card--resolved' : ''}${needsDrawWinner ? ' ko-card--draw-pending' : ''}`}>
            {(m.matchDate || m.kickoffIST) && (
              <div className="match-meta">
                {m.matchDate && <span>{dayOfWeek(m.matchDate)}, {m.matchDate}</span>}
                {m.matchDate && m.kickoffIST && <span className="match-meta-sep">|</span>}
                {m.kickoffIST && <span>{m.kickoffIST}</span>}
              </div>
            )}
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
                className={`ko-team-click${
                  !isLocked && isDraw
                    ? ` ko-team-click--selectable${pred.drawWinner === 'home' ? ' ko-team-click--selected' : pred.drawWinner === 'away' ? ' ko-team-click--unselected' : ''}`
                    : isDraw && pred.drawWinner
                      ? pred.drawWinner === 'home' ? ' ko-team-click--selected' : ' ko-team-click--unselected'
                      : ''
                }`}
                onClick={!isLocked && isDraw ? () => onChange(id, { ...pred, drawWinner: 'home' }) : undefined}
                role={!isLocked && isDraw ? 'button' : undefined}
                tabIndex={!isLocked && isDraw ? 0 : undefined}
              >
                <TeamSlot name={m.home} />
              </div>
              {isLocked
                ? <span className="match-score-static">{pred.home ?? '–'}</span>
                : <ScoreInput label={m.home} value={pred.home} disabled={!m.resolved} onChange={v => onChange(id, { home: v, away: pred.away })} />
              }
            </div>
            <div className="ko-row-divider" />
            <div className="ko-team-row">
              <div
                className={`ko-team-click${
                  !isLocked && isDraw
                    ? ` ko-team-click--selectable${pred.drawWinner === 'away' ? ' ko-team-click--selected' : pred.drawWinner === 'home' ? ' ko-team-click--unselected' : ''}`
                    : isDraw && pred.drawWinner
                      ? pred.drawWinner === 'away' ? ' ko-team-click--selected' : ' ko-team-click--unselected'
                      : ''
                }`}
                onClick={!isLocked && isDraw ? () => onChange(id, { ...pred, drawWinner: 'away' }) : undefined}
                role={!isLocked && isDraw ? 'button' : undefined}
                tabIndex={!isLocked && isDraw ? 0 : undefined}
              >
                <TeamSlot name={m.away} />
              </div>
              {isLocked
                ? <span className="match-score-static">{pred.away ?? '–'}</span>
                : <ScoreInput label={m.away} value={pred.away} disabled={!m.resolved} onChange={v => onChange(id, { home: pred.home, away: v })} />
              }
            </div>
            <a href={`/matches/${id}`} className="ko-card-hint" onClick={e => e.stopPropagation()}>
              <span className="match-card-hint__label">לפרטים</span>
              <span className="match-card-hint__chevron">›</span>
            </a>
          </div>
        )
      })}
    </div>
  )
}
