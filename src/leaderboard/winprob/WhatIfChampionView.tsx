import { Fragment, useMemo, useState } from 'react'
import type { PredictionsState, TournamentResults } from '../../shared/types'
import type { Row } from '../../../sim-core'
import type { User } from '../../users'
import { TEAMS } from '../../shared/groups'
import { realPlayedState } from './realPlayed'
import { useWinProbabilities } from './useWinProbabilities'
import { fmtPct } from './summaryText'

const MEDALS = ['🥇', '🥈', '🥉']

// The signed jump the champion pick buys — from the bettor's plain win-odds to their
// odds *conditioned* on that champion coming through. Green when it lifts them, muted at
// a wash. (It's almost always a lift: the champion pick is worth heavy points.)
function Delta({ from, to }: { from: number; to: number }) {
  const d = to - from
  const dir = d > 0.05 ? 'up' : d < -0.05 ? 'down' : 'flat'
  const sign = d > 0 ? '+' : d < 0 ? '−' : ''
  return (
    <span className={`wp-delta wp-delta--${dir}`}>
      {sign}{fmtPct(Math.abs(d)).replace('%', '')}
      {dir !== 'flat' && <span className="wp-exp-arrow"> {dir === 'up' ? '▲' : '▼'}</span>}
    </span>
  )
}

function ChampionCell({ team, he }: { team: string; he: string }) {
  const iso = team ? TEAMS[team]?.iso : undefined
  return (
    <span className="wif-champ">
      {iso && <span className={`fi fi-${iso} wif-champ-flag`} aria-hidden="true" />}
      <span className="wif-champ-name">{he}</span>
    </span>
  )
}

