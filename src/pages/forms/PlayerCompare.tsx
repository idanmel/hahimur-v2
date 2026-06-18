import { useMemo, useState, type ReactNode } from 'react'
import type { User } from '../../users/index'
import type { MatchScores } from '../../shared/types'
import { tournamentResults } from '../../tournament-results'
import { TEAMS } from '../../shared/groups'
import { OUTCOME_LABEL } from '../../leaderboard/points'
import {
  buildScoreboard,
  buildMatchDiff,
  matchTally,
  buildBreakdownRows,
  buildGroupStandingsDiff,
  eliminatedTeams,
  buildKnockoutDiff,
  buildAdvancementAgreement,
  type MatchDiffRow,
  type Side,
} from './compareStats'
import { renderCompareCard, shareCompareImage } from './shareCompareCard'
import './PlayerCompare.css'

interface Props {
  userA: User
  userB: User
  allUsers: User[]
}

function teamHe(team: string): string {
  return TEAMS[team]?.he ?? team
}

function TeamMini({ team }: { team: string }) {
  const iso = TEAMS[team]?.iso
  return (
    <span className="pc-team">
      {iso && <span className={`fi fi-${iso} pc-team__flag`} aria-hidden="true" />}
      <span className="pc-team__name">{teamHe(team)}</span>
    </span>
  )
}

function fmtScore(s: MatchScores): string {
  return `${s.home ?? '–'}-${s.away ?? '–'}`
}

function fmtPoints(p: number): string {
  return p > 0 ? `+${p}` : `${p}`
}

function sideClass(leader: Side, side: 'a' | 'b'): string {
  return leader === side ? ' pc-lead' : ''
}

function predWinner(s: MatchScores): 'home' | 'away' | 'draw' | null {
  if (s.home == null || s.away == null) return null
  if (s.home > s.away) return 'home'
  if (s.away > s.home) return 'away'
  return 'draw'
}

/** Caption above a detail row. Group fixtures show "בית א · מחזור 1 · 11 ביוני"
 *  (the id A1/A2 → md1, A3/A4 → md2 encodes the matchday); knockout rows show the
 *  stage label instead. */
function matchMeta(r: MatchDiffRow): string {
  if (r.stageHe) {
    return r.matchDate ? `${r.stageHe} · ${r.matchDate}` : r.stageHe
  }
  const num = parseInt(r.id.replace(/^\D+/, ''), 10)
  const parts = [`בית ${r.groupHe}`]
  if (Number.isFinite(num)) parts.push(`מחזור ${Math.ceil(num / 2)}`)
  if (r.matchDate) parts.push(r.matchDate)
  return parts.join(' · ')
}

interface DetailPanelProps {
  explain: string
  empty: string
  rows: MatchDiffRow[]
  renderMeta: (row: MatchDiffRow) => ReactNode
}

function DetailPanel({ explain, empty, rows, renderMeta }: DetailPanelProps) {
  return (
    <div className="pc-dl">
      <p className="pc-dl__explain">{explain}</p>
      {rows.length === 0 ? (
        <p className="pc-dl__empty">{empty}</p>
      ) : (
        rows.map(r => (
          <div key={r.id} className="pc-dl__item">
            <div className="pc-dl__tag">{matchMeta(r)}</div>
            <div className="pc-dl__match">
              <span className="pc-dl__team pc-dl__team--home">
                <TeamMini team={r.homeTeam} />
              </span>
              <span className="pc-dl__dash">-</span>
              <span className="pc-dl__team pc-dl__team--away">
                <TeamMini team={r.awayTeam} />
              </span>
            </div>
            <div className="pc-dl__meta">{renderMeta(r)}</div>
          </div>
        ))
      )}
    </div>
  )
}

