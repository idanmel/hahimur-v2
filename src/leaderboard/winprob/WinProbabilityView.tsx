import { Fragment, useMemo, useState } from 'react'
import type { PredictionsState, TournamentResults } from '../../shared/types'
import type { Row, AdvancementSummary, StageReach } from '../../../sim-core'
import { realEliminations, effectiveEliminations, advancementSummaryForLabel } from '../../../sim-core'
import { playedChrono, playedStateUpTo } from './realPlayed'
import { useWinProbabilities } from './useWinProbabilities'
import { fmtPct, deepPicksClause, groupPicksClause, edgeClause, buildMyHeadline } from './summaryText'

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

// Tap-to-open key points for one bettor — plain Hebrew, no tooltips (mobile-first).
function RowDetail({ row, advancement, stageReach }: { row: Row; advancement?: AdvancementSummary | null; stageReach: Record<string, StageReach> }) {
  const exp = Math.round(row.expRank)
  const dirWord = exp < row.curRank ? 'עלייה' : exp > row.curRank ? 'ירידה' : 'ללא שינוי'
  const moveCls = exp < row.curRank ? 'up' : exp > row.curRank ? 'down' : 'flat'

  const deepClause = advancement && advancement.total > 0 ? deepPicksClause(advancement, stageReach) : null
  const groupClause = advancement && advancement.total > 0 ? groupPicksClause(advancement) : null
  const edge = edgeClause(row)

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
          <span className="wp-point-val">
            <b>{fmtPct(row.winPct)}</b> · טופ 5: <b>{fmtPct(row.top5Pct)}</b>
          </span>
        </li>
        <li>
          <span className="wp-point-label">ניקוד צפוי בסיום</span>
          <span className="wp-point-val"><b>{row.avgPts.toFixed(0)}</b> נק׳ בממוצע (±{row.std.toFixed(0)})</span>
        </li>
        {(deepClause || groupClause) && (
          <li>
            <span className="wp-point-label">תמונת ההימור</span>
            <span className="wp-point-val">
              {deepClause && <span className="wp-bet-deep">{deepClause}</span>}
              {deepClause && groupClause && <br />}
              {groupClause}
            </span>
          </li>
        )}
        {edge && (
          <li>
            <span className="wp-point-label">מול הממוצע</span>
            <span className="wp-point-val">{edge}</span>
          </li>
        )}
      </ul>
    </div>
  )
}

// The featured personal read for the identified bettor, pinned to the top of the
// page so they don't have to find and expand their own row. A fuller synthesis than
// the row detail: standing, the edge that explains it, the marquee bets, and the
// live storyline. Built entirely from this bettor's own picks (no generic prose).
function MyHeadline({ name, row, advancement, stageReach, totalPlayers }: {
  name: string; row: Row; advancement: AdvancementSummary | null; stageReach: Record<string, StageReach>; totalPlayers: number
}) {
  const h = buildMyHeadline(row, advancement, stageReach, totalPlayers)
  const firstName = name.split(' ')[0]
  return (
    <section className="wp-me" dir="rtl" aria-label="סיכום ההימור שלך">
      <h3 className="wp-me-title">ההימור שלך, {firstName}</h3>
      <p className="wp-me-standing">{h.standing}</p>
      <ul className="wp-me-lines">
        {h.bigBets && <li><span className="wp-me-label">הקלפים הגדולים</span><span>{h.bigBets}</span></li>}
        {h.edge && <li><span className="wp-me-label">{h.edgeLabel}</span><span>{h.edge}</span></li>}
        {h.fallen && <li><span className="wp-me-label">כבר נפלו מהבית</span><span>{h.fallen}</span></li>}
      </ul>
    </section>
  )
}

// Sentinel "point in time" meaning before a single ball was kicked — the pure
// pre-tournament priors, with everything simulated from team strength alone.
const PRE_TOURNAMENT = '__pre__'

