import { Fragment, useMemo, useState } from 'react'
import type { PredictionsState, TournamentResults } from '../../shared/types'
import type { Row, AdvancementSummary, StageReach } from '../../../sim-core'
import { realEliminations, effectiveEliminations, advancementSummaryForLabel, reachAtRank } from '../../../sim-core'
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

// A win% that rounds to 0.0 isn't a proven impossibility — at the card's sim count
// it just means "below the resolution we can see". Showing "<0.1%" instead of "0%"
// keeps it honest (and matches why such a bettor can still top a best-case board).
function fmtPct(p: number): string {
  return p > 0 && p < 0.1 ? '<0.1%' : `${p.toFixed(1)}%`
}

// Short Hebrew header for the depth a team was backed to reach.
const DEPTH_HEAD: Record<number, string> = { 7: 'אלופה', 6: 'לגמר', 5: 'לחצי', 4: 'לרבע' }

// The bettor's *deep* picks (quarter-final and beyond), each with the model's odds
// to reach the exact stage they predicted — "you took Spain all the way: 18% title,
// England to the final: 29%…". This is the heart of the round: it ties each pick to
// the depth it was bet at, in percentages. Eliminated picks are flagged outright.
// Grouped by depth (deepest first); a pick is listed once, at its deepest stage.
function deepPicksClause(s: AdvancementSummary, stageReach: Record<string, StageReach>): string | null {
  const deep = s.picks.filter(p => p.predictedRank >= 4).sort((a, b) => b.predictedRank - a.predictedRank)
  if (!deep.length) return null
  const groups: string[] = []
  for (const rank of [7, 6, 5, 4]) {
    const inRank = deep.filter(p => p.predictedRank === rank)
    if (!inRank.length) continue
    const items = inRank.map(p => p.stage === 'out'
      ? `${p.teamHe} (הודחה)`
      : `${p.teamHe} ${Math.round(reachAtRank(stageReach[p.team], rank) * 100)}%`)
    groups.push(`${DEPTH_HEAD[rank]}: ${items.join(', ')}`)
  }
  return groups.join(' · ')
}

// The group-stage advance picks (teams backed only to escape the group — deeper
// calls live in the depth clause above). Lead with the busts the bettor most wants
// to know about: teams they sent through that now have no realistic path. Then the
// ones still in the balance with their odds, and a bare count of the safe rest — no
// opaque "x/y" fraction.
function groupPicksClause(s: AdvancementSummary): string | null {
  const shallow = s.picks.filter(p => p.predictedRank <= 3)
  if (!shallow.length) return null
  const dead = shallow.filter(p => p.stage === 'out').map(p => p.teamHe)
  const risk = shallow.filter(p => p.stage === 'bubble' || p.stage === 'longshot')
    .sort((a, b) => a.reach - b.reach).map(p => `${p.teamHe} ${Math.round(p.reach * 100)}%`)
  const safe = shallow.filter(p => p.stage === 'secured' || p.stage === 'likely').length
  const parts: string[] = []
  if (dead.length) parts.push(`כבר לא יעלו: ${dead.join(', ')}`)
  if (risk.length) parts.push(`בסיכון: ${risk.join(', ')}`)
  if (safe) parts.push(`עוד ${safe} בדרך בטוחה לעלות`)
  return parts.join(' · ')
}

// Where this bettor gains or loses points against the field, by tournament stage —
// the actual scoring model talking (group advance + place, the round-of-32 cross,
// each knockout round, the golden boot). Each stage's value is the bettor's mean
// points there minus the field mean, so this is the personal edge that decides the
// pool, not a generic recap. Only stages with a meaningful gap are named.
const EDGE_MIN = 4
function edgeClause(row: Row): string | null {
  const sig = row.stages.filter(s => Math.abs(s.edge) >= EDGE_MIN)
  if (!sig.length) return null
  const fmt = (s: Row['stages'][number]) => `${s.label} (${s.edge > 0 ? '+' : '−'}${Math.abs(s.edge).toFixed(0)})`
  const strong = sig.filter(s => s.edge > 0).sort((a, b) => b.edge - a.edge).slice(0, 3).map(fmt)
  const weak = sig.filter(s => s.edge < 0).sort((a, b) => a.edge - b.edge).slice(0, 2).map(fmt)
  const parts: string[] = []
  if (strong.length) parts.push(`מרוויח על המתחרים ב${strong.join(', ')}`)
  if (weak.length) parts.push(`מפסיד להם ב${weak.join(', ')}`)
  return parts.join(' · ')
}

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
function RowDetail({ row, winRank, advancement, stageReach }: { row: Row; winRank: number; advancement?: AdvancementSummary | null; stageReach: Record<string, StageReach> }) {
  const exp = Math.round(row.expRank)
  const dirWord = exp < row.curRank ? 'עלייה' : exp > row.curRank ? 'ירידה' : 'ללא שינוי'
  const moveCls = exp < row.curRank ? 'up' : exp > row.curRank ? 'down' : 'flat'

  // The win% (finish *first*) is tail-sensitive, so it can diverge sharply from
  // the average finish: a high-variance bracket tops the field often yet lands
  // mid-pack on average, while a steady one finishes high but rarely wins outright.
  // Spell that gap out — but only for bettors where it actually matters: a real
  // shot at first (≥5%) for the jackpot read, or a genuine top-5 contender (≥20%)
  // for the steady read. Otherwise a tiny tail isn't worth a "high-variance" label.
  let spreadNote: string | undefined
  const gap = exp - winRank
  if (gap >= 3 && row.winPct >= 5) spreadNote = `שים לב: הסיכוי לזכות גבוה ביחס למקום הממוצע (${exp}) — ברקט בסיכון-תשואה גבוה, שמזנק לראש בחלק מהתרחישים אך בממוצע נוחת באמצע`
  else if (gap <= -3 && row.top5Pct >= 20) spreadNote = `שים לב: ברקט יציב — מסיים בממוצע במקום ${exp}, אך לעיתים רחוקות לבד בראש, ולכן הסיכוי לזכות נמוך יחסית`

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
            {spreadNote && <span className="wp-point-reason"> ({spreadNote})</span>}
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
                          winRank={i + 1}
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
