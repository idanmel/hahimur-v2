import { TEAMS } from '../../shared/groups'
import type { GroupVotes } from './groupVotes'
import Nav from '../../Nav'
import '../../pages/form/FormPage.css'
import './GroupPage.css'

interface Props {
  groupName: string
  votes: GroupVotes
}

export default function GroupPage({ groupName, votes }: Props) {
  const teams = Object.keys(votes)

  const sortedTeams = [...teams].sort((a, b) => {
    const wa = votes[a].reduce((sum, v, i) => sum + v * (4 - i), 0)
    const wb = votes[b].reduce((sum, v, i) => sum + v * (4 - i), 0)
    return wb - wa
  })

  const maxCount = teams.length > 0 ? Math.max(...teams.flatMap(t => votes[t]), 1) : 1

  return (
    <>
      <header className="poster-header">
        <div className="poster-bar poster-bar--top" />
        <div className="poster-center">
          <p className="poster-overline">גביע העולם FIFA</p>
          <div className="poster-mundial">MUNDIAL <span className="poster-year">2026</span></div>
          <h1 className="poster-subtitle">{groupName}</h1>
        </div>
        <div className="poster-bar poster-bar--bottom" />
      </header>

      <Nav />

      <div className="group-body">
        {teams.length === 0 ? (
          <p className="group-empty">אין הצבעות</p>
        ) : (
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
        )}
      </div>
    </>
  )
}
