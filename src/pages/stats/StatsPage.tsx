import { useState, useEffect, useRef } from 'react'
import type { User } from '../../users/index'
import { USERS } from '../../users/index'
import { TEAMS } from '../../shared/groups'
import PageLayout from '../../shared/PageLayout'
import { computeFinalStats, computeFinalMatchups, computeTeamStageStats, computeGoalScorerStats } from './stats'
import './StatsPage.css'

const STAGE_LABELS: Record<string, string> = {
  r32: 'שלב 32',
  r16: 'שמינית גמר',
  qf: 'רבע גמר',
  sf: 'חצי גמר',
  final: 'גמר',
  champion: '★ אלופה',
}

const STAGE_LABELS_INVERTED: Record<string, string> = {
  r32: 'לא העלו לשלב ה-32',
  r16: 'לא העלו לשמינית',
  qf: 'לא העלו לרבע',
  sf: 'לא העלו לחצי',
  final: 'לא העלו לגמר',
  champion: 'לא בחרו כאלופה',
}

interface Props {
  users?: User[]
}

interface StagePopup {
  pickers: string[]
  col: string
  stageLabel: string
  teamName: string
  left: number
  top: number
  above: boolean
  arrowLeft: number
  inverted?: boolean
}

export default function StatsPage({ users = USERS }: Props) {
  const stats = computeFinalStats(users)
  const matchups = computeFinalMatchups(users)
  const goalScorers = computeGoalScorerStats(users)
  const teamStageStats = computeTeamStageStats(users)

  const allUserLabels = users.map(u => u.label)

  const [popup, setPopup] = useState<StagePopup | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!popup) return
    const onMouseDown = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setPopup(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPopup(null) }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [popup])

  const openPopup = (e: React.MouseEvent<HTMLTableCellElement>, pickers: string[], teamName: string, col: string, inverted?: boolean) => {
    if (!pickers.length) return
    const rect = e.currentTarget.getBoundingClientRect()
    const popupWidth = 190
    const rawLeft = rect.left + rect.width / 2 - popupWidth / 2
    const clampedLeft = Math.max(8, Math.min(rawLeft, window.innerWidth - popupWidth - 8))
    const above = rect.bottom + 160 > window.innerHeight
    setPopup({
      pickers,
      col,
      stageLabel: STAGE_LABELS[col] ?? col,
      teamName,
      left: clampedLeft,
      top: above ? rect.top - 8 : rect.bottom + 8,
      above,
      arrowLeft: rect.left + rect.width / 2 - clampedLeft,
      inverted,
    })
  }

  return (
    <PageLayout title="סטטיסטיקה">
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
          {matchups.map(({ teams, wins, winnerPickers }, i) => {
            const infoA = TEAMS[teams[0]]
            const infoB = TEAMS[teams[1]]
            const total = wins[0] + wins[1]
            return (
              <li
                key={teams.join('|')}
                className="matchup-row"
                style={{ '--row-i': i } as React.CSSProperties}
              >
                <span className="matchup-count" data-col="count">{total}</span>
                <div className="matchup-content">
                  <div className="matchup-duel">
                    <span className="matchup-team matchup-team--a">
                      <span className={`fi fi-${infoA?.iso ?? ''} matchup-flag`} aria-hidden="true" />
                      <span className="matchup-name">{infoA?.he ?? teams[0]}</span>
                    </span>
                    <span className="matchup-win matchup-win--a">{wins[0]}</span>
                    <span className="matchup-sep">×</span>
                    <span className="matchup-win matchup-win--b">{wins[1]}</span>
                    <span className="matchup-team matchup-team--b">
                      <span className="matchup-name">{infoB?.he ?? teams[1]}</span>
                      <span className={`fi fi-${infoB?.iso ?? ''} matchup-flag`} aria-hidden="true" />
                    </span>
                  </div>
                  <div className="matchup-pickers-split">
                    <div className="matchup-pickers matchup-pickers--a">
                      {winnerPickers[0].map((label: string) => (
                        <span key={label} className="matchup-picker matchup-picker--a">{label}</span>
                      ))}
                    </div>
                    <div className="matchup-pickers matchup-pickers--b">
                      {winnerPickers[1].map((label: string) => (
                        <span key={label} className="matchup-picker matchup-picker--b">{label}</span>
                      ))}
                    </div>
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
        <p className="stages-tap-hint">לחצו על כל חלק בטבלה כדי לראות מי העלה (או לא העלה) את הנבחרת לשלב הזה</p>

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
                const teamName = teamInfo?.he ?? team
                const cell = (pickers: string[], col: string, extra?: string) => {
                  const inverted = pickers.length > 20
                  const displayPickers = inverted
                    ? allUserLabels.filter(l => !pickers.includes(l))
                    : pickers
                  const showCount = pickers.length > 0
                  const interactive = displayPickers.length > 0
                  return (
                    <td
                      className={`stages-td${extra ? ` ${extra}` : ''}${interactive ? ' stages-td--interactive' : ''}`}
                      data-col={col}
                      data-zero={pickers.length === 0 || undefined}
                      onClick={interactive ? (e) => openPopup(e, displayPickers, teamName, col, inverted) : undefined}
                    >
                      {showCount
                        ? <span className="stages-cell-count">{pickers.length}</span>
                        : '–'}
                    </td>
                  )
                }
                return (
                  <tr key={team} className="stages-tr" style={{ '--row-i': i } as React.CSSProperties}>
                    <td className="stages-td stages-td--team">
                      <span className={`fi fi-${teamInfo?.iso ?? ''} stages-flag`} aria-hidden="true" />
                      <span>{teamName}</span>
                    </td>
                    {cell(r32, 'r32')}
                    {cell(r16, 'r16')}
                    {cell(qf, 'qf')}
                    {cell(sf, 'sf')}
                    {cell(final, 'final')}
                    {cell(champion, 'champion', 'stages-td--champ')}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {popup && (
          <div
            ref={popupRef}
            className={`stage-popup${popup.above ? ' stage-popup--above' : ''}`}
            style={{
              left: popup.left,
              top: popup.above ? undefined : popup.top,
              bottom: popup.above ? window.innerHeight - popup.top : undefined,
              '--arrow-left': `${popup.arrowLeft}px`,
            } as React.CSSProperties}
          >
            <div className="stage-popup-header">
              <span className="stage-popup-team">{popup.teamName}</span>
              <span className="stage-popup-stage">{popup.inverted ? (STAGE_LABELS_INVERTED[popup.col] ?? popup.stageLabel) : popup.stageLabel}</span>
            </div>
            <div className="stage-popup-pickers">
              {popup.pickers.map(name => (
                <span key={name} className="stage-popup-picker">{name}</span>
              ))}
            </div>
          </div>
        )}
      </main>
    </PageLayout>
  )
}
