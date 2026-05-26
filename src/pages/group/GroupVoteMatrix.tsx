import { TEAMS } from '../../shared/groups'
import type { GroupVotes } from './groupVotes'
import './GroupVoteMatrix.css'

interface Props {
  votes: GroupVotes
}

export default function GroupVoteMatrix({ votes }: Props) {
  const teams = Object.keys(votes)

  if (teams.length === 0) {
    return <p className="group-empty">אין הצבעות</p>
  }

  const sortedTeams = [...teams].sort((a, b) => {
    const wa = votes[a].reduce((sum, v, i) => sum + v * (4 - i), 0)
    const wb = votes[b].reduce((sum, v, i) => sum + v * (4 - i), 0)
    return wb - wa
  })

  const maxCount = Math.max(...teams.flatMap(t => votes[t]), 1)

  return (
    <div className="group-matrix">
      <div className="group-matrix__head">
        <div className="group-matrix__spacer" />
        {[1, 2, 3, 4].map(pos => (
          <div key={pos} className={`group-matrix__pos-head gm-pos--${pos}`}>
            <span className="gm-pos-num">{pos}</span>
            <span className="gm-pos-lbl">מקום</span>
          </div>
        ))}
      </div>

      {sortedTeams.map((team, rowIdx) => {
        const teamVotes = votes[team]
        const teamMax = Math.max(...teamVotes)
        const { iso, he } = TEAMS[team]

        return (
          <div
            key={team}
            className="group-matrix__row"
            style={{ '--row-delay': `${rowIdx * 65}ms` } as React.CSSProperties}
          >
            <div className="group-matrix__team">
              <span className={`fi fi-${iso} gm-flag`} />
              <span className="gm-name">{he}</span>
            </div>

            {teamVotes.map((count, posIdx) => {
              const isTop = count > 0 && count === teamMax
              const fillPct = Math.round((count / maxCount) * 100)

              return (
                <div
                  key={posIdx}
                  data-testid={`${team}-${posIdx + 1}`}
                  className={`group-matrix__cell${isTop ? ' gm-cell--top' : ''}`}
                  style={{
                    '--fill': `${fillPct}%`,
                    '--cell-delay': `${rowIdx * 65 + posIdx * 35}ms`,
                  } as React.CSSProperties}
                >
                  <span className="gm-count">{count}</span>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
