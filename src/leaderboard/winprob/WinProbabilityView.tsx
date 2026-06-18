import { Fragment, useMemo, useState } from 'react'
import type { PredictionsState, TournamentResults } from '../../shared/types'
import type { Row, BracketSurvival } from '../../../sim-core'
import { realEliminations, bracketSurvivalForLabel, explainLastMatch } from '../../../sim-core'
import { playedChrono, playedStateUpTo } from './realPlayed'
import { useWinProbabilities } from './useWinProbabilities'

const KO_KEYS = ['r32', 'r16', 'qf', 'sf', 'thirdPlace', 'final'] as const

// The real results trimmed to only the matches played by the selected point in
// time, so "bracket vs reality" stays consistent with the rest of the card.
function resultsUpTo(results: TournamentResults, played: PredictionsState): TournamentResults {
  const seen = (key: string) => played[key] !== undefined
  const clear = { home: null, away: null }
  return {
    ...results,
    groupMatches: Object.fromEntries(
      Object.entries(results.groupMatches).map(([g, ms]) =>
        [g, ms.map(m => (seen(m.id) ? m : { ...m, scores: clear }))]),
    ),
    knockoutStages: Object.fromEntries(
      KO_KEYS.map(k => [k, results.knockoutStages[k].map(m => (seen(String(m.matchNum)) ? m : { ...m, scores: clear }))]),
    ) as unknown as TournamentResults['knockoutStages'],
  }
}

const MEDALS = ['🥇', '🥈', '🥉']

// Expected final place + an arrow when it differs from the current standing
// (green = projected to climb, red = projected to slip).
function ExpectedPlace({ curRank, expRank }: { curRank: number; expRank: number }) {
  const rounded = Math.round(expRank)
  const dir = rounded < curRank ? 'up' : rounded > curRank ? 'down' : 'flat'
  return (
    <span className="wp-exp" title={`מקום נוכחי: ${curRank}`}>
      {rounded}
      {dir !== 'flat' && (
        <span className={`wp-exp-arrow wp-exp-arrow--${dir}`}>{dir === 'up' ? '▲' : '▼'}</span>
      )}
    </span>
  )
}

// win% movement since the last played game; muted dash when nothing to compare.
function Delta({ delta }: { delta: number | undefined }) {
  if (delta === undefined || Math.abs(delta) < 0.1) {
    return <span className="wp-delta wp-delta--flat">—</span>
  }
  const up = delta > 0
  return (
    <span className={`wp-delta wp-delta--${up ? 'up' : 'down'}`} dir="ltr">
      {up ? '+' : '−'}{Math.abs(delta).toFixed(1)}
    </span>
  )
}

