import type { User } from '../../users/index'
import { USERS } from '../../users/index'
import { TEAMS } from '../../shared/groups'
import PageLayout from '../../shared/PageLayout'
import './StatsPage.css'

interface TeamFinalStat {
  team: string
  championPickers: string[]
  runnerUpPickers: string[]
  total: number
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
    .map(([team, { championPickers, runnerUpPickers }]) => ({
      team,
      championPickers,
      runnerUpPickers,
      total: championPickers.length + runnerUpPickers.length,
    }))
    .sort((a, b) => {
      const diff = b.championPickers.length - a.championPickers.length
      return diff !== 0 ? diff : b.runnerUpPickers.length - a.runnerUpPickers.length
    })
}

interface FinalMatchup {
  teams: [string, string]
  pickers: string[]
}

function computeFinalMatchups(users: User[]): FinalMatchup[] {
  const map = new Map<string, { teams: [string, string]; pickers: string[] }>()

  for (const user of users) {
    if (user.predictedFinalTeams?.length === 2) {
      const sorted = [...user.predictedFinalTeams].sort() as [string, string]
      const key = sorted.join('|')
      if (!map.has(key)) map.set(key, { teams: sorted, pickers: [] })
      map.get(key)!.pickers.push(user.label)
    }
  }

  return [...map.values()].sort((a, b) => b.pickers.length - a.pickers.length)
}

interface TeamStageStat {
  team: string
  r32: number
  r16: number
  qf: number
  sf: number
  final: number
  champion: number
}

function computeTeamStageStats(users: User[]): TeamStageStat[] {
  const counts: Record<string, { r32: number; r16: number; qf: number; sf: number; final: number; champion: number }> = {}

  const get = (team: string) => {
    if (!counts[team]) counts[team] = { r32: 0, r16: 0, qf: 0, sf: 0, final: 0, champion: 0 }
    return counts[team]
  }

  for (const team of Object.keys(TEAMS)) get(team)

  for (const user of users) {
    for (const match of user.knockoutStages.r32) {
      get(match.home).r32++
      get(match.away).r32++
    }
    for (const team of user.predictedR16Teams ?? []) get(team).r16++
    for (const team of user.predictedQFTeams ?? []) get(team).qf++
    for (const team of user.predictedSFTeams ?? []) get(team).sf++
    for (const team of user.predictedFinalTeams ?? []) get(team).final++
    if (user.predictedChampion) get(user.predictedChampion).champion++
  }

  return Object.entries(counts)
    .map(([team, c]) => ({ team, ...c }))
    .sort((a, b) => {
      const score = (x: TeamStageStat) => x.champion * 6 + x.final * 5 + x.sf * 4 + x.qf * 3 + x.r16 * 2 + x.r32
      return score(b) - score(a)
    })
}

interface GoalScorerStat {
  player: string
  pickers: string[]
}

function computeGoalScorerStats(users: User[]): GoalScorerStat[] {
  const map = new Map<string, string[]>()
  for (const user of users) {
    if (user.topGoalscorer) {
      if (!map.has(user.topGoalscorer)) map.set(user.topGoalscorer, [])
      map.get(user.topGoalscorer)!.push(user.label)
    }
  }
  return [...map.entries()]
    .map(([player, pickers]) => ({ player, pickers }))
    .sort((a, b) => b.pickers.length - a.pickers.length)
}

interface Props {
  users?: User[]
}

