import { useMemo, useState } from 'react'
import type { KnockoutMatch, TournamentResults } from '../shared/types'
import type { User } from '../users'
import { buildKnockoutBracket } from '../formView/knockout/knockout'
import { realPlayedState } from './winprob/realPlayed'
import { useWinProbabilities } from './winprob/useWinProbabilities'
import type { WinProbStatus } from './winprob/useWinProbabilities'
import { computeUserCrossings, crossingProbability, crossingParticipants, computeCrossingsLeaderboard } from './crossings'
import type { Crossing, CrossingStanding, RoundKey } from './crossings'
import { TeamChip } from './LeaderboardTable'
import { TEAMS } from '../shared/groups'
import './CrossingsView.css'

const teamHe = (team: string) => TEAMS[team]?.he ?? team

// One knockout stage's worth of config: the matchNum range it owns, the user
// bracket key it reads, in-sentence vs short labels, the noun ("הצלבות" only fits
// the round of 32; later rounds are plain "מפגשים"), and its match payouts
// (mirrors leaderboard/points.ts ROUND_POINTS). A locked pair only fixes the
// *matchup*; the score is still a separate bet, so payouts are an opportunity.
export interface RoundCfg {
  key: RoundKey
  tab: string
  label: string
  noun: string
  lo: number
  hi: number
  pagiya: number
  tzelifa: number
}

export const ROUNDS: RoundCfg[] = [
  { key: 'r32',   tab: 'שלב 32',  label: 'שלב ה-32', noun: 'הצלבות', lo: 73,  hi: 88,  pagiya: 5,  tzelifa: 7  },
  { key: 'r16',   tab: 'שמינית',  label: 'השמינית',  noun: 'מפגשים', lo: 89,  hi: 96,  pagiya: 6,  tzelifa: 8  },
  { key: 'qf',    tab: 'רבע גמר', label: 'רבע הגמר', noun: 'מפגשים', lo: 97,  hi: 100, pagiya: 8,  tzelifa: 12 },
  { key: 'sf',    tab: 'חצי גמר', label: 'חצי הגמר', noun: 'מפגשים', lo: 101, hi: 102, pagiya: 12, tzelifa: 16 },
  { key: 'final', tab: 'גמר',     label: 'הגמר',     noun: 'מפגשים', lo: 104, hi: 104, pagiya: 20, tzelifa: 25 },
]

function fmtPct(p: number): string {
  if (p >= 0.995) return '~100%'
  if (p > 0 && p < 0.005) return '<1%'
  return `${Math.round(p * 100)}%`
}

// Color the percentage so it reads at a glance: red (no chance) → amber → green
// (near certain), interpolated continuously across the probability.
function probColor(p: number): string {
  const hue = Math.round(Math.max(0, Math.min(1, p)) * 120) // 0=red, 120=green
  return `hsl(${hue} 75% 38%)`
}

function ProbBadge({ prob, status }: { prob: number | null; status: WinProbStatus }) {
  if (status === 'unsupported') return null
  if (status === 'loading' || prob === null) {
    return <span className="cx-prob cx-prob--loading">מחשב סיכוי…</span>
  }
  return <span className="cx-prob">סיכוי שתצא: <b style={{ color: probColor(prob) }}>{fmtPct(prob)}</b></span>
}

// The "who else called it" line: a tap-to-reveal count of the other bettors who
// predicted the same pairing, expanding to their names.
function Participants({ names, expanded, onToggle }: { names: string[]; expanded: boolean; onToggle: () => void }) {
  if (names.length === 0) return <span className="cx-mates cx-mates--solo">רק אתה ניחשת אותה ✦</span>
  return (
    <div className="cx-mates">
      <button type="button" className="cx-mates-toggle" onClick={onToggle} aria-expanded={expanded}>
        עוד {names.length} ניחשו כמוך
        <span className="cx-mates-chevron" aria-hidden="true">{expanded ? '⌃' : '⌄'}</span>
      </button>
      {expanded && (
        <ul className="cx-mates-list">
          {names.map(n => <li key={n} className="cx-mates-name">{n}</li>)}
        </ul>
      )}
    </div>
  )
}

