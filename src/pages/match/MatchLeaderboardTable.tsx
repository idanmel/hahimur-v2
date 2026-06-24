import type { MatchLeaderRow } from '../../leaderboard/matchLeaderboardRows'
import type { MatchScores } from '../../shared/types'

type Props = { rows: MatchLeaderRow[]; me?: string }

// RTL convention across the match page: the away score is shown first.
const showScore = (s: MatchScores) => `${s.away}–${s.home}`

function Movement({ value }: { value: number | null }) {
  if (value === null || value === 0) return <span className="match-lb__move match-lb__move--flat">–</span>
  const up = value > 0
  return (
    <span className={`match-lb__move match-lb__move--${up ? 'up' : 'down'}`}>
      <span className="match-lb__move-arrow">{up ? '▲' : '▼'}</span>{Math.abs(value)}
    </span>
  )
}

// The shared per-match leaderboard table — fed by the group rows or the knockout
// rows, which carry the same shape (prediction, this-match points, total, move).
export default function MatchLeaderboardTable({ rows, me }: Props) {
  if (rows.length === 0) return null

  // The advancement column only earns its width once someone has been credited —
  // most group matches award nothing, so a row of zeros is just clutter.
  const showAdv = rows.some(r => r.advancementPoints > 0)

  // Standings position from the total — co-leaders share rank 1 (the gold row).
  let rank = 0
  const ranked = rows.map((row, i) => {
    if (i === 0 || row.total !== rows[i - 1].total) rank = i + 1
    return { ...row, rank }
  })

  return (
    <div className="match-lb" data-testid="match-leaderboard" dir="rtl">
      <table className="match-lb__table">
        <thead>
          <tr>
            <th className="match-lb__th match-lb__th--rank" aria-label="מיקום" />
            <th className="match-lb__th match-lb__th--name">שם</th>
            <th className="match-lb__th">ניחוש</th>
            <th className="match-lb__th">נקודות</th>
            {showAdv && <th className="match-lb__th">עלייה</th>}
            <th className="match-lb__th">שינוי</th>
            <th className="match-lb__th match-lb__th--total">סה״כ</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((row, i) => {
            const isMe = !!me && row.label === me
            return (
            <tr
              key={row.label}
              data-testid="match-lb-row"
              className={`match-lb__row${row.rank === 1 ? ' match-lb__row--leader' : ''}${isMe ? ' match-lb__row--me' : ''}`}
              style={{ animationDelay: `${i * 55}ms` }}
            >
              <td className="match-lb__rank">{row.rank}</td>
              <td className="match-lb__name">
                {row.label}
                {isMe && <span className="match-lb__me">אני</span>}
              </td>
              <td className="match-lb__pred">{row.prediction ? showScore(row.prediction) : '—'}</td>
              <td className="match-lb__pts">{row.matchPoints > 0 ? row.matchPoints : <span className="match-lb__pts-zero">0</span>}</td>
              {showAdv && <td className="match-lb__adv">{row.advancementPoints > 0 ? <span className="match-lb__adv-on">+{row.advancementPoints}</span> : <span className="match-lb__pts-zero">0</span>}</td>}
              <td className="match-lb__movement"><Movement value={row.placeMovement} /></td>
              <td className="match-lb__total">{row.total}</td>
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
