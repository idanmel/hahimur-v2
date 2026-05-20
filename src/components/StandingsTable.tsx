import type { Standing } from '../types'
import { TEAM_NAMES_HE, TEAM_ISO } from '../lib/groups'
import { goalDifference } from '../lib/standings'

interface Props {
  standings: Standing[]
}

export default function StandingsTable({ standings }: Props) {
  return (
    <div className="standings-wrapper">
    <table className="standings">
      <thead>
        <tr>
          <th>#</th><th>קבוצה</th><th>מש'</th><th>נ</th><th>ת</th><th>ה</th>
          <th>שב</th><th>שנ</th><th>הפ</th><th>נק'</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((s, i) => {
          const gd = goalDifference(s)
          return (
            <tr key={s.team} aria-label={TEAM_NAMES_HE[s.team]}>
              <td>{i + 1}</td>
              <td><span className={`fi fi-${TEAM_ISO[s.team]}`} /> <span>{TEAM_NAMES_HE[s.team]}</span></td>
              <td>{s.played}</td>
              <td>{s.won}</td>
              <td>{s.drawn}</td>
              <td>{s.lost}</td>
              <td>{s.goalsFor}</td>
              <td>{s.goalsAgainst}</td>
              <td>{gd > 0 ? `+${gd}` : gd}</td>
              <td>{s.points}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
    </div>
  )
}