function CrossingCard({ crossing, locked, ruledOut = false, prob, status, mates, expanded, onToggle }: {
  crossing: Crossing
  locked: boolean
  ruledOut?: boolean
  prob: number | null
  status: WinProbStatus
  mates: string[]
  expanded: boolean
  onToggle: () => void
}) {
  const [a, b] = crossing.teams
  const cls = locked ? ' cx-card--locked' : ruledOut ? ' cx-card--dead' : ''
  return (
    <article className={`cx-card${cls}`} data-testid="crossing-card">
      <div className="cx-card-teams">
        <TeamChip team={a.team} tag={a.confirmed ? 'בפנים ✓' : 'הניחוש שלך'} />
        <span className="cx-vs" aria-hidden="true">×</span>
        <TeamChip team={b.team} tag={b.confirmed ? 'בפנים ✓' : 'הניחוש שלך'} />
      </div>
      {locked ? (
        <div className="cx-card-foot cx-card-foot--locked">
          {crossing.predicted ? (
            <span className="cx-bet">הניחוש שלך: <b dir="ltr">{crossing.predicted.away}–{crossing.predicted.home}</b></span>
          ) : (
            <span className="cx-bet cx-bet--empty">לא ניחשת תוצאה למשחק הזה</span>
          )}
        </div>
      ) : ruledOut ? (
        <div className="cx-card-foot cx-card-foot--dead">
          <span className="cx-dead-tag">אין סיכוי שייפגשו · 0%</span>
          {crossing.pendingSlots.length > 0 && (
            <span className="cx-pending">היה ממתין ל־{crossing.pendingSlots.join(' · ')}</span>
          )}
        </div>
      ) : (
        <div className="cx-card-foot">
          <ProbBadge prob={prob} status={status} />
          {crossing.pendingSlots.length > 0 && (
            <span className="cx-pending">ממתין ל־{crossing.pendingSlots.join(' · ')}</span>
          )}
        </div>
      )}
      <Participants names={mates} expanded={expanded} onToggle={onToggle} />
    </article>
  )
}

const MEDALS = ['🥇', '🥈', '🥉']

// The expand-on-tap breakdown for one bettor in the standing: exactly which pairs
// are already locked and which are still open, each open one with its colored
// chance — so the expected number stops being a mystery and reads as "these are
// the calls, and this is how likely each is".
interface StandingDetailData {
  locked: Crossing[]
  potential: (Crossing & { prob: number | null })[]
}