export default function PlayerCompare({ userA, userB, allUsers }: Props) {
  const results = tournamentResults
  const [onlyDiff, setOnlyDiff] = useState(true)
  const [openChip, setOpenChip] = useState<null | 'identical' | 'outcome' | 'h2h'>(null)
  const toggleChip = (key: 'identical' | 'outcome' | 'h2h') => setOpenChip(o => (o === key ? null : key))
  const [sharing, setSharing] = useState(false)
  const [shareNote, setShareNote] = useState<string | null>(null)

  const scoreboard = useMemo(() => buildScoreboard(userA, userB, allUsers, results), [userA, userB, allUsers, results])
  const matchRows = useMemo(() => buildMatchDiff(userA, userB, results), [userA, userB, results])
  const tally = useMemo(() => matchTally(matchRows), [matchRows])
  const breakdown = useMemo(() => buildBreakdownRows(userA, userB, results), [userA, userB, results])
  const eliminated = useMemo(() => eliminatedTeams(results), [results])
  const groupStandings = useMemo(() => buildGroupStandingsDiff(userA, userB, results), [userA, userB, results])
  const koRows = useMemo(() => buildKnockoutDiff(userA, userB), [userA, userB])
  const advancement = useMemo(() => buildAdvancementAgreement(userA, userB), [userA, userB])

  const decisiveRows = useMemo(() => matchRows.filter(r => r.finished && r.winner !== 'tie'), [matchRows])
  const identicalRows = useMemo(
    () => [...matchRows.filter(r => r.bothPredicted && !r.differ), ...koRows.filter(r => !r.differ)],
    [matchRows, koRows],
  )
  const outcomeRows = useMemo(
    () => [
      ...matchRows.filter(r => r.bothPredicted && predWinner(r.a) === predWinner(r.b)),
      ...koRows.filter(r => r.sameAdvance),
    ],
    [matchRows, koRows],
  )

  function outcomeLabel(r: MatchDiffRow): string {
    if (r.advancesHe) return `עולה: ${r.advancesHe}`
    const w = predWinner(r.a)
    if (w === 'draw') return 'תיקו'
    if (w === 'home') return `ניצחון ${teamHe(r.homeTeam)}`
    if (w === 'away') return `ניצחון ${teamHe(r.awayTeam)}`
    return ''
  }

  const groups = useMemo(() => {
    const map = new Map<string, MatchDiffRow[]>()
    for (const r of matchRows) {
      const list = map.get(r.groupHe) ?? []
      list.push(r)
      map.set(r.groupHe, list)
    }
    return [...map.entries()]
  }, [matchRows])

  const aName = userA.label
  const bName = userB.label
  const leaderName = scoreboard.leader === 'a' ? aName : scoreboard.leader === 'b' ? bName : null

  const championActual = results.champion
  const goldenActual = Array.isArray(results.goldenBootWinner)
    ? results.goldenBootWinner
    : results.goldenBootWinner
      ? [results.goldenBootWinner]
      : []

  function pickStatus(pick: string | undefined, actuals: string[]): 'correct' | 'wrong' | 'pending' {
    if (actuals.length === 0) return 'pending'
    if (!pick) return 'wrong'
    return actuals.includes(pick) ? 'correct' : 'wrong'
  }

  async function handleShare() {
    if (sharing) return
    setSharing(true)
    setShareNote(null)
    try {
      const blob = await renderCompareCard({
        aName,
        bName,
        aRank: scoreboard.aRank,
        bRank: scoreboard.bRank,
        aTotal: scoreboard.aTotal,
        bTotal: scoreboard.bTotal,
        leader: scoreboard.leader,
        gap: scoreboard.gap,
        leaderName,
        identicalCount: identicalRows.length,
        outcomeCount: outcomeRows.length,
        tallyA: tally.a,
        tallyB: tally.b,
        aChampion: userA.predictedChampion,
        bChampion: userB.predictedChampion,
        aGolden: userA.topGoalscorer,
        bGolden: userB.topGoalscorer,
      })
      const result = await shareCompareImage(
        blob,
        `השוואה-${aName}-${bName}.png`,
        `${aName} מול ${bName} · ההימור 2026`,
      )
      if (result === 'downloaded') setShareNote('התמונה הורדה — אפשר לצרף אותה לוואטסאפ')
    } catch {
      setShareNote('לא הצלחנו ליצור את התמונה, נסו שוב')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="pc" dir="rtl">
      {/* Share the highlights as a single WhatsApp-ready image */}
      <div className="pc-share">
        <button type="button" className="pc-share__btn" onClick={handleShare} disabled={sharing}>
          <svg className="pc-share__icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91a9.85 9.85 0 0 0-2.91-7.02ZM12.05 20.2a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.16 8.16 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.24-8.23a8.2 8.2 0 0 1 8.23 8.24c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.15.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" />
          </svg>
          {sharing ? 'מכין תמונה…' : 'שתף בוואטסאפ'}
        </button>
        {shareNote && <p className="pc-share__note">{shareNote}</p>}
      </div>

      {/* Scoreboard */}
      <div className="pc-scoreboard">
        <div className={`pc-sb-card${scoreboard.leader === 'a' ? ' pc-sb-card--lead' : ''}`}>
          <div className="pc-sb-rank">#{scoreboard.aRank}</div>
          <div className="pc-sb-name">{aName}</div>
          <div className="pc-sb-total">{scoreboard.aTotal}</div>
          <div className="pc-sb-unit">נק'</div>
        </div>
        <div className="pc-sb-vs">
          <span className="pc-sb-vs__label">מול</span>
          {leaderName ? (
            <span className="pc-sb-vs__lead">{leaderName} מוביל ב-{scoreboard.gap}</span>
          ) : (
            <span className="pc-sb-vs__lead">תיקו</span>
          )}
        </div>
        <div className={`pc-sb-card${scoreboard.leader === 'b' ? ' pc-sb-card--lead' : ''}`}>
          <div className="pc-sb-rank">#{scoreboard.bRank}</div>
          <div className="pc-sb-name">{bName}</div>
          <div className="pc-sb-total">{scoreboard.bTotal}</div>
          <div className="pc-sb-unit">נק'</div>
        </div>
      </div>

      {/* Agreement + head-to-head chips (each opens a detail list) */}
      <div className="pc-chips">
        <button
          type="button"
          className={`pc-chip pc-chip--btn${openChip === 'identical' ? ' pc-chip--open' : ''}`}
          onClick={() => toggleChip('identical')}
          aria-expanded={openChip === 'identical'}
        >
          <span className="pc-chip__num">{identicalRows.length}</span>
          <span className="pc-chip__label">ניחושים זהים <span className="pc-chip__caret" aria-hidden="true">›</span></span>
        </button>
        <button
          type="button"
          className={`pc-chip pc-chip--btn${openChip === 'outcome' ? ' pc-chip--open' : ''}`}
          onClick={() => toggleChip('outcome')}
          aria-expanded={openChip === 'outcome'}
        >
          <span className="pc-chip__num">{outcomeRows.length}</span>
          <span className="pc-chip__label">תוצאות זהות <span className="pc-chip__caret" aria-hidden="true">›</span></span>
        </button>
        <button
          type="button"
          className={`pc-chip pc-chip--btn${openChip === 'h2h' ? ' pc-chip--open' : ''}`}
          onClick={() => toggleChip('h2h')}
          aria-expanded={openChip === 'h2h'}
        >
          <span className="pc-chip__num pc-chip__score">
            <span>{tally.a}</span>
            <span className="pc-chip__dash">-</span>
            <span>{tally.b}</span>
          </span>
          <span className="pc-chip__label">ראש בראש <span className="pc-chip__caret" aria-hidden="true">›</span></span>
        </button>
      </div>

      {openChip === 'identical' && (
        <DetailPanel
          explain="משחקים ששניכם ניחשתם בהם תוצאה מדויקת זהה. כולל משחקי נוקאאוט רק כששניכם צופים בהם אותו מפגש."
          empty="אין ניחושים זהים"
          rows={identicalRows}
          renderMeta={r => <span className="pc-dl__val">{fmtScore(r.a)}</span>}
        />
      )}

      {openChip === 'outcome' && (
        <DetailPanel
          explain="משחקים ששניכם צופים בהם אותה תוצאה, גם אם בניחוש מדויק שונה. בנוקאאוט — אותו מפגש ואותה קבוצה שעולה."
          empty="אין תוצאות זהות"
          rows={outcomeRows}
          renderMeta={r => <span className="pc-dl__val pc-dl__val--label">{outcomeLabel(r)}</span>}
        />
      )}

      {openChip === 'h2h' && (
        <DetailPanel
          explain={`רק המשחקים שבהם אחד מכם צבר יותר נקודות — אלה שקבעו את ה-${tally.a}־${tally.b}.${tally.tie > 0 ? ` (עוד ${tally.tie} משחקים שהסתיימו נגמרו בתיקו נקודות)` : ''}`}
          empty="עדיין אין הכרעה בין השניים"
          rows={decisiveRows}
          renderMeta={r => (
            <span className="pc-dl__h2h">
              <span className={r.winner === 'a' ? 'pc-dl__win' : ''}>{aName} {fmtPoints(r.aPoints!)}</span>
              <span className="pc-dl__sep">·</span>
              <span className={r.winner === 'b' ? 'pc-dl__win' : ''}>{bName} {fmtPoints(r.bPoints!)}</span>
            </span>
          )}
        />
      )}

      {/* Points breakdown */}
      <div className="section-tag">פירוט נקודות</div>
      <table className="pc-table">
        <thead>
          <tr>
            <th className="pc-table__stage">שלב</th>
            <th>{aName}</th>
            <th>{bName}</th>
          </tr>
        </thead>
        <tbody>
          {breakdown.map(row => (
            <tr key={row.label}>
              <td className="pc-table__stage">{row.label}</td>
              <td className={`pc-num${sideClass(row.leader, 'a')}`}>{row.a}</td>
              <td className={`pc-num${sideClass(row.leader, 'b')}`}>{row.b}</td>
            </tr>
          ))}
          <tr className="pc-table__total">
            <td className="pc-table__stage">סה"כ</td>
            <td className={`pc-num${sideClass(scoreboard.leader, 'a')}`}>{scoreboard.aTotal}</td>
            <td className={`pc-num${sideClass(scoreboard.leader, 'b')}`}>{scoreboard.bTotal}</td>
          </tr>
        </tbody>
      </table>

      {/* Knockout / outright picks */}
      <div className="section-tag">הימורי הכרעה</div>
      <p className="pc-elim-caption">
        הסיכוי לנקד על בחירות עמוקות תלוי בכך שהקבוצה עדיין במרוץ. קבוצה שכבר הודחה מסומנת ב<span className="pc-elim-badge">הודחה</span>.
      </p>

      <div className="pc-adv">
        <div className="pc-adv__title">כמה קבוצות שניכם מעלים לכל שלב</div>
        <div className="pc-adv__chips">
          {advancement.rows.map(r => (
            <span key={r.label} className="pc-adv__chip">
              <span className="pc-adv__count">{r.shared}/{r.total}</span>
              <span className="pc-adv__stage">{r.label}</span>
            </span>
          ))}
          {advancement.championShared !== null && (
            <span className={`pc-adv__chip${advancement.championShared ? ' pc-adv__chip--yes' : ' pc-adv__chip--no'}`}>
              <span className="pc-adv__count">{advancement.championShared ? '✓' : '✗'}</span>
              <span className="pc-adv__stage">אלופה</span>
            </span>
          )}
        </div>
      </div>

      <table className="pc-table">
        <thead>
          <tr>
            <th className="pc-table__stage">הימור</th>
            <th>{aName}</th>
            <th>{bName}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="pc-table__stage">אלופה</td>
            <td className={`pc-pick pc-pick--${pickStatus(userA.predictedChampion, championActual ? [championActual] : [])}`}>
              <PickTeam team={userA.predictedChampion} eliminated={eliminated} />
            </td>
            <td className={`pc-pick pc-pick--${pickStatus(userB.predictedChampion, championActual ? [championActual] : [])}`}>
              <PickTeam team={userB.predictedChampion} eliminated={eliminated} />
            </td>
          </tr>
          <tr>
            <td className="pc-table__stage">מלך השערים</td>
            <td className={`pc-pick pc-pick--${pickStatus(userA.topGoalscorer, goldenActual)}`}>
              {userA.topGoalscorer || '—'}
            </td>
            <td className={`pc-pick pc-pick--${pickStatus(userB.topGoalscorer, goldenActual)}`}>
              {userB.topGoalscorer || '—'}
            </td>
          </tr>
        </tbody>
      </table>

      <FinalistDiff label="מועמדות לגמר" aName={aName} bName={bName} a={userA.predictedFinalTeams} b={userB.predictedFinalTeams} eliminated={eliminated} />
      <FinalistDiff label="חצי גמר" aName={aName} bName={bName} a={userA.predictedSFTeams} b={userB.predictedSFTeams} eliminated={eliminated} />

      {/* Group standings diff */}
      <div className="section-tag">דירוג הבתים</div>
      <div className="pc-gs-legend">
        <span className="pc-gs-legend__side">{aName}</span>
        <span className="pc-gs-legend__mid">מיקום</span>
        <span className="pc-gs-legend__side">{bName}</span>
      </div>
      <div className="pc-standings">
        {groupStandings.map(g => (
          <div key={g.group} className="pc-gs-card">
            <div className="pc-gs-head">
              <span className="pc-gs-group">בית {g.groupHe}</span>
              {g.finished && (
                <span className="pc-gs-pts">{aName} {g.aPlacePoints} · {bName} {g.bPlacePoints}</span>
              )}
            </div>
            {g.slots.map(slot => (
              <div key={slot.position} className={`pc-gs-row${slot.agree ? ' pc-gs-row--agree' : ''}`}>
                <div className={`pc-gs-team${slot.aCorrect ? ' pc-gs-team--correct' : ''}`}>
                  {slot.aTeam ? <TeamMini team={slot.aTeam} /> : <span className="pc-gs-empty">—</span>}
                </div>
                <div className="pc-gs-pos">{slot.position}</div>
                <div className={`pc-gs-team${slot.bCorrect ? ' pc-gs-team--correct' : ''}`}>
                  {slot.bTeam ? <TeamMini team={slot.bTeam} /> : <span className="pc-gs-empty">—</span>}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Match-by-match bet diff */}
      <div className="pc-matches-head">
        <div className="section-tag">השוואת ניחושים</div>
        <label className="pc-only-diff">
          <input type="checkbox" checked={onlyDiff} onChange={e => setOnlyDiff(e.target.checked)} />
          רק הבדלים
        </label>
      </div>

      <div className="pc-match-header">
        <span className="pc-match-header__side">{aName}</span>
        <span className="pc-match-header__mid">משחק</span>
        <span className="pc-match-header__side">{bName}</span>
      </div>

      {groups.map(([groupHe, rows]) => {
        const visible = onlyDiff ? rows.filter(r => r.differ) : rows
        if (visible.length === 0) return null
        return (
          <div key={groupHe} className="pc-group">
            <div className="pc-group__label">בית {groupHe}</div>
            {visible.map(r => (
              <div key={r.id} className={`pc-row${r.differ ? ' pc-row--differ' : ''}`}>
                <div className={`pc-row__bet${r.finished && r.winner === 'a' ? ' pc-row__bet--win' : ''}`}>
                  <span className="pc-row__score">{fmtScore(r.a)}</span>
                  {r.finished && (
                    <span className={`pc-verdict pc-verdict--${r.aOutcome}`}>
                      {OUTCOME_LABEL[r.aOutcome!]} {fmtPoints(r.aPoints!)}
                    </span>
                  )}
                </div>
                <div className="pc-row__match">
                  <TeamMini team={r.homeTeam} />
                  <span className="pc-row__dash">-</span>
                  <TeamMini team={r.awayTeam} />
                  {r.finished && <span className="pc-row__actual" dir="ltr">{r.actual!.home}-{r.actual!.away}</span>}
                </div>
                <div className={`pc-row__bet${r.finished && r.winner === 'b' ? ' pc-row__bet--win' : ''}`}>
                  <span className="pc-row__score">{fmtScore(r.b)}</span>
                  {r.finished && (
                    <span className={`pc-verdict pc-verdict--${r.bOutcome}`}>
                      {OUTCOME_LABEL[r.bOutcome!]} {fmtPoints(r.bPoints!)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function PickTeam({ team, eliminated }: { team?: string; eliminated: Set<string> }) {
  if (!team) return <>—</>
  const out = eliminated.has(team)
  return (
    <span className={out ? 'pc-elim' : undefined}>
      {teamHe(team)}
      {out && <span className="pc-elim-badge">הודחה</span>}
    </span>
  )
}

interface FinalistDiffProps {
  label: string
  aName: string
  bName: string
  a?: string[]
  b?: string[]
  eliminated: Set<string>
}

function FinalistChip({ team, shared, eliminated }: { team: string; shared?: boolean; eliminated: Set<string> }) {
  const out = eliminated.has(team)
  return (
    <span className={`pc-fchip${shared ? ' pc-fchip--shared' : ''}${out ? ' pc-fchip--out' : ''}`}>
      <TeamMini team={team} />
      {out && <span className="pc-fchip__out">הודחה</span>}
    </span>
  )
}

function FinalistDiff({ label, a = [], b = [], aName, bName, eliminated }: FinalistDiffProps) {
  if (a.length === 0 && b.length === 0) return null
  const shared = a.filter(t => b.includes(t))
  const onlyA = a.filter(t => !b.includes(t))
  const onlyB = b.filter(t => !a.includes(t))
  const aAlive = a.filter(t => !eliminated.has(t)).length
  const bAlive = b.filter(t => !eliminated.has(t)).length
  const showAlive = eliminated.size > 0 && (a.length > 0 || b.length > 0)
  return (
    <div className="pc-finalists">
      <div className="pc-finalists__label">{label}</div>
      {shared.length > 0 && (
        <div className="pc-finalists__row">
          <span className="pc-finalists__tag">משותף</span>
          <div className="pc-finalists__chips">
            {shared.map(t => <FinalistChip key={t} team={t} shared eliminated={eliminated} />)}
          </div>
        </div>
      )}
      {onlyA.length > 0 && (
        <div className="pc-finalists__row">
          <span className="pc-finalists__tag">{aName}</span>
          <div className="pc-finalists__chips">
            {onlyA.map(t => <FinalistChip key={t} team={t} eliminated={eliminated} />)}
          </div>
        </div>
      )}
      {onlyB.length > 0 && (
        <div className="pc-finalists__row">
          <span className="pc-finalists__tag">{bName}</span>
          <div className="pc-finalists__chips">
            {onlyB.map(t => <FinalistChip key={t} team={t} eliminated={eliminated} />)}
          </div>
        </div>
      )}
      {showAlive && (
        <div className="pc-finalists__alive">
          עדיין בטורניר — {aName}: {aAlive}/{a.length} · {bName}: {bAlive}/{b.length}
        </div>
      )}
    </div>
  )
}