export default function StatsPage({ users = USERS }: Props) {
  const stats = computeFinalStats(users)
  const matchups = computeFinalMatchups(users)
  const goalScorers = computeGoalScorerStats(users)
  const teamStageStats = computeTeamStageStats(users)

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

        <ol className="finals-list" data-section="finals">
          {stats.map(({ team, championPickers, runnerUpPickers, total }, i) => {
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
                  <div className="finals-team-info">
                    <span className="finals-name">{hebrewName}</span>
                    <div className="finals-total" data-col="total">
                      <div className="finals-total-dots" aria-hidden="true">
                        {Array.from({ length: users.length }, (_, di) => (
                          <span
                            key={di}
                            className={`finals-dot ${di < total ? 'finals-dot--filled' : 'finals-dot--empty'}`}
                            style={{ '--dot-i': di } as React.CSSProperties}
                          />
                        ))}
                      </div>
                      <span className="finals-total-label">{total} מתוך {users.length} העלו אותה לגמר</span>
                    </div>
                  </div>
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
        <p className="stats-eyebrow stats-eyebrow--section">גמרים</p>
        <p className="stats-subtitle">כמה מהמשתתפים ניחשו כל מפגש גמר</p>

        <ol className="matchups-list" data-section="matchups">
          {matchups.map(({ teams, pickers }, i) => {
            const infoA = TEAMS[teams[0]]
            const infoB = TEAMS[teams[1]]
            return (
              <li
                key={teams.join('|')}
                className="matchup-row"
                style={{ '--row-i': i } as React.CSSProperties}
              >
                <span className="matchup-count" data-col="count">{pickers.length}</span>
                <div className="matchup-content">
                  <div className="matchup-duel">
                    <span className="matchup-team matchup-team--a">
                      <span className={`fi fi-${infoA?.iso ?? ''} matchup-flag`} aria-hidden="true" />
                      <span className="matchup-name">{infoA?.he ?? teams[0]}</span>
                    </span>
                    <span className="matchup-sep">×</span>
                    <span className="matchup-team matchup-team--b">
                      <span className="matchup-name">{infoB?.he ?? teams[1]}</span>
                      <span className={`fi fi-${infoB?.iso ?? ''} matchup-flag`} aria-hidden="true" />
                    </span>
                  </div>
                  <div className="matchup-pickers">
                    {pickers.map(label => (
                      <span key={label} className="matchup-picker">{label}</span>
                    ))}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>

        <p className="stats-eyebrow stats-eyebrow--section">מלך שערים</p>
        <p className="stats-subtitle">מי ניחש איזה שחקן יהיה מלך השערים</p>

        <ol className="matchups-list" data-section="golden-boot">
          {goalScorers.map(({ player, pickers }, i) => (
            <li
              key={player}
              className="matchup-row"
              style={{ '--row-i': i } as React.CSSProperties}
            >
              <span className="matchup-count" data-col="count">{pickers.length}</span>
              <div className="matchup-content">
                <span className="matchup-name">{player}</span>
                <div className="matchup-pickers">
                  {pickers.map(label => (
                    <span key={label} className="matchup-picker">{label}</span>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <p className="stats-eyebrow stats-eyebrow--section">נבחרות לפי שלב</p>
        <p className="stats-subtitle">כמה משתתפים העלו כל נבחרת לכל שלב</p>

        <div className="stages-wrap">
          <table className="stages-table" dir="rtl" data-section="team-stages">
            <thead>
              <tr>
                <th className="stages-th stages-th--team">נבחרת</th>
                <th className="stages-th">32</th>
                <th className="stages-th">שמינית</th>
                <th className="stages-th">רבע</th>
                <th className="stages-th">חצי</th>
                <th className="stages-th">גמר</th>
                <th className="stages-th stages-th--champ">★</th>
              </tr>
            </thead>
            <tbody>
              {teamStageStats.map(({ team, r32, r16, qf, sf, final, champion }, i) => {
                const teamInfo = TEAMS[team]
                return (
                  <tr key={team} className="stages-tr" style={{ '--row-i': i } as React.CSSProperties}>
                    <td className="stages-td stages-td--team">
                      <span className={`fi fi-${teamInfo?.iso ?? ''} stages-flag`} aria-hidden="true" />
                      <span>{teamInfo?.he ?? team}</span>
                    </td>
                    <td className="stages-td" data-col="r32" data-zero={r32 === 0 || undefined}>{r32 || '–'}</td>
                    <td className="stages-td" data-col="r16" data-zero={r16 === 0 || undefined}>{r16 || '–'}</td>
                    <td className="stages-td" data-col="qf" data-zero={qf === 0 || undefined}>{qf || '–'}</td>
                    <td className="stages-td" data-col="sf" data-zero={sf === 0 || undefined}>{sf || '–'}</td>
                    <td className="stages-td" data-col="final" data-zero={final === 0 || undefined}>{final || '–'}</td>
                    <td className="stages-td stages-td--champ" data-col="champion" data-zero={champion === 0 || undefined}>{champion || '–'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </main>
    </PageLayout>
  )
}
