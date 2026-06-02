import type { User } from '../../users/index'
import { USERS } from '../../users/index'
import { TEAMS } from '../../shared/groups'
import PageLayout from '../../shared/PageLayout'
import './StatsPage.css'

interface TeamFinalStat {
  team: string
  championPickers: string[]
  runnerUpPickers: string[]
}

function computeFinalStats(users: User[]): TeamFinalStat[] {
  const map = new Map<string, { championPickers: string[]; runnerUpPickers: string[] }>()

  const get = (team: string) => {
    if (!map.has(team)) map.set(team, { championPickers: [], runnerUpPickers: [] })
    return map.get(team)!
  }

  for (const user of users) {
    if (user.predictedChampion) {
      get(user.predictedChampion).championPickers.push(user.label)
    }
    if (user.predictedFinalTeams && user.predictedChampion) {
      const runnerUp = user.predictedFinalTeams.find(t => t !== user.predictedChampion)
      if (runnerUp) get(runnerUp).runnerUpPickers.push(user.label)
    }
  }

  return [...map.entries()]
    .map(([team, { championPickers, runnerUpPickers }]) => ({ team, championPickers, runnerUpPickers }))
    .sort((a, b) => {
      const diff = b.championPickers.length - a.championPickers.length
      return diff !== 0 ? diff : b.runnerUpPickers.length - a.runnerUpPickers.length
    })
}

interface Props {
  users?: User[]
}

export default function StatsPage({ users = USERS }: Props) {
  const stats = computeFinalStats(users)

  return (
    <PageLayout title="Stats">
      <main className="stats-main">
        <p className="stats-eyebrow">ניחושי הגמר</p>
        <p className="stats-subtitle">כמה מהמשתתפים חזו לכל נבחרת לנצח או להגיע לגמר</p>

        <div className="finals-col-headers" aria-hidden="true">
          <span />
          <span className="finals-col-head finals-col-head--champ">
            <span className="finals-col-icon">★</span>
            <span>אלופה</span>
          </span>
          <span className="finals-col-head finals-col-head--runner">
            <span className="finals-col-icon">◈</span>
            <span>סגנית</span>
          </span>
        </div>

        <ol className="finals-list">
          {stats.map(({ team, championPickers, runnerUpPickers }, i) => {
            const teamInfo = TEAMS[team]
            const iso = teamInfo?.iso ?? ''
            const hebrewName = teamInfo?.he ?? team
            return (
              <li
                key={team}
                className="finals-row"
                style={{ '--row-i': i } as React.CSSProperties}
              >
                <div className="finals-team">
                  <span className="finals-rank">{i + 1}</span>
                  <span className={`fi fi-${iso} finals-flag`} aria-hidden="true" />
                  <span className="finals-name">{hebrewName}</span>
                </div>

                <div className="finals-cell finals-cell--champ" data-col="champion">
                  <span className="finals-count finals-count--champ">{championPickers.length}</span>
                  {championPickers.length > 0 && (
                    <div className="finals-pickers">
                      {championPickers.map(label => (
                        <span key={label} className="finals-picker finals-picker--champ">{label}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="finals-cell finals-cell--runner" data-col="runner-up">
                  <span className="finals-count finals-count--runner">{runnerUpPickers.length}</span>
                  {runnerUpPickers.length > 0 && (
                    <div className="finals-pickers">
                      {runnerUpPickers.map(label => (
                        <span key={label} className="finals-picker finals-picker--runner">{label}</span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </main>
    </PageLayout>
  )
}