// "מה אם" — the champion-conditioned pool odds. Every bettor bets a World Cup winner,
// worth a heavy chunk of points. This view answers the natural daydream: *if your
// champion actually lifts the trophy, what are your odds to win the whole pool?* It reads
// the exact same Monte-Carlo run as the win-probability tab, but restricts each bettor's
// finish to the sub-set of simulated tournaments where their predicted champion won.
export default function WhatIfChampionView({ results, me }: { results: TournamentResults; me?: string; users?: User[] }) {
  const played: PredictionsState = useMemo(() => realPlayedState(results), [results])
  // Real golden-boot goals banked so far, so the underlying sim rewards a picked scorer
  // who's already scoring — identical to the win-probability tab's latest-point read.
  const playerGoals = useMemo(() => {
    const cur: Record<string, number> = {}
    for (const [player, byMatch] of Object.entries(results.playerMatchGoals ?? {})) {
      let sum = 0
      for (const [matchId, goals] of Object.entries(byMatch)) {
        if (played[matchId] === undefined) continue
        sum += goals
      }
      if (sum > 0) cur[player] = sum
    }
    return cur
  }, [results, played])

  const { status, rows } = useWinProbabilities(played, playerGoals)
  const [openLabel, setOpenLabel] = useState<string | null>(null)

  // Sort by the champion-conditioned win odds. Bettors whose champion can no longer win
  // (condWinPct === null — the pick is out) sink to the bottom, ordered by who at least
  // still has the better plain odds.
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a.condWinPct, bv = b.condWinPct
      if (av === null && bv === null) return b.winPct - a.winPct
      if (av === null) return 1
      if (bv === null) return -1
      return bv - av
    })
  }, [rows])

  if (status === 'unsupported') {
    return <div className="lb-prob lb-prob--msg">הדפדפן הזה לא תומך בחישוב הסיכויים. נסו דפדפן עדכני.</div>
  }

  const loading = status === 'loading' || rows.length === 0
  const meRow = me ? rows.find(r => r.label === me) : undefined

  return (
    <div className="lb-prob">
      {loading ? (
        <div className="lb-prob-loading-inline" aria-busy="true">
          <div className="lb-prob-spinner" aria-hidden="true" />
          <p className="lb-prob-loading-text">מריצים אלפי סימולציות של יתרת הטורניר…</p>
        </div>
      ) : (
        <>
          {meRow && meRow.championTeam && (
            <section className="wp-me wif-me" dir="rtl" aria-label="מה אם האלופה שלך תנצח">
              <h3 className="wp-me-title">מה אם {meRow.championHe} תהיה אלופה?</h3>
              {meRow.condWinPct === null ? (
                <p className="wp-me-standing">
                  {meRow.championWinPct > 0
                    ? <>לפי המודל, {meRow.championHe} כמעט ולא לוקחת את התואר בסימולציות — אין מספיק תרחישים כאלה כדי לחשב סיכוי זכייה מותנה.</>
                    : <><b>{meRow.championHe} כבר לא יכולה לזכות</b> — האלופה שבחרת הודחה, כך שהתרחיש הזה כבר לא על השולחן.</>}
                </p>
              ) : (
                <>
                  <p className="wp-me-standing">
                    אם <b>{meRow.championHe}</b> באמת תזכה בגביע (סיכוי של <b>{fmtPct(meRow.championWinPct)}</b> לפי המודל),
                    סיכוי הזכייה שלך בקבוצה קופץ מ-<b>{fmtPct(meRow.winPct)}</b> ל-<b>{fmtPct(meRow.condWinPct)}</b>.
                  </p>
                  {meRow.condTop3Pct !== null && (
                    <p className="wp-me-standing wif-me-line">
                      הסיכוי לסיים <b>בטופ 3</b> קופץ מ-<b>{fmtPct(meRow.top3Pct)}</b> ל-<b>{fmtPct(meRow.condTop3Pct)}</b>,
                      {' '}ו<b>בטופ 5</b> מ-<b>{fmtPct(meRow.top5Pct)}</b> ל-<b>{fmtPct(meRow.condTop5Pct!)}</b>.
                    </p>
                  )}
                </>
              )}
            </section>
          )}

          <div className="lb-prob-scroll">
            <table className="wp-table">
              <thead>
                <tr>
                  <th className="wp-th wp-th--rank">#</th>
                  <th className="wp-th wp-th--name">מהמר</th>
                  <th className="wp-th wp-th--champ">אלופה</th>
                  <th className="wp-th wp-th--champp">סיכוי האלופה</th>
                  <th className="wp-th wp-th--now">זכייה עכשיו</th>
                  <th className="wp-th wp-th--if">אם האלופה תנצח</th>
                  <th className="wp-th wp-th--delta">שינוי</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r: Row, i) => {
                  const isMe = r.label === me
                  const out = !!r.championTeam && r.condWinPct === null
                  const rankBadge = r.condWinPct !== null && i < 3 ? MEDALS[i] : i + 1
                  const isOpen = openLabel === r.label
                  return (
                    <Fragment key={r.label}>
                      <tr
                        className={`wp-row${isMe ? ' wp-row--me' : ''}${r.condWinPct !== null && i < 3 ? ` wp-row--rank-${i + 1}` : ''}${isOpen ? ' wp-row--open' : ''}`}
                        onClick={() => setOpenLabel(isOpen ? null : r.label)}
                        aria-expanded={isOpen}
                      >
                        <td className="wp-td wp-td--rank">{rankBadge}</td>
                        <td className="wp-td wp-td--name">
                          <span className="wp-name">{r.label}</span>
                          {isMe && <span className="lb-me-badge">אני</span>}
                          {out && <span className="wp-flag">האלופה הודחה</span>}
                          <span className="wp-chevron" aria-hidden="true">⌄</span>
                        </td>
                        <td className="wp-td wp-td--champ">
                          <ChampionCell team={r.championTeam} he={r.championHe} />
                        </td>
                        <td className="wp-td wp-td--champp"><span className="wp-pct">{r.championTeam ? fmtPct(r.championWinPct) : '—'}</span></td>
                        <td className="wp-td wp-td--now"><span className="wp-pct">{fmtPct(r.winPct)}</span></td>
                        <td className="wp-td wp-td--if">
                          <span className="wp-pct wp-pct--hero">{r.condWinPct === null ? '—' : fmtPct(r.condWinPct)}</span>
                        </td>
                        <td className="wp-td wp-td--delta">
                          {r.condWinPct === null ? <span className="wp-delta wp-delta--flat">—</span> : <Delta from={r.winPct} to={r.condWinPct} />}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="wp-detail-row">
                          <td className="wp-detail-cell" colSpan={7}>
                            <div className="wif-detail" dir="rtl">
                              {r.condWinPct === null ? (
                                <p>
                                  {r.championTeam
                                    ? (r.championWinPct > 0
                                        ? <>{r.championHe} כמעט ולא זוכה בסימולציות, אז אי אפשר לגזור סיכוי זכייה מותנה אמין.</>
                                        : <><b>{r.championHe} הודחה</b> — התרחיש הזה כבר לא אפשרי.</>)
                                    : <>אין ל{r.label} ניחוש אלופה.</>}
                                </p>
                              ) : (
                                <>
                                  <p>
                                    מבין הסימולציות שבהן <b>{r.championHe}</b> זוכה בתואר (<b>{fmtPct(r.championWinPct)}</b> מהתרחישים),
                                    {' '}<b>{r.label}</b> מסיים ראשון בקבוצה ב-<b>{fmtPct(r.condWinPct)}</b> מהמקרים —
                                    {' '}לעומת <b>{fmtPct(r.winPct)}</b> בלי התנאי הזה.
                                  </p>
                                  {r.condTop3Pct !== null && (
                                    <p>
                                      הסיכוי ל<b>טופ 3</b> קופץ מ-<b>{fmtPct(r.top3Pct)}</b> ל-<b>{fmtPct(r.condTop3Pct)}</b>,
                                      {' '}ול<b>טופ 5</b> מ-<b>{fmtPct(r.top5Pct)}</b> ל-<b>{fmtPct(r.condTop5Pct!)}</b>.
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="lb-prob-note">
            <b>איך לקרוא:</b> כל מהמר בחר אלופת עולם — ניחוש ששווה הרבה נקודות. הטבלה מראה, לפי
            {' '}<b>מודל מונטה קרלו</b> (אלפי סימולציות של יתרת הטורניר), מה קורה <b>אם האלופה שבחר באמת תזכה</b>.
            «סיכוי האלופה» = הסיכוי שהאלופה שנבחרה תרים את הגביע. «זכייה עכשיו» = סיכוי הזכייה בקבוצה ללא תנאי.
            «אם האלופה תנצח» = סיכוי הזכייה <b>מבין התרחישים שבהם האלופה שנבחרה זוכה</b>. «שינוי» = הקפיצה בין השניים.
            מהמר שהאלופה שלו כבר הודחה יורד לתחתית — התרחיש שלו כבר לא אפשרי.
          </p>
        </>
      )}
    </div>
  )
}