function StandingDetail({ detail, status }: { detail: StandingDetailData; status: WinProbStatus }) {
  const { locked, potential } = detail
  // Separate live open pairings from ones the model rules out (a flat 0% once
  // ready) — the live ones rank by chance, the dead ones get their own muted group
  // so the breakdown is complete without listing an "open" pair at 0%.
  const openLive = potential.filter(c => status !== 'ready' || c.prob === null || c.prob > 0)
  const openDead = potential.filter(c => status === 'ready' && c.prob === 0)
  if (locked.length + openLive.length + openDead.length === 0) {
    return <div className="cx-board-detail cx-board-detail--empty">אין כרגע זוגות חיים לשחקן הזה בשלב הזה.</div>
  }
  // Open crossings, highest chance first — the most "bankable" reads at the top.
  const openSorted = [...openLive].sort((a, b) => (b.prob ?? 0) - (a.prob ?? 0))
  return (
    <div className="cx-board-detail">
      {locked.length > 0 && (
        <div className="cx-board-detail-sec">
          <span className="cx-board-detail-h cx-board-detail-h--locked">נעולות ({locked.length})</span>
          <div className="cx-board-pairs">
            {locked.map(c => (
              <span key={c.matchNum} className="cx-board-pair">
                {teamHe(c.teams[0].team)} × {teamHe(c.teams[1].team)}
                <span className="cx-board-pair-tag cx-board-pair-tag--locked">ודאי</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {openSorted.length > 0 && (
        <div className="cx-board-detail-sec">
          <span className="cx-board-detail-h cx-board-detail-h--open">פתוחות ({openSorted.length})</span>
          <div className="cx-board-pairs">
            {openSorted.map(c => (
              <span key={c.matchNum} className="cx-board-pair">
                {teamHe(c.teams[0].team)} × {teamHe(c.teams[1].team)}
                {status === 'ready'
                  ? <span className="cx-board-pair-tag" style={{ color: probColor(c.prob ?? 0) }}>{fmtPct(c.prob ?? 0)}</span>
                  : <span className="cx-board-pair-tag cx-board-pair-tag--loading">…</span>}
              </span>
            ))}
          </div>
        </div>
      )}
      {openDead.length > 0 && (
        <div className="cx-board-detail-sec">
          <span className="cx-board-detail-h cx-board-detail-h--dead">אין סיכוי ({openDead.length})</span>
          <div className="cx-board-pairs">
            {openDead.map(c => (
              <span key={c.matchNum} className="cx-board-pair cx-board-pair--dead">
                {teamHe(c.teams[0].team)} × {teamHe(c.teams[1].team)}
                <span className="cx-board-pair-tag cx-board-pair-tag--dead">0%</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// The professional headline of the page: who is on track to call the most R32
// crossings correctly. Ranked by expected hits (locked = certain, open ones
// weighted by their simulated chance), with a bar, medals and the viewer pinned.
// Tapping a row opens that bettor's exact pairs and per-pair chances.
function CrossingsLeaderboard({ standings, detailByLabel, me, status, noun }: {
  standings: CrossingStanding[]
  detailByLabel: Map<string, StandingDetailData>
  me?: string
  status: WinProbStatus
  noun: string
}) {
  const [openLabel, setOpenLabel] = useState<string | null>(null)
  if (standings.length === 0) return null
  const ready = status === 'ready'
  const maxExpected = Math.max(...standings.map(s => s.expected), 1)

  return (
    <section className="cx-board" dir="rtl" aria-label={`דירוג ${noun}`}>
      <div className="cx-board-head">
        <h3 className="cx-board-title">🎯 מי יפגע בהכי הרבה {noun}?</h3>
        <p className="cx-board-sub">
          דירוג לפי מספר ה{noun} הצפוי — נעולות נספרות במלואן, והפתוחות משוקללות לפי הסיכוי שייצאו.
          לחצו על שם כדי לראות אילו זוגות, וכמה סיכוי לכל אחד.
        </p>
      </div>
      <ol className="cx-board-list">
        {standings.map((s, i) => {
          const isMe = s.label === me
          const isOpen = openLabel === s.label
          const barW = (s.expected / maxExpected) * 100
          const detail = detailByLabel.get(s.label)
          return (
            <li key={s.label} className={`cx-board-item${isOpen ? ' cx-board-item--open' : ''}`}>
              <button
                type="button"
                className={`cx-board-row${isMe ? ' cx-board-row--me' : ''}${i < 3 ? ` cx-board-row--rank-${i + 1}` : ''}`}
                onClick={() => setOpenLabel(isOpen ? null : s.label)}
                aria-expanded={isOpen}
              >
                <span className="cx-board-rank">{i < 3 ? MEDALS[i] : i + 1}</span>
                <span className="cx-board-name">
                  {s.label}
                  {isMe && <span className="cx-board-mebadge">אתה</span>}
                  <span className="cx-board-chevron" aria-hidden="true">{isOpen ? '⌃' : '⌄'}</span>
                </span>
                <span className="cx-board-bar-wrap">
                  <span className="cx-board-bar" style={{ width: `${barW.toFixed(1)}%` }} />
                  <span className="cx-board-breakdown">{s.locked} נעולות · {s.potential} פתוחות</span>
                </span>
                <span className="cx-board-exp">
                  {ready ? <b>{s.expected.toFixed(1)}</b> : <b>{s.locked}</b>}
                  <span className="cx-board-exp-label">{ready ? 'צפויות' : 'נעולות'}</span>
                </span>
              </button>
              {isOpen && detail && <StandingDetail detail={detail} status={status} />}
            </li>
          )
        })}
      </ol>
      {!ready && status !== 'unsupported' && (
        <p className="cx-board-loading">מריצים סימולציות כדי לשקלל את ה{noun} הפתוחות…</p>
      )}
    </section>
  )
}

// The stage switcher. Same principle, every knockout round — tap to move from the
// round of 32 onward to the final. Rendered only when the container wires up a
// handler (so the test harness can drive CrossingsList without tabs).
function RoundTabs({ round, onRoundChange }: { round: RoundCfg; onRoundChange: (key: string) => void }) {
  return (
    <div className="cx-rounds" role="tablist" aria-label="שלב נוקאאוט">
      {ROUNDS.map(r => (
        <button
          key={r.key}
          type="button"
          role="tab"
          aria-selected={r.key === round.key}
          className={`cx-round-tab${r.key === round.key ? ' cx-round-tab--active' : ''}`}
          onClick={() => onRoundChange(r.key)}
        >
          {r.tab}
        </button>
      ))}
    </div>
  )
}

// Presentational body of the crossings view — the stage switcher, the viewer's own
// pairings for the selected round, and the field-wide standing. Exported so tests
// can drive it without the Monte-Carlo worker (pass an empty probByMatch /
// 'unsupported' status). `round` defaults to the round of 32.
export function CrossingsList({ user, users, round = ROUNDS[0], onRoundChange, actualMatches, probByMatch, probStatus }: {
  user?: User
  users: User[]
  round?: RoundCfg
  onRoundChange?: (key: string) => void
  actualMatches: KnockoutMatch[]
  probByMatch: Record<number, Record<string, number>>
  probStatus: WinProbStatus
}) {
  const [openMates, setOpenMates] = useState<Set<number>>(new Set())
  const toggleMates = (matchNum: number) =>
    setOpenMates(prev => {
      const next = new Set(prev)
      if (next.has(matchNum)) next.delete(matchNum)
      else next.add(matchNum)
      return next
    })

  const crossings = useMemo(
    () => (user ? computeUserCrossings(user.knockoutStages?.[round.key] ?? [], actualMatches) : null),
    [user, round.key, actualMatches],
  )
  const standings = useMemo(
    () => computeCrossingsLeaderboard(users, round.key, actualMatches, probByMatch),
    [users, round.key, actualMatches, probByMatch],
  )
  // Per-bettor breakdown for the expand-on-tap detail in the standing: their
  // locked pairs and open pairs (each with its simulated chance attached).
  const detailByLabel = useMemo(() => {
    const map = new Map<string, StandingDetailData>()
    for (const u of users) {
      const { locked, potential } = computeUserCrossings(u.knockoutStages?.[round.key] ?? [], actualMatches)
      map.set(u.label, {
        locked,
        potential: potential.map(c => ({ ...c, prob: crossingProbability(c, probByMatch) })),
      })
    }
    return map
  }, [users, round.key, actualMatches, probByMatch])

  const tabs = onRoundChange && <RoundTabs round={round} onRoundChange={onRoundChange} />

  if (!crossings) {
    return (
      <div className="cx-view cx-view--empty" dir="rtl">
        {tabs}
        <div className="cx-empty-icon">🔀</div>
        <p className="cx-empty-text">בחרו שחקן למעלה כדי לראות את הזוגות שלכם</p>
      </div>
    )
  }

  const { locked, potential } = crossings
  const matesFor = (c: Crossing) =>
    crossingParticipants(users, c.matchNum, c.teams[0].team, c.teams[1].team, user?.label)

  // Split the open pairings into ones the simulation still gives a chance and ones
  // it flatly rules out (0% once ready). The dead ones get their own section so the
  // picture is complete, without polluting "פתוחות" with confusing 0% chances.
  const potentialWithProb = potential.map(c => ({ c, prob: crossingProbability(c, probByMatch) }))
  const livePotential = potentialWithProb.filter(p => probStatus !== 'ready' || p.prob === null || p.prob > 0)
  const deadPotential = potentialWithProb.filter(p => probStatus === 'ready' && p.prob === 0)

  const hasCrossings = locked.length + potential.length > 0

  return (
    <div className="cx-view" dir="rtl">
      {tabs}
      {hasCrossings ? (
        <>
          <p className="cx-caption">
            ה{round.noun} של {round.label} שניחשת — אילו זוגות כבר נסגרו לטובתך, ובאילו עוד אפשר לפגוע (עם סיכוי משוער שיֵצאו).
          </p>
          <p className="cx-scoring-note">
            ניקוד {round.label}: פגיעה בתוצאה {round.pagiya} נק׳ · צליפה מדויקת {round.tzelifa} נק׳ · אם לא פגעת — 0.
          </p>

          <div className="cx-summary">
            <span className="cx-summary-stat cx-summary-stat--locked"><b>{locked.length}</b> נעולות</span>
            <span className="cx-summary-stat cx-summary-stat--potential"><b>{livePotential.length}</b> עוד בפוטנציאל</span>
            {deadPotential.length > 0 && (
              <span className="cx-summary-stat cx-summary-stat--dead"><b>{deadPotential.length}</b> כבר לא ריאליות</span>
            )}
          </div>

          {locked.length > 0 && (
            <section className="cx-sec">
              <div className="cx-sec-head">
                <span className="cx-sec-title cx-sec-title--locked">✓ נעולות</span>
                <span className="cx-sec-sub">שתי הקבוצות כבר כאן — מכאן אפשר לצבור ניקוד על המשחק</span>
              </div>
              <div className="cx-cards">
                {locked.map(c => (
                  <CrossingCard
                    key={c.matchNum} crossing={c} locked prob={null} status={probStatus}
                    mates={matesFor(c)} expanded={openMates.has(c.matchNum)} onToggle={() => toggleMates(c.matchNum)}
                  />
                ))}
              </div>
            </section>
          )}

          {livePotential.length > 0 && (
            <section className="cx-sec">
              <div className="cx-sec-head">
                <span className="cx-sec-title cx-sec-title--potential">⏳ עוד פתוחות</span>
                <span className="cx-sec-sub">עוד לא ידוע מי עולה — מדורג לפי הסיכוי שהזוג ייפגש</span>
              </div>
              <div className="cx-cards">
                {livePotential.map(({ c, prob }) => (
                  <CrossingCard
                    key={c.matchNum} crossing={c} locked={false}
                    prob={prob} status={probStatus}
                    mates={matesFor(c)} expanded={openMates.has(c.matchNum)} onToggle={() => toggleMates(c.matchNum)}
                  />
                ))}
              </div>
            </section>
          )}

          {deadPotential.length > 0 && (
            <section className="cx-sec">
              <div className="cx-sec-head">
                <span className="cx-sec-title cx-sec-title--dead">❌ כבר לא ריאליות</span>
                <span className="cx-sec-sub">הסימולציה כבר פוסלת את הזוגות האלה (0%) — לא נספרים בפוטנציאל</span>
              </div>
              <div className="cx-cards">
                {deadPotential.map(({ c }) => (
                  <CrossingCard
                    key={c.matchNum} crossing={c} locked={false} ruledOut prob={0} status={probStatus}
                    mates={matesFor(c)} expanded={openMates.has(c.matchNum)} onToggle={() => toggleMates(c.matchNum)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="cx-view--empty">
          <div className="cx-empty-icon">⏳</div>
          <p className="cx-empty-text">כאן עוד אין {round.noun}. הזוגות ייסגרו ככל שהשלבים הקודמים יוכרעו.</p>
        </div>
      )}

      <CrossingsLeaderboard standings={standings} detailByLabel={detailByLabel} me={user?.label} status={probStatus} noun={round.noun} />
    </div>
  )
}

// The current bettor's knockout pairings for the chosen stage, classified against
// the real bracket and scored by a Monte-Carlo chance of coming true. Both the
// bracket and the odds are derived from the real played results, so the picture
// matches reality (not any on-page simulation). The stage tabs let the same view
// continue from the round of 32 all the way to the final. Each player sees their
// own — driven by the name picker.
export default function CrossingsView({ user, users, results }: { user?: User; users: User[]; results: TournamentResults }) {
  const [roundKey, setRoundKey] = useState('r32')
  const round = ROUNDS.find(r => r.key === roundKey) ?? ROUNDS[0]
  const played = useMemo(() => realPlayedState(results), [results])
  const bracket = useMemo(() => buildKnockoutBracket(played), [played])
  const actualMatches = useMemo(
    () => bracket.filter(m => m.matchNum >= round.lo && m.matchNum <= round.hi),
    [bracket, round.lo, round.hi],
  )
  // Golden-boot goals don't affect the bracket pairings, so passing them is only
  // about sharing the win-prob cache; the empty default keeps it simple.
  const { status, crossingProbByMatch } = useWinProbabilities(played, results.playerGoals ?? {})

  return (
    <CrossingsList
      user={user}
      users={users}
      round={round}
      onRoundChange={setRoundKey}
      actualMatches={actualMatches}
      probByMatch={crossingProbByMatch}
      probStatus={status}
    />
  )
}