// Tap-to-open key points for one bettor — plain Hebrew, no tooltips (mobile-first).
function RowDetail({ row, delta, reason, survival }: { row: Row; delta: number | undefined; reason?: string; survival?: BracketSurvival | null }) {
  const exp = Math.round(row.expRank)
  const dirWord = exp < row.curRank ? 'עלייה' : exp > row.curRank ? 'ירידה' : 'ללא שינוי'
  const moveCls = exp < row.curRank ? 'up' : exp > row.curRank ? 'down' : 'flat'

  let deltaText = 'למשחק לא הייתה השפעה משמעותית על הסיכוי'
  if (delta !== undefined && Math.abs(delta) >= 0.1) {
    deltaText = delta > 0
      ? `המשחק העלה את הסיכוי ב-${delta.toFixed(1)} נק׳ אחוז`
      : `המשחק הוריד את הסיכוי ב-${Math.abs(delta).toFixed(1)} נק׳ אחוז`
  }
  const reasonText = reason && reason.trim() ? reason : undefined

  return (
    <div className="wp-detail-card">
      <ul className="wp-points">
        <li>
          <span className="wp-point-label">מיקום בטבלה</span>
          <span className="wp-point-val">
            כעת <b>{row.curRank}</b> · מיקום ממוצע בסיום <b className={`wp-point-move wp-point-move--${moveCls}`}>{exp}</b>
            {moveCls !== 'flat' && <span className={`wp-point-move wp-point-move--${moveCls}`}> ({dirWord})</span>}
          </span>
        </li>
        <li>
          <span className="wp-point-label">סיכוי לזכות</span>
          <span className="wp-point-val"><b>{row.winPct.toFixed(1)}%</b> לסיים ראשון מבין כל המהמרים · טופ 5: <b>{row.top5Pct.toFixed(1)}%</b></span>
        </li>
        <li>
          <span className="wp-point-label">ניקוד צפוי בסיום</span>
          <span className="wp-point-val"><b>{row.avgPts.toFixed(0)}</b> נק׳ בממוצע (±{row.std.toFixed(0)})</span>
        </li>
        {survival && survival.total > 0 && (
          <li>
            <span className="wp-point-label">עדיין בטורניר</span>
            <span className="wp-point-val">
              <b className={`wp-point-move wp-point-move--${survival.out === 0 ? 'up' : survival.alive === 0 ? 'down' : 'flat'}`}>{survival.alive}/{survival.total}</b>
              {' '}מהקבוצות שבחרת לשמינית עדיין חיות
              {survival.painful && <span className="wp-point-move wp-point-move--down"> — נפילה כואבת: {survival.painful.teamHe} (בחרת ל{survival.painful.predictedLabel}, יצאה ב{survival.painful.exitLabel})</span>}
              <span className="wp-point-reason"> (שרידות בלבד — ניצחון/הפסד ומיקום מדויק בבתים כבר נכללים בסיכוי ובניקוד הצפוי)</span>
            </span>
          </li>
        )}
        <li>
          <span className="wp-point-label">השפעת המשחק</span>
          <span className="wp-point-val">
            {deltaText}
            {reasonText && <span className="wp-point-reason"> ({reasonText})</span>}
          </span>
        </li>
      </ul>
      <p className="wp-detail-how">
        הסיכוי הוא לסיים <b>ראשון מבין כל המהמרים</b>. לכן תוצאה שעוזרת גם ליריבים שבחרו אותה קבוצה יכולה דווקא להוריד אותך.
      </p>
    </div>
  )
}

