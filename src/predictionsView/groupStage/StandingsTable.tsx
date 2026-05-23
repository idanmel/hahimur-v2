import type { Standing } from '../../shared/types'
import { TEAMS } from '../../shared/groups'
import { goalDifference } from '../../shared/standings'

interface Props {
  standings: Standing[]
}

const QUALIFY_COUNT = 2

export default function StandingsTable({ standings }: Props) {
  return (
    <div className="standings-wrapper">
      <table className="standings">
        <thead>
          <tr>
            <th className="col-rank">#</th>
            <th className="col-team">קבוצה</th>
            <th className="col-pts" title="נקודות">נק׳</th>
            <th title="משחקים שוחקו">מש׳</th>
            <th title="ניצחונות">נ</th>
            <th title="תיקו">ת</th>
            <th title="הפסדים">ה</th>
            <th title="שערים בעד:נגד">שערים</th>
            <th title="הפרש שערים">הפ</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => {
            const gd = goalDifference(s)
            const qualifies = i < QUALIFY_COUNT
            const isCutoff = i === QUALIFY_COUNT - 1
            return (
              <tr
                key={s.team}
                aria-label={TEAMS[s.team].he}
                className={[
                  qualifies ? 'row-qualifies' : 'row-out',
                  isCutoff ? 'row-cutoff' : '',
                ].filter(Boolean).join(' ')}
              >
                <td className="col-rank">
                  <span className={`rank-badge${qualifies ? ' rank-badge--qualify' : ''}`}>{i + 1}</span>
                </td>
                <td className="col-team">
                  <span className={`fi fi-${TEAMS[s.team].iso}`} />
                  <span>{TEAMS[s.team].he}</span>
                </td>
                <td className="col-pts">{s.points}</td>
                <td>{s.played}</td>
                <td>{s.won}</td>
                <td>{s.drawn}</td>
                <td>{s.lost}</td>
                <td className="col-goals">{s.goalsFor}–{s.goalsAgainst}</td>
                <td className={gd > 0 ? 'gd-pos' : gd < 0 ? 'gd-neg' : ''}>{Math.abs(gd)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <footer className="standings-legend">
        <span className="legend-swatch" />
        <span>עוברות לשלב הנוקאאוט (מקומות 1–2)</span>
      </footer>
    </div>
  )
}
