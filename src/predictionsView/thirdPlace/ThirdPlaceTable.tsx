import type { ThirdPlaceQualification, ThirdPlaceStanding } from '../../shared/types'
import { TEAMS, GROUP_HEBREW } from '../../shared/groups'
import { goalDifference } from '../../shared/standings'

interface Props {
  qualification: ThirdPlaceQualification
  allGroupsFilled: boolean
}

const QUALIFY_COUNT = 8

export default function ThirdPlaceTable({ qualification, allGroupsFilled }: Props) {
  const { all } = qualification

  return (
    <div className="standings-wrapper">
      <table className="standings">
        <thead>
          <tr>
            <th className="col-rank">#</th>
            <th className="col-group" title="בית">בית</th>
            <th className="col-team" title="קבוצה">קבוצה</th>
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
          {all.map((s: ThirdPlaceStanding, i: number) => {
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
                  <span className={`rank-badge${qualifies && qualification.resolved ? ' rank-badge--qualify' : ''}`}>{i + 1}</span>
                </td>
                <td className="col-group">{GROUP_HEBREW[s.group]}</td>
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
      {allGroupsFilled && !qualification.resolved && (
        <div className="third-place-tie-warning">
          שוויון בין {qualification.tied.map(t => TEAMS[t.team].he).join(', ')} — הכשירות לא מוכרעת
        </div>
      )}
      <footer className="standings-legend">
        <span className="legend-swatch" />
        <span>עוברות לשלב הנוקאאוט</span>
      </footer>
    </div>
  )
}