export default function WinProbabilityView({ results, me }: { results: TournamentResults; me?: string }) {
  const chrono = useMemo(() => playedChrono(results), [results])
  const [openLabel, setOpenLabel] = useState<string | null>(null)
  // selected "point in time" = a played match id; null follows the latest game.
  const [selId, setSelId] = useState<string | null>(null)

  const effId = selId && chrono.some(m => m.id === selId)
    ? selId
    : (chrono.length ? chrono[chrono.length - 1].id : null)
  const isLatest = !!effId && chrono.length > 0 && effId === chrono[chrono.length - 1].id
  const last = useMemo(() => chrono.find(m => m.id === effId) ?? null, [chrono, effId])
  const played = useMemo(() => (effId ? playedStateUpTo(chrono, effId) : {}), [chrono, effId])
  const eliminations = useMemo(() => realEliminations(resultsUpTo(results, played)), [results, played])
  // Real golden-boot goals accrued up to the viewed point, so the projection and
  // current rank reward a picked scorer who's already scoring. `prev` excludes
  // the last played match, giving the delta a correct "before this game" baseline.
  const { playerGoals, prevPlayerGoals } = useMemo(() => {
    const cur: Record<string, number> = {}
    const prev: Record<string, number> = {}
    for (const [player, byMatch] of Object.entries(results.playerMatchGoals ?? {})) {
      let curSum = 0, prevSum = 0
      for (const [matchId, goals] of Object.entries(byMatch)) {
        if (played[matchId] === undefined) continue
        curSum += goals
        if (matchId !== effId) prevSum += goals
      }
      if (curSum > 0) cur[player] = curSum
      if (prevSum > 0) prev[player] = prevSum
    }
    return { playerGoals: cur, prevPlayerGoals: prev }
  }, [results, played, effId])

  const { status, rows, deltaByLabel } = useWinProbabilities(played, last, playerGoals, prevPlayerGoals)

  if (status === 'unsupported') {
    return <div className="lb-prob lb-prob--msg">הדפדפן הזה לא תומך בחישוב הסיכויים. נסו דפדפן עדכני.</div>
  }

  const loading = status === 'loading' || rows.length === 0
  const maxWin = loading ? 1 : Math.max(...rows.map(r => r.winPct), 1)

  // newest match first in the picker
  const pickerOptions = chrono.slice().reverse()

  return (
    <div className="lb-prob">
      <p className="lb-prob-caption">
        הסיכוי לסיים ראשון מבין כל המהמרים {isLatest ? 'לפי התוצאות האמיתיות' : 'לפי המצב אחרי המשחק שנבחר'}
        {last && <> · השינוי מאז <b>{last.label}</b></>}
      </p>

      {chrono.length > 1 && (
        <div className="lb-prob-controls">
          <label className="wp-picker-label" htmlFor="wp-point">נקודת זמן</label>
          <select
            id="wp-point"
            className="wp-picker"
            value={effId ?? ''}
            onChange={e => {
              const v = e.target.value
              const latestId = chrono[chrono.length - 1].id
              setSelId(v === latestId ? null : v)
              setOpenLabel(null)
            }}
          >
            {pickerOptions.map((m, i) => (
              <option key={m.id} value={m.id}>
                {i === 0 ? 'המשחק האחרון — ' : ''}{m.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="lb-prob-loading-inline" aria-busy="true">
          <div className="lb-prob-spinner" aria-hidden="true" />
          <p className="lb-prob-loading-text">מריצים אלפי סימולציות של יתרת הטורניר…</p>
        </div>
      ) : (
      <>
      <div className="lb-prob-scroll">
        <table className="wp-table">
          <thead>
            <tr>
              <th className="wp-th wp-th--rank">#</th>
              <th className="wp-th wp-th--name">מהמר</th>
              <th className="wp-th wp-th--win">סיכוי זכייה</th>
              <th className="wp-th wp-th--exp">מקום&nbsp;צפוי</th>
              <th className="wp-th wp-th--delta">שינוי&nbsp;%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isMe = r.label === me
              const barW = (r.winPct / maxWin) * 100
              const championOut = r.championHe !== '—' && !r.championAlive
              const isOpen = openLabel === r.label
              return (
                <Fragment key={r.label}>
                  <tr
                    className={`wp-row${isMe ? ' wp-row--me' : ''}${i < 3 ? ` wp-row--rank-${i + 1}` : ''}${isOpen ? ' wp-row--open' : ''}`}
                    onClick={() => setOpenLabel(isOpen ? null : r.label)}
                    aria-expanded={isOpen}
                  >
                    <td className="wp-td wp-td--rank">{i < 3 ? MEDALS[i] : i + 1}</td>
                    <td className="wp-td wp-td--name">
                      <span className="wp-name">{r.label}</span>
                      {isMe && <span className="lb-me-badge">אני</span>}
                      {championOut && <span className="wp-flag">אלופה הודחה</span>}
                      <span className="wp-chevron" aria-hidden="true">⌄</span>
                    </td>
                    <td className="wp-td wp-td--win">
                      <div className="wp-bar-wrap">
                        <div className="wp-bar" style={{ width: `${barW.toFixed(1)}%` }} />
                        <span className="wp-bar-pct">{r.winPct.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="wp-td wp-td--exp">
                      <ExpectedPlace curRank={r.curRank} expRank={r.expRank} />
                    </td>
                    <td className="wp-td wp-td--delta">
                      <Delta delta={deltaByLabel[r.label]} />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="wp-detail-row">
                      <td className="wp-detail-cell" colSpan={5}>
                        <RowDetail
                          row={r}
                          delta={deltaByLabel[r.label]}
                          reason={last ? explainLastMatch(r.label, last.home, last.away, last.homeScore, last.awayScore, eliminations) : undefined}
                          survival={bracketSurvivalForLabel(r.label, eliminations)}
                        />
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
        <b>איך לקרוא:</b> מיון לפי הסיכוי לסיים <b>ראשון מבין כל המהמרים</b>. «מקום צפוי» = הדירוג הממוצע בסיום,
        וחץ מראה אם צפויים לעלות או לרדת. <b>לחצו על שם</b> לפירוט קצר של הנתונים.
        {!isLatest && <> בחרתם נקודת זמן קודמת — אפשר לחזור ל«המשחק האחרון» בבורר למעלה.</>}
      </p>
      </>
      )}
    </div>
  )
}
