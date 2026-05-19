import type { Standing } from '../types'

interface Props {
  standings: Standing[]
}

export default function StandingsTable({ standings }: Props) {
  return (
    <table>
      <thead>
        <tr>
          <th>Pos</th><th>Team</th><th>Pld</th><th>W</th><th>D</th><th>L</th>
          <th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((s, i) => {
          const gd = s.goalsFor - s.goalsAgainst
          return (
            <tr key={s.team} aria-label={s.team}>
              <td>{i + 1}</td>
              <td>{s.team}</td>
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
  )
}
