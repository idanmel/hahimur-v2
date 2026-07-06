import { useMemo, useState } from 'react'
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

          <ul className="wif-list">
            {sorted.map((r: Row, i) => {
              const isMe = r.label === me
              const out = !!r.championTeam && r.condWinPct === null
              const ranked = r.condWinPct !== null
              const rankBadge = ranked && i < 3 ? MEDALS[i] : i + 1
              const isOpen = openLabel === r.label
              return (
                <li key={r.label} className={`wif-card${isMe ? ' wif-card--me' : ''}${ranked && i < 3 ? ` wif-card--rank-${i + 1}` : ''}${isOpen ? ' wif-card--open' : ''}`}>
                  <button
                    type="button"
                    className="wif-card__bar"
                    onClick={() => setOpenLabel(isOpen ? null : r.label)}
                    aria-expanded={isOpen}
                  >
                    <span className="wif-card__rank">{rankBadge}</span>
                    <span className="wif-card__id">
                      <span className="wif-card__name">
                        {r.label}
                        {isMe && <span className="lb-me-badge">אני</span>}
                      </span>
                      <span className="wif-card__champ">
                        <ChampionCell team={r.championTeam} he={r.championHe} />
                        {out && <span className="wp-flag">הודחה</span>}
                      </span>
                    </span>
                    <span className="wif-card__headline">
                      <span className="wif-card__big">{r.condWinPct === null ? '—' : fmtPct(r.condWinPct)}</span>
                      <span className="wif-card__cap">אם האלופה תנצח</span>
                    </span>
                    <span className="wp-chevron" aria-hidden="true">⌄</span>
                  </button>

                  <div className="wif-card__stats">
                    <span className="wif-stat">
                      <span className="wif-stat__label">סיכוי האלופה</span>
                      <span className="wif-stat__val">{r.championTeam ? fmtPct(r.championWinPct) : '—'}</span>
                    </span>
                    <span className="wif-stat">
                      <span className="wif-stat__label">זכייה עכשיו</span>
                      <span className="wif-stat__val">{fmtPct(r.winPct)}</span>
                    </span>
                    <span className="wif-stat">
                      <span className="wif-stat__label">שינוי</span>
                      <span className="wif-stat__val">
                        {r.condWinPct === null ? <span className="wp-delta wp-delta--flat">—</span> : <Delta from={r.winPct} to={r.condWinPct} />}
                      </span>
                    </span>
                  </div>

                  {isOpen && (
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
                  )}
                </li>
              )
            })}
          </ul>

          <p className="lb-prob-note">
            <b>איך לקרוא:</b> כל מהמר בחר אלופת עולם — ניחוש ששווה הרבה נקודות. לפי
            {' '}<b>מודל מונטה קרלו</b> (אלפי סימולציות של יתרת הטורניר), הכרטיס מראה מה קורה <b>אם האלופה שבחר באמת תזכה</b>.
            «אם האלופה תנצח» = סיכוי הזכייה <b>מבין התרחישים שבהם האלופה שנבחרה זוכה</b>.
            «סיכוי האלופה» = הסיכוי שהאלופה שנבחרה תרים את הגביע. «זכייה עכשיו» = סיכוי הזכייה בקבוצה ללא תנאי. «שינוי» = הקפיצה בין השניים.
            {' '}הקישו על כרטיס לפירוט טופ 3 וטופ 5. מהמר שהאלופה שלו כבר הודחה יורד לתחתית — התרחיש שלו כבר לא אפשרי.
          </p>
        </>
      )}
    </div>
  )
}
