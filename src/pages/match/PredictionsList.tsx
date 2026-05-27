import { isUnpredicted, type MatchScores } from '../../shared/types'
import type { User } from '../../users/index'
import { singleMatchPoints } from '../../leaderboard/points'
import { compareScores } from './matchUtils'

type Props = { matchId: string; users: User[]; actualScore?: MatchScores | null }

type Outcome = 'exact' | 'partial' | 'miss' | 'pending' | 'unpredicted'

function getOutcome(matchId: string, p: MatchScores | undefined, actual: MatchScores | null | undefined): Outcome {
  if (!p || isUnpredicted(p)) return 'unpredicted'
  if (!actual) return 'pending'
  const pts = singleMatchPoints(matchId, p, actual)
  if (pts === 0) return 'miss'
  if (p.home === actual.home && p.away === actual.away) return 'exact'
  return 'partial'
}

export default function PredictionsList({ matchId, users, actualScore = null }: Props) {
  if (users.length === 0) {
    return <p className="match-predictions__empty">אין תחזיות למשחק זה</p>
  }

  const score = (v: number | null) => v !== null ? String(v) : '–'

  const sorted = [...users].sort((a, b) => {
    const pa = a.predictions[matchId], pb = b.predictions[matchId]
    const ua = !pa || isUnpredicted(pa), ub = !pb || isUnpredicted(pb)
    if (ua && ub) return a.label.localeCompare(b.label, 'he')
    if (ua) return 1
    if (ub) return -1
    if (actualScore) {
      const ptsA = singleMatchPoints(matchId, pa, actualScore)
      const ptsB = singleMatchPoints(matchId, pb, actualScore)
      if (ptsA !== ptsB) return ptsB - ptsA
    }
    return compareScores(pa.home!, pa.away!, pb.home!, pb.away!) || a.label.localeCompare(b.label, 'he')
  })

  return (
    <>
      {sorted.map((u, i) => {
        const p = u.predictions[matchId]
        const unpredicted = !p || isUnpredicted(p)
        const pts = actualScore && p && !unpredicted ? singleMatchPoints(matchId, p, actualScore) : null
        const outcome = getOutcome(matchId, p, actualScore)

        return (
          <div
            key={u.label}
            className={`prediction-row prediction-row--${outcome}`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span className="prediction-row__name">{u.label}</span>
            <div className="prediction-row__score">
              <span className="prediction-row__digit">{score(p?.away ?? null)}</span>
              <span className="prediction-row__sep">–</span>
              <span className="prediction-row__digit">{score(p?.home ?? null)}</span>
            </div>
            {actualScore && (
              <div className="prediction-row__pts-area">
                {pts !== null ? (
                  <>
                    <span className="prediction-row__pts">{pts}</span>
                    <span className="prediction-row__pts-label">נק׳</span>
                  </>
                ) : (
                  <span className="prediction-row__pts prediction-row__pts--na">—</span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