export default function WinProbabilityView({ results, me }: { results: TournamentResults; me?: string }) {
  const chrono = useMemo(() => playedChrono(results), [results])
  const [openLabel, setOpenLabel] = useState<string | null>(null)
  // selected "point in time": a played match id, the PRE_TOURNAMENT sentinel, or
  // null which follows the latest game.
  const [selId, setSelId] = useState<string | null>(null)

  const selectedPre = selId === PRE_TOURNAMENT
  const effId = selectedPre
    ? null
    : selId && chrono.some(m => m.id === selId)
      ? selId
      : (chrono.length ? chrono[chrono.length - 1].id : null)
  const isLatest = !selectedPre && !!effId && chrono.length > 0 && effId === chrono[chrono.length - 1].id
  const played = useMemo(() => (!selectedPre && effId ? playedStateUpTo(chrono, effId) : {}), [chrono, effId, selectedPre])
  const eliminations = useMemo(() => realEliminations(resultsUpTo(results, played)), [results, played])
  // Real golden-boot goals accrued up to the viewed point, so the projection and
  // current rank reward a picked scorer who's already scoring.
  const playerGoals = useMemo(() => {
    const cur: Record<string, number> = {}
    for (const [player, byMatch] of Object.entries(results.playerMatchGoals ?? {})) {
      let curSum = 0
      for (const [matchId, goals] of Object.entries(byMatch)) {
        if (played[matchId] === undefined) continue
        curSum += goals
      }
      if (curSum > 0) cur[player] = curSum
    }
    return cur
  }, [results, played])

  const { status, rows, reachByTeam, groupFirstByTeam, stageReachByTeam } = useWinProbabilities(played, playerGoals)
  // Certain real exits, widened by the model's verdict: a pick the simulation gives
  // essentially no path to the knockouts is shown as eliminated even before its
  // group formally closes — so "still alive" never contradicts a ~0% pick.
  const eliminationsEff = useMemo(() => effectiveEliminations(eliminations, reachByTeam), [eliminations, reachByTeam])

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
        הסיכוי לסיים ראשון מבין כל המהמרים{' '}
        {isLatest ? 'לפי התוצאות האמיתיות' : selectedPre ? 'לפי המצב לפני תחילת הטורניר' : 'לפי המצב אחרי המשחק שנבחר'}
      </p>

      {chrono.length >= 1 && (
        <div className="lb-prob-controls">
          <label className="wp-picker-label" htmlFor="wp-point">נקודת זמן</label>
          <select
            id="wp-point"
            className="wp-picker"
            value={selectedPre ? PRE_TOURNAMENT : (effId ?? '')}
            onChange={e => {
              const v = e.target.value
              setOpenLabel(null)
              if (v === PRE_TOURNAMENT) { setSelId(PRE_TOURNAMENT); return }
              const latestId = chrono[chrono.length - 1].id
              setSelId(v === latestId ? null : v)
            }}
          >
            {pickerOptions.map((m, i) => (
              <option key={m.id} value={m.id}>
                {i === 0 ? 'המשחק האחרון — ' : ''}{m.label}
              </option>
            ))}
            <option value={PRE_TOURNAMENT}>לפני תחילת הטורניר</option>
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
      {(() => {
        const meRow = me ? rows.find(r => r.label === me) : undefined
        return meRow ? (
          <MyHeadline
            name={me!}
            row={meRow}
            advancement={advancementSummaryForLabel(me!, reachByTeam, groupFirstByTeam, eliminationsEff)}
            stageReach={stageReachByTeam}
            totalPlayers={rows.length}
          />
        ) : null
      })()}
      <div className="lb-prob-scroll">
        <table className="wp-table">
          <thead>
            <tr>
              <th className="wp-th wp-th--rank">#</th>
              <th className="wp-th wp-th--name">מהמר</th>
              <th className="wp-th wp-th--win">סיכוי זכייה</th>
              <th className="wp-th wp-th--exp">מקום צפוי</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isMe = r.label === me
              const barW = (r.winPct / maxWin) * 100
              // "אלופה הודחה" keys off the *same* elimination set as the survival
              // line, so the flag can never contradict "still in the tournament".
              const championOut = !!r.championTeam && eliminationsEff.has(r.championTeam)
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
                        <span className="wp-bar-pct">{fmtPct(r.winPct)}</span>
                        <span className="wp-bar-top5">טופ 5: {fmtPct(r.top5Pct)}</span>
                      </div>
                    </td>
                    <td className="wp-td wp-td--exp">
                      <ExpectedPlace curRank={r.curRank} expRank={r.expRank} />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="wp-detail-row">
                      <td className="wp-detail-cell" colSpan={4}>
                        <RowDetail
                          row={r}
                          advancement={advancementSummaryForLabel(r.label, reachByTeam, groupFirstByTeam, eliminationsEff)}
                          stageReach={stageReachByTeam}
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
        וחץ מראה אם צפויים לעלות או לרדת. <b>לחצו על שם</b> לפירוט קצר. בפירוט: ב«תמונת ההימור» מופיע לכל קבוצה
        שבחרתם הסיכוי להגיע לשלב שחזיתם לה, ו«מול הממוצע» הוא הפרש הניקוד הצפוי שלכם מהמתחרים, לפי שלב.
        {!isLatest && <> בחרתם נקודת זמן קודמת — אפשר לחזור ל«המשחק האחרון» בבורר למעלה.</>}
      </p>
      </>
      )}
    </div>
  )
}
