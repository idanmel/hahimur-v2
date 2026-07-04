import { useMemo, useState } from 'react'
import type { KnockoutMatch, MatchScores, TournamentResults } from '../shared/types'
import { isUnpredicted } from '../shared/types'
import type { User } from '../users'
import { buildKnockoutBracket } from '../formView/knockout/knockout'
import { realPlayedState } from './winprob/realPlayed'
import { useWinProbabilities } from './winprob/useWinProbabilities'
import type { WinProbStatus } from './winprob/useWinProbabilities'
import { computeUserCrossings, crossingProbability, crossingBreakdown, crossingParticipants, computeCrossingsLeaderboard, computeDeterminedCrossings, computeCrossingsSummary, rankedCrossingsSummary, summaryTotals, defaultCrossingsRound } from './crossings'
import type { Crossing, CrossingStanding, CrossingBreakdown, RoundKey, DeterminedCrossing, CrossingSummaryStanding, CrossingSummaryStage, CrossingBuckets } from './crossings'
import { OUTCOME_LABEL, ROUND_POINTS } from './points'
import { buildLiveStages } from '../pages/forms/survivorsStats'
import type { LiveTeamsStanding, LiveStage, LiveStageKey, Collision } from '../pages/forms/survivorsStats'
import { TeamChip } from './LeaderboardTable'
import { TEAMS } from '../shared/groups'
import './CrossingsView.css'

const teamHe = (team: string) => TEAMS[team]?.he ?? team

// One knockout stage's worth of config: the matchNum range it owns, the user
// bracket key it reads, in-sentence vs short labels, and the noun ("הצלבות" only
// fits the round of 32; later rounds are plain "מפגשים"). Match payouts are NOT
// here — they live once in points.ts ROUND_POINTS; see roundPoints below.
export interface RoundCfg {
  key: RoundKey
  tab: string
  label: string
  noun: string
  lo: number
  hi: number
}

export const ROUNDS: RoundCfg[] = [
  { key: 'r32',   tab: 'שלב 32',  label: 'שלב ה-32', noun: 'הצלבות', lo: 73,  hi: 88  },
  { key: 'r16',   tab: 'שמינית',  label: 'השמינית',  noun: 'מפגשים', lo: 89,  hi: 96  },
  { key: 'qf',    tab: 'רבע גמר', label: 'רבע הגמר', noun: 'מפגשים', lo: 97,  hi: 100 },
  { key: 'sf',    tab: 'חצי גמר', label: 'חצי הגמר', noun: 'מפגשים', lo: 101, hi: 102 },
  { key: 'thirdPlace', tab: 'מקום 3', label: 'המקום השלישי', noun: 'מפגשים', lo: 103, hi: 103 },
  { key: 'final', tab: 'גמר',     label: 'הגמר',     noun: 'מפגשים', lo: 104, hi: 104 },
]

// A crossings round's payouts, from the single source in points.ts. Its round keys
// match ours except the third-place match, which points.ts calls 'third'.
const roundPoints = (key: RoundKey) => ROUND_POINTS[key === 'thirdPlace' ? 'third' : key]

function fmtPct(p: number): string {
  // Never claim 100% for an open crossing: only a *locked* pair (both teams already
  // in the slot) is truly certain, and those don't render a percentage at all. A
  // simulated ~100% just means "all but sealed" — show it as 99%+ so it doesn't read
  // as done while sitting outside "נעולות".
  if (p >= 0.995) return '99%+'
  if (p > 0 && p < 0.005) return '<1%'
  return `${Math.round(p * 100)}%`
}

// Color the percentage so it reads at a glance: red (no chance) → amber → green
// (near certain), interpolated continuously across the probability.
function probColor(p: number): string {
  const hue = Math.round(Math.max(0, Math.min(1, p)) * 120) // 0=red, 120=green
  return `hsl(${hue} 75% 38%)`
}

// For a 0%-chance ("ruled out") crossing, which of the bettor's still-open teams
// can no longer reach the slot — the real reason the pair won't happen. Returns the
// Hebrew name of that team, or null when both are still reachable but simply can't
// end up together (then it's a generic "no chance", not one team being knocked out).
function deadBlocker(crossing: Crossing, breakdown?: CrossingBreakdown | null): string | null {
  if (!breakdown) return null
  const reach = [breakdown.reachA, breakdown.reachB]
  const blocked = crossing.teams.filter((t, i) => !t.confirmed && reach[i] === 0)
  return blocked.length === 1 ? teamHe(blocked[0].team) : null
}

// Explains the percentage for *the bettor's own pick*: for each predicted team,
// whether it's already in the slot or what it still has to finish as, with that
// team's simulated chance, and the combined chance the two actually meet. No other
// matchups — just what has to happen for this crossing.
function ProbBadge({ prob, status, crossing, breakdown }: {
  prob: number | null
  status: WinProbStatus
  crossing?: Crossing
  breakdown?: CrossingBreakdown | null
}) {
  const [open, setOpen] = useState(false)
  if (status === 'unsupported') return null
  if (status === 'loading' || prob === null) {
    return <span className="cx-prob cx-prob--loading">מחשב סיכוי…</span>
  }
  if (!crossing || !breakdown) {
    return <span className="cx-prob">סיכוי שתצא: <b style={{ color: probColor(prob) }}>{fmtPct(prob)}</b></span>
  }
  const reaches = [breakdown.reachA, breakdown.reachB]
  return (
    <div className="cx-prob-wrap">
      <button type="button" className="cx-prob cx-prob--btn" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        סיכוי שתצא: <b style={{ color: probColor(prob) }}>{fmtPct(prob)}</b>
        <span className="cx-prob-info" aria-hidden="true">{open ? '⌃' : 'ⓘ'}</span>
      </button>
      {open && (
        <div className="cx-calc" data-testid="crossing-calc">
          <p className="cx-calc-lead">מה צריך לקרות כדי שהזוג שלך ייפגש:</p>
          <ul className="cx-calc-list">
            {crossing.teams.map((t, i) => (
              <li key={t.team} className="cx-calc-opt">
                {t.confirmed ? (
                  <>
                    <span className="cx-calc-opt-team">✓ {teamHe(t.team)} כבר במשבצת</span>
                    <b className="cx-calc-done">בפנים</b>
                  </>
                ) : (
                  <>
                    <span className="cx-calc-opt-team">{teamHe(t.team)} צריכה להיות {t.needsSlot ?? 'במשבצת'}</span>
                    <b style={{ color: probColor(reaches[i]) }}>{fmtPct(reaches[i])}</b>
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className="cx-calc-total">
            <span>הסיכוי ששתיהן יסתדרו ויפגשו</span>
            <b style={{ color: probColor(breakdown.joint) }}>{fmtPct(breakdown.joint)}</b>
          </div>
        </div>
      )}
    </div>
  )
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

function CrossingCard({ crossing, locked, certain = false, ruledOut = false, missed = false, prob, breakdown, status, mates, expanded, onToggle }: {
  crossing: Crossing
  locked: boolean
  // A pairing the simulation makes inevitable (100%) even though the bracket slot
  // isn't formally filled yet — shown alongside the truly-locked pairs with a badge.
  certain?: boolean
  ruledOut?: boolean
  missed?: boolean
  prob: number | null
  breakdown?: CrossingBreakdown | null
  status: WinProbStatus
  mates: string[]
  expanded: boolean
  onToggle: () => void
}) {
  const [a, b] = crossing.teams
  const cls = locked ? (certain ? ' cx-card--locked cx-card--certain' : ' cx-card--locked') : missed ? ' cx-card--missed' : ruledOut ? ' cx-card--dead' : ''
  const deadBlk = ruledOut ? deadBlocker(crossing, breakdown) : null
  // On a missed crossing, neither predicted team is "in as predicted", so don't
  // hand out a green "בפנים ✓" — just show them as the (failed) bet.
  const tagFor = (t: { confirmed: boolean }) => (!missed && t.confirmed ? 'בפנים ✓' : 'הניחוש שלך')
  return (
    <article className={`cx-card${cls}`} data-testid="crossing-card">
      <div className="cx-card-teams">
        <TeamChip team={a.team} tag={tagFor(a)} />
        <span className="cx-vs" aria-hidden="true">×</span>
        <TeamChip team={b.team} tag={tagFor(b)} />
      </div>
      {locked ? (
        <div className="cx-card-foot cx-card-foot--locked">
          {certain && (
            <span className="cx-certain-badge" title="הזוג כבר ודאי — שתי הקבוצות מובטחות למשבצת גם אם הבית עוד לא נסגר רשמית">
              ודאי · נסגר
            </span>
          )}
          {crossing.predicted ? (
            <span className="cx-bet">הניחוש שלך: <b dir="ltr">{crossing.predicted.away}–{crossing.predicted.home}</b></span>
          ) : (
            <span className="cx-bet cx-bet--empty">לא ניחשת תוצאה למשחק הזה</span>
          )}
        </div>
      ) : missed ? (
        <div className="cx-card-foot cx-card-foot--missed">
          <span className="cx-missed-tag">ההצלבה נשברה</span>
          {crossing.actualTeams && crossing.actualTeams.length > 0 && (
            <span className="cx-missed-actual">בפועל: {crossing.actualTeams.map(teamHe).join(' × ')}</span>
          )}
        </div>
      ) : ruledOut ? (
        <div className="cx-card-foot cx-card-foot--dead">
          <span className="cx-dead-tag">{deadBlk ? `${deadBlk} כבר לא יכולה להגיע למשבצת` : 'אין סיכוי שהזוג ייפגש'}</span>
          {crossing.pendingSlots.length > 0 && (
            <span className="cx-pending">היה ממתין ל־{crossing.pendingSlots.join(' · ')}</span>
          )}
        </div>
      ) : (
        <div className="cx-card-foot">
          <ProbBadge prob={prob} status={status} crossing={crossing} breakdown={breakdown} />
          {crossing.pendingSlots.length > 0 && (
            <span className="cx-pending">ממתין ל־{crossing.pendingSlots.join(' · ')}</span>
          )}
        </div>
      )}
      <Participants names={mates} expanded={expanded} onToggle={onToggle} />
    </article>
  )
}

// A finished crossing in the viewer's own list: the real scoreline, who advanced,
// the bettor's own predicted score, and how it scored (צליפה/פגיעה/החטאה + points).
// Everything reads from crossing.result, which is already oriented to the real
// fixture, so the card can't contradict the actual home/away order.
function FinishedCard({ crossing, mates, expanded, onToggle }: {
  crossing: Crossing
  mates: string[]
  expanded: boolean
  onToggle: () => void
}) {
  const r = crossing.result!
  const tagFor = (team: string) => (r.advancer === team ? 'עלתה ✓' : '')
  const chipCls = (team: string) => (r.advancer && r.advancer !== team ? ' cx-fin-team--out' : '')
  const hasPred = r.predHome !== null && r.predAway !== null
  return (
    <article className="cx-card cx-card--finished" data-testid="finished-card">
      <div className="cx-card-teams">
        <span className={`cx-fin-team${chipCls(r.home)}`}><TeamChip team={r.home} tag={tagFor(r.home)} /></span>
        {/* LTR score so it aligns with the RTL chips: away–home mirrors [home]×[away]. */}
        <b className="cx-fin-score" dir="ltr">{r.awayScore}–{r.homeScore}</b>
        <span className={`cx-fin-team${chipCls(r.away)}`}><TeamChip team={r.away} tag={tagFor(r.away)} /></span>
      </div>
      <div className="cx-card-foot cx-card-foot--finished">
        <span className={`cx-outcome cx-outcome--${r.outcome}`}>
          {OUTCOME_LABEL[r.outcome]}{r.points > 0 ? ` · +${r.points}` : ''}
        </span>
        {hasPred ? (
          <span className="cx-bet">הניחוש שלך: <b dir="ltr">{r.predAway}–{r.predHome}</b></span>
        ) : (
          <span className="cx-bet cx-bet--empty">לא ניחשת תוצאה למשחק הזה</span>
        )}
      </div>
      <Participants names={mates} expanded={expanded} onToggle={onToggle} />
    </article>
  )
}

// One determined pairing on the shared board: the two real teams, how many of the
// group called it, and (on tap) exactly who. The viewer is highlighted in the list.
function DeterminedCard({ item, me, expanded, onToggle }: {
  item: DeterminedCrossing
  me?: string
  expanded: boolean
  onToggle: () => void
}) {
  // A partial slot: only one team has advanced so far, the opponent is still open.
  if (item.partial) {
    const solo = item.teams[0]
    return (
      <article className="cx-det-card cx-det-card--partial" data-testid="partial-card">
        <div className="cx-card-teams">
          <TeamChip team={solo} tag="עלתה ✓" />
          <span className="cx-vs" aria-hidden="true">×</span>
          <span className="cx-det-tbd">טרם נקבע</span>
        </div>
        <div className="cx-det-foot cx-det-foot--partial">עלתה לשלב הבא — היריבה עוד תיקבע</div>
      </article>
    )
  }
  const [a, b] = item.teams
  const r = item.result
  const advTag = (team: string) => (r?.advancer === team ? 'עלתה ✓' : '')
  const n = item.predictors.length
  // Viewer first, then the rest as computed (Hebrew-alphabetical).
  const names = me && item.predictors.includes(me)
    ? [me, ...item.predictors.filter(p => p !== me)]
    : item.predictors
  return (
    <article className={`cx-det-card${n === 0 ? ' cx-det-card--none' : ''}${item.certain ? ' cx-det-card--certain' : ''}${r ? ' cx-det-card--finished' : ''}`} data-testid="determined-card">
      <div className="cx-card-teams">
        <TeamChip team={a} tag={advTag(a)} />
        {r ? (
          <b className="cx-fin-score" dir="ltr">{r.awayScore}–{r.homeScore}</b>
        ) : (
          <span className="cx-vs" aria-hidden="true">×</span>
        )}
        <TeamChip team={b} tag={advTag(b)} />
      </div>
      {item.certain && (
        <span className="cx-certain-badge" title="הזוג כבר ודאי — שתי הקבוצות מובטחות למשבצת גם אם הבית עוד לא נסגר רשמית">
          ודאי · נסגר
        </span>
      )}
      {n === 0 ? (
        <div className="cx-det-foot cx-det-foot--none">אף אחד לא ניחש את ההצלבה</div>
      ) : (
        <>
          <button type="button" className="cx-det-count" onClick={onToggle} aria-expanded={expanded}>
            <span className="cx-det-num">{n}</span>
            <span className="cx-det-num-label">{n === 1 ? 'ניחש את ההצלבה' : 'ניחשו את ההצלבה'}</span>
            <span className="cx-mates-chevron" aria-hidden="true">{expanded ? '⌃' : '⌄'}</span>
          </button>
          {expanded && (
            <ul className="cx-det-names">
              {names.map(p => (
                <li key={p} className={`cx-det-name${p === me ? ' cx-det-name--me' : ''}`}>
                  {p}{p === me ? ' (אתה)' : ''}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </article>
  )
}

// The shared, viewer-independent picture: every pairing already settled in this
// round, sorted by how many people called it, each expandable to the names. Gives
// everyone one clear overview of all the determined matches.
function DeterminedBoard({ items, round, me }: {
  items: DeterminedCrossing[]
  round: RoundCfg
  me?: string
}) {
  const [open, setOpen] = useState<Set<number>>(new Set())
  const toggle = (matchNum: number) =>
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(matchNum)) next.delete(matchNum)
      else next.add(matchNum)
      return next
    })

  const determined = items.filter(it => !it.partial)
  const partials = items.filter(it => it.partial)

  if (determined.length === 0 && partials.length === 0) {
    return (
      <div className="cx-view--empty">
        <div className="cx-empty-icon">⏳</div>
        <p className="cx-empty-text">עדיין לא נקבעו {round.noun} ב{round.label}. הזוגות ייסגרו ככל שהשלבים הקודמים יוכרעו.</p>
      </div>
    )
  }

  const total = round.hi - round.lo + 1
  return (
    <>
      <p className="cx-caption">
        כל ה{round.noun} ש<b>כבר נקבעו</b> ב{round.label} — וכמה מכם ניחשו כל אחת. לחיצה על המספר חושפת מי.
      </p>
      <div className="cx-summary">
        <span className="cx-summary-stat cx-summary-stat--locked"><b>{determined.length}</b> מתוך {total} נקבעו</span>
        {partials.length > 0 && (
          <span className="cx-summary-stat cx-summary-stat--potential"><b>{partials.length}</b> קבוצה בודדת עלתה</span>
        )}
      </div>
      {determined.length > 0 && (
        <div className="cx-det-grid">
          {determined.map(it => (
            <DeterminedCard
              key={it.matchNum} item={it} me={me}
              expanded={open.has(it.matchNum)} onToggle={() => toggle(it.matchNum)}
            />
          ))}
        </div>
      )}
      {partials.length > 0 && (
        <section className="cx-sec cx-sec--partial">
          <div className="cx-sec-head">
            <span className="cx-sec-title cx-sec-title--potential">➡️ קבוצה אחת כבר עלתה</span>
            <span className="cx-sec-sub">עלו לשלב הבא — היריבה תיקבע כשהמשחק השני יוכרע</span>
          </div>
          <div className="cx-det-grid">
            {partials.map(it => (
              <DeterminedCard
                key={it.matchNum} item={it} me={me}
                expanded={open.has(it.matchNum)} onToggle={() => toggle(it.matchNum)}
              />
            ))}
          </div>
        </section>
      )}
    </>
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
  missed: Crossing[]
}

function StandingDetail({ detail, status, probByMatch }: { detail: StandingDetailData; status: WinProbStatus; probByMatch: Record<number, Record<string, number>> }) {
  const { locked, potential, missed } = detail
  // Separate live open pairings from ones the model rules out (a flat 0% once
  // ready) — the live ones rank by chance, the dead ones join the broken ones in a
  // single muted "won't happen" group so the breakdown covers every match.
  const openLive = potential.filter(c => status !== 'ready' || c.prob === null || c.prob > 0)
  const openDead = potential.filter(c => status === 'ready' && c.prob === 0)
  const gone = [...missed, ...openDead].sort((a, b) => a.matchNum - b.matchNum)
  if (locked.length + openLive.length + gone.length === 0) {
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
      {gone.length > 0 && (
        <div className="cx-board-detail-sec">
          <span className="cx-board-detail-h cx-board-detail-h--dead">לא יקרו ({gone.length})</span>
          <div className="cx-board-pairs">
            {gone.map(c => {
              const blk = c.actualTeams ? null : deadBlocker(c, crossingBreakdown(c, probByMatch))
              const tag = c.actualTeams ? 'נשברה' : blk ? `${blk} לא תגיע` : 'אין סיכוי'
              return (
                <span key={c.matchNum} className="cx-board-pair cx-board-pair--dead">
                  {teamHe(c.teams[0].team)} × {teamHe(c.teams[1].team)}
                  <span className="cx-board-pair-tag cx-board-pair-tag--dead">{tag}</span>
                </span>
              )
            })}
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
function CrossingsLeaderboard({ standings, detailByLabel, me, status, noun, probByMatch, settled = false }: {
  standings: CrossingStanding[]
  detailByLabel: Map<string, StandingDetailData>
  me?: string
  status: WinProbStatus
  noun: string
  probByMatch: Record<number, Record<string, number>>
  // The round is fully played: every pairing is decided, so the board reads as a
  // final result ("who hit the most") rather than a projection ("who will").
  settled?: boolean
}) {
  const [openLabel, setOpenLabel] = useState<string | null>(null)
  if (standings.length === 0) return null
  const ready = status === 'ready'
  const maxExpected = Math.max(...standings.map(s => s.expected), 1)

  return (
    <section className="cx-board" dir="rtl" aria-label={`דירוג ${noun}`}>
      <div className="cx-board-head">
        <h3 className="cx-board-title">
          🎯 {settled ? `מי פגע בהכי הרבה ${noun}?` : `מי יפגע בהכי הרבה ${noun}?`}
          {settled && <span className="cx-board-settled">השלב הסתיים</span>}
        </h3>
        <p className="cx-board-sub">
          {settled
            ? `הדירוג הסופי לפי מספר ה${noun} שנפגעו בשלב הזה. לחצו על שם כדי לראות אילו זוגות.`
            : `דירוג לפי מספר ה${noun} הצפוי — נעולות נספרות במלואן, והפתוחות משוקללות לפי הסיכוי שייצאו. לחצו על שם כדי לראות אילו זוגות, וכמה סיכוי לכל אחד.`}
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
                  <span className="cx-board-breakdown">{s.locked} נעולות · {s.potential} פתוחות · {s.gone} אזלו</span>
                </span>
                <span className="cx-board-exp">
                  {settled || !ready ? <b>{s.locked}</b> : <b>{s.expected.toFixed(1)}</b>}
                  <span className="cx-board-exp-label">{settled ? 'נפגעו' : ready ? 'צפויות' : 'נעולות'}</span>
                </span>
              </button>
              {isOpen && detail && <StandingDetail detail={detail} status={status} probByMatch={probByMatch} />}
            </li>
          )
        })}
      </ol>
      {!settled && !ready && status !== 'unsupported' && (
        <p className="cx-board-loading">מריצים סימולציות כדי לשקלל את ה{noun} הפתוחות…</p>
      )}
    </section>
  )
}

// One team's flag chip in a live-teams breakdown — full color when still in,
// greyed with an "הודחה" note when knocked out.
function LiveTeamChip({ team, alive }: { team: string; alive: boolean }) {
  const iso = TEAMS[team]?.iso
  return (
    <span className={`cx-live-team${alive ? '' : ' cx-live-team--out'}`}>
      {iso && <span className={`fi fi-${iso} cx-live-team-flag`} aria-hidden="true" />}
      <span>{teamHe(team)}</span>
    </span>
  )
}

// One "these two meet on the way" warning: the colliding teams and the round their
// real bracket paths cross, so only one of them can carry on to this stage.
function CollisionNote({ collision }: { collision: Collision }) {
  return (
    <div className="cx-live-clash">
      <span className="cx-live-clash-teams">
        {collision.teams.map((t, i) => (
          <span key={t}>
            {i > 0 && <span className="cx-live-clash-vs"> ✕ </span>}
            {teamHe(t)}
          </span>
        ))}
      </span>
      <span className="cx-live-clash-note">נפגשות ב{collision.roundLabel} — רק אחת תמשיך</span>
    </div>
  )
}

// Expand-on-tap breakdown of one bettor's bracket teams: which survived and which
// are out, so the headline count reads as "these exact teams". When two alive picks
// are bound to knock each other out before this stage, that clash is called out too.
function LiveTeamsDetail({ standing }: { standing: LiveTeamsStanding }) {
  return (
    <div className="cx-board-detail">
      {standing.collisions.length > 0 && (
        <div className="cx-board-detail-sec">
          <span className="cx-board-detail-h cx-board-detail-h--clash">⚠️ נפגשות בדרך</span>
          <div className="cx-live-clashes">
            {standing.collisions.map((c, i) => <CollisionNote key={i} collision={c} />)}
          </div>
        </div>
      )}
      {standing.aliveTeams.length > 0 && (
        <div className="cx-board-detail-sec">
          <span className="cx-board-detail-h cx-board-detail-h--locked">עדיין חיות ({standing.aliveTeams.length})</span>
          <div className="cx-live-teams">
            {standing.aliveTeams.map(t => <LiveTeamChip key={t} team={t} alive />)}
          </div>
        </div>
      )}
      {standing.outTeams.length > 0 && (
        <div className="cx-board-detail-sec">
          <span className="cx-board-detail-h cx-board-detail-h--out">הודחו ({standing.outTeams.length})</span>
          <div className="cx-live-teams">
            {standing.outTeams.map(t => <LiveTeamChip key={t} team={t} alive={false} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// The comparative "live teams" board, sliced by stage: how many of the teams each
// bettor sent *into the selected stage* are still in the real tournament, out of
// the number they picked for it (the final is X/2, the champion X/1). Its own
// stage chips cover every round plus the 3rd-place match and the champion, since
// those have no crossing tab of their own. Tap a row to see which teams.
function LiveTeamsBoard({ stages, defaultStageKey, me }: {
  stages: LiveStage[]
  defaultStageKey: LiveStageKey
  me?: string
}) {
  const usable = stages.filter(st => st.standings.some(s => s.total > 0))
  const fallbackKey = usable[0]?.key ?? defaultStageKey
  const initialKey = usable.some(st => st.key === defaultStageKey) ? defaultStageKey : fallbackKey
  const [stageKey, setStageKey] = useState<LiveStageKey>(initialKey)
  const [openLabel, setOpenLabel] = useState<string | null>(null)
  if (usable.length === 0) return null

  const active = usable.find(st => st.key === stageKey) ?? usable[0]
  const standings = active.standings
  const meRow = me ? standings.find(s => s.label === me) : undefined
  const beaten = meRow ? standings.filter(s => s.reachable < meRow.reachable).length : 0
  // Standard competition ranking ("1224"): an equal *reachable* count is an equal
  // placing, so tied players share a placing instead of one looking like it's
  // above the other. The within-tie order is just alphabetical for stability.
  // Only the leaders get a 🥇 — on a clustered metric medals for 2nd/3rd would
  // mean a wall of identical medals once a dozen people tie, so everyone below
  // the top placing reads their shared number.
  const ranks: number[] = []
  standings.forEach((s, i) => {
    ranks[i] = i > 0 && standings[i - 1].reachable === s.reachable ? ranks[i - 1] : i + 1
  })

  return (
    <section className="cx-board" dir="rtl" aria-label="קבוצות חיות">
      <div className="cx-board-head">
        <h3 className="cx-board-title">🛡️ קבוצות חיות</h3>
        <p className="cx-board-sub">
          כמה מהקבוצות שכל שחקן שלח ל{active.label} עדיין בטורניר, מתוך אלו שבחר לשלב הזה. לחצו על שם כדי לראות אילו.
          {meRow && meRow.total > 0 && beaten > 0 && ` יש לך ${meRow.alive} מתוך ${meRow.total} — יותר מ-${beaten} שחקנים אחרים.`}
        </p>
      </div>
      <div className="cx-live-stages" role="tablist" aria-label="שלב לקבוצות חיות">
        {usable.map(st => (
          <button
            key={st.key}
            type="button"
            role="tab"
            aria-selected={st.key === active.key}
            className={`cx-live-stage${st.key === active.key ? ' cx-live-stage--active' : ''}`}
            onClick={() => { setStageKey(st.key); setOpenLabel(null) }}
          >
            {st.label}
          </button>
        ))}
      </div>
      <ol className="cx-board-list">
        {standings.map((s, i) => {
          const isMe = s.label === me
          const isOpen = openLabel === s.label
          // Fill on what can actually still arrive (reachable), not just "not yet
          // eliminated" — so a clash bracket doesn't read as a full bar.
          const barW = s.total > 0 ? (s.reachable / s.total) * 100 : 0
          const rank = ranks[i]
          return (
            <li key={s.label} className={`cx-board-item${isOpen ? ' cx-board-item--open' : ''}`}>
              <button
                type="button"
                className={`cx-board-row${isMe ? ' cx-board-row--me' : ''}${rank === 1 ? ' cx-board-row--rank-1' : ''}`}
                onClick={() => setOpenLabel(isOpen ? null : s.label)}
                aria-expanded={isOpen}
              >
                <span className="cx-board-rank">{rank === 1 ? MEDALS[0] : rank}</span>
                <span className="cx-board-name">
                  {s.label}
                  {isMe && <span className="cx-board-mebadge">אתה</span>}
                  <span className="cx-board-chevron" aria-hidden="true">{isOpen ? '⌃' : '⌄'}</span>
                </span>
                <span className="cx-board-bar-wrap">
                  <span className="cx-board-bar" style={{ width: `${barW.toFixed(1)}%` }} />
                  <span className="cx-board-breakdown">
                    {s.alive} חיות · {s.total - s.alive} הודחו
                    {s.reachable < s.alive && <span className="cx-board-clash"> · ⚠️ {s.alive - s.reachable} נפגשות</span>}
                  </span>
                </span>
                <span className="cx-board-exp">
                  <b>{s.alive}/{s.total}</b>
                  <span className="cx-board-exp-label">חיות</span>
                  {s.reachable < s.alive && <span className="cx-board-exp-sub">עד {s.reachable} יגיעו</span>}
                </span>
              </button>
              {isOpen && <LiveTeamsDetail standing={s} />}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

// The tab key of the tournament-wide summary board — a peer of the round tabs, but
// not a round of its own (it sums across all of them).
export const SUMMARY_KEY = 'summary'

// The stage switcher. Same principle, every knockout round — tap to move from the
// round of 32 onward to the final, plus a final "סיכום" tab for the field-wide
// involvement board. Rendered only when the container wires up a handler (so the
// test harness can drive CrossingsList without tabs).
function RoundTabs({ activeKey, onRoundChange }: { activeKey: string; onRoundChange: (key: string) => void }) {
  return (
    <div className="cx-rounds" role="tablist" aria-label="שלב נוקאאוט">
      {ROUNDS.map(r => (
        <button
          key={r.key}
          type="button"
          role="tab"
          aria-selected={r.key === activeKey}
          className={`cx-round-tab${r.key === activeKey ? ' cx-round-tab--active' : ''}`}
          onClick={() => onRoundChange(r.key)}
        >
          {r.tab}
        </button>
      ))}
      <button
        type="button"
        role="tab"
        aria-selected={SUMMARY_KEY === activeKey}
        className={`cx-round-tab cx-round-tab--summary${SUMMARY_KEY === activeKey ? ' cx-round-tab--active' : ''}`}
        onClick={() => onRoundChange(SUMMARY_KEY)}
      >
        סיכום
      </button>
    </div>
  )
}

// Short Hebrew name for each knockout stage in the summary detail, taken from the
// round tabs so the two never drift. (Every SUMMARY_ROUNDS key has a ROUNDS entry.)
const STAGE_TAB_BY_KEY: Record<string, string> = Object.fromEntries(ROUNDS.map(r => [r.key, r.tab]))

// The three participation buckets, in bracket order of certainty: a crossing is
// first played, else guaranteed to be played, else merely possible. Each carries a
// fixed icon + color so it reads without decoding the palette, and a machine field
// so the aligned columns below can pull them by name.
const BUCKETS = [
  { field: 'played',     icon: '⚽', label: 'כבר שוחקו',   short: 'שוחקו',   cls: 'done' },
  { field: 'guaranteed', icon: '🔒', label: 'מובטחות',     short: 'מובטחות', cls: 'sure' },
  { field: 'possible',   icon: '⏳', label: 'עוד אפשריות', short: 'אפשריות', cls: 'maybe' },
] as const

// The color legend, shown once atop the board so the icons/colors used in every row
// and stage line are decoded in one place.
function SummaryLegend() {
  return (
    <div className="cx-sum-legend" aria-hidden="true">
      {BUCKETS.map(b => (
        <span key={b.field} className={`cx-sum-legend-item cx-sum-stat--${b.cls}`}>
          <span className="cx-sum-dot" />
          {b.icon} {b.label}
        </span>
      ))}
    </div>
  )
}

// The three participation buckets as an aligned, icon-tagged trio — one fixed cell
// per bucket so counts line up column-for-column between the headline totals and
// every stage line beneath. `labelled` prints the bucket word (the row headline,
// which also feeds the legend text); the stage lines drop the word since the shared
// header row above them names the columns. A zero is dimmed so real counts stand out.
function SummaryBuckets({ buckets, labelled = false }: { buckets: CrossingBuckets; labelled?: boolean }) {
  return (
    <span className={`cx-sum-stats${labelled ? ' cx-sum-stats--labelled' : ''}`}>
      {BUCKETS.map(b => {
        const n = buckets[b.field]
        return (
          <span key={b.field} className={`cx-sum-stat cx-sum-stat--${b.cls}${n === 0 ? ' cx-sum-stat--zero' : ''}`}>
            <span className="cx-sum-ico" aria-hidden="true">{b.icon}</span>
            <b>{n}</b>
            {labelled && <span className="cx-sum-word"> {b.label}</span>}
          </span>
        )
      })}
    </span>
  )
}

// The per-stage split a summary row expands to: a labeled column header, then one
// aligned line per knockout stage the bettor is involved in, in bracket order. The
// header + the shared column grid mean every number sits directly under the bucket
// it belongs to, so no count is ever ambiguous.
function SummaryStageDetail({ byStage }: { byStage: CrossingSummaryStage[] }) {
  if (byStage.length === 0) {
    return <div className="cx-board-detail cx-board-detail--empty">אין לשחקן הזה הצלבות כרגע.</div>
  }
  return (
    <div className="cx-board-detail cx-sum-detail">
      <div className="cx-sum-detail-row cx-sum-detail-head">
        <span className="cx-sum-detail-stage">שלב</span>
        <span className="cx-sum-stats">
          {BUCKETS.map(b => (
            <span key={b.field} className={`cx-sum-colhead cx-sum-stat--${b.cls}`}>
              <span className="cx-sum-ico" aria-hidden="true">{b.icon}</span>
              {b.short}
            </span>
          ))}
        </span>
      </div>
      {byStage.map(st => (
        <div key={st.key} className="cx-sum-detail-row">
          <span className="cx-sum-detail-stage">{STAGE_TAB_BY_KEY[st.key] ?? st.key}</span>
          <SummaryBuckets buckets={st} />
        </div>
      ))}
    </div>
  )
}

// The field-wide involvement board: every bettor's crossings summed across all
// knockout rounds, split into already-played, still-guaranteed, and still-possible.
// Answers "how deep is each player's bet riding on the bracket" in one glance —
// something the per-round tabs can't show. Ranked by guaranteed involvement; tap a
// row to break the same three numbers down by stage.
function SummaryBoard({ standings, me }: { standings: CrossingSummaryStanding[]; me?: string }) {
  const [openLabel, setOpenLabel] = useState<string | null>(null)
  if (standings.length === 0) return null
  return (
    <section className="cx-board" dir="rtl" aria-label="סיכום השתתפות בהצלבות">
      <div className="cx-board-head">
        <h3 className="cx-board-title">📊 השתתפות בהצלבות</h3>
        <p className="cx-board-sub">
          כמה משחקי הצלבה כל שחקן כבר שיחק, בכמה עוד ישחק בוודאות, ובכמה עוד עשוי — לאורך כל שלבי הנוקאאוט.
          לחצו על שם כדי לפרק לפי שלב.
        </p>
        <SummaryLegend />
      </div>
      <ol className="cx-board-list">
        {standings.map((s, i) => {
          const isMe = s.label === me
          const isOpen = openLabel === s.label
          return (
            <li key={s.label} className={`cx-board-item${isOpen ? ' cx-board-item--open' : ''}`}>
              <button
                type="button"
                className={`cx-board-row cx-sum-row${isMe ? ' cx-board-row--me' : ''}${i < 3 ? ` cx-board-row--rank-${i + 1}` : ''}`}
                onClick={() => setOpenLabel(isOpen ? null : s.label)}
                aria-expanded={isOpen}
              >
                <span className="cx-board-rank">{i < 3 ? MEDALS[i] : i + 1}</span>
                <span className="cx-board-name">
                  {s.label}
                  {isMe && <span className="cx-board-mebadge">אתה</span>}
                  <span className="cx-board-chevron" aria-hidden="true">{isOpen ? '⌃' : '⌄'}</span>
                </span>
                <SummaryBuckets buckets={summaryTotals(s)} labelled />
              </button>
              {isOpen && <SummaryStageDetail byStage={s.byStage} />}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

// Presentational body of the crossings view — the stage switcher, the viewer's own
// pairings for the selected round, and the field-wide standing. Exported so tests
// can drive it without the Monte-Carlo worker (pass an empty probByMatch /
// 'unsupported' status). `round` defaults to the round of 32.
export function CrossingsList({ user, users, round = ROUNDS[0], activeKey, onRoundChange, actualMatches, actualScoreByNum = {}, probByMatch, probStatus, liveStages = [], summaryStandings = [] }: {
  user?: User
  users: User[]
  round?: RoundCfg
  // Which tab is selected: a round key, or SUMMARY_KEY for the field-wide board.
  // Defaults to the passed round so existing per-round callers need not set it.
  activeKey?: string
  onRoundChange?: (key: string) => void
  actualMatches: KnockoutMatch[]
  // Real, played scorelines keyed by match number — used to render finished
  // crossings as final results. Empty in tests that don't exercise finished cards.
  actualScoreByNum?: Record<number, MatchScores>
  probByMatch: Record<number, Record<string, number>>
  probStatus: WinProbStatus
  liveStages?: LiveStage[]
  // Field-wide involvement rows for the summary tab (computed in the container from
  // the full bracket, since it spans every round). Empty off the summary tab.
  summaryStandings?: CrossingSummaryStanding[]
}) {
  const selectedKey = activeKey ?? round.key
  // 'mine' = the viewer's own crossings (default); 'all' = the shared board of every
  // determined pairing and who called it.
  const [view, setView] = useState<'mine' | 'all'>('mine')
  // Finished matches are settled history, so they load collapsed — the live/open
  // crossings stay front and center. Tap the header to reveal the result cards.
  const [finishedOpen, setFinishedOpen] = useState(false)
  const [openMates, setOpenMates] = useState<Set<number>>(new Set())
  const toggleMates = (matchNum: number) =>
    setOpenMates(prev => {
      const next = new Set(prev)
      if (next.has(matchNum)) next.delete(matchNum)
      else next.add(matchNum)
      return next
    })

  // Feed the simulation in only once it's ready, so a 100%-certain matchup counts as
  // locked everywhere — your pairings, the standing, and the board — and never on
  // half-baked counts. One rule, applied at the source (computeUserCrossings).
  const liveProb = useMemo(() => (probStatus === 'ready' ? probByMatch : {}), [probStatus, probByMatch])
  const crossings = useMemo(
    () => (user ? computeUserCrossings(user.knockoutStages?.[round.key] ?? [], actualMatches, liveProb, actualScoreByNum) : null),
    [user, round.key, actualMatches, liveProb, actualScoreByNum],
  )
  const standings = useMemo(
    () => computeCrossingsLeaderboard(users, round.key, actualMatches, liveProb),
    [users, round.key, actualMatches, liveProb],
  )
  // Per-bettor breakdown for the expand-on-tap detail in the standing: their
  // locked pairs and open pairs (each with its simulated chance attached).
  const detailByLabel = useMemo(() => {
    const map = new Map<string, StandingDetailData>()
    for (const u of users) {
      const { locked, potential, missed } = computeUserCrossings(u.knockoutStages?.[round.key] ?? [], actualMatches, liveProb)
      map.set(u.label, {
        locked,
        potential: potential.map(c => ({ ...c, prob: crossingProbability(c, probByMatch) })),
        missed,
      })
    }
    return map
  }, [users, round.key, actualMatches, probByMatch, liveProb])

  // Same rule for the shared board: a 100%-certain matchup is a closed match even
  // before its bracket slot is formally filled.
  const determined = useMemo(
    () => computeDeterminedCrossings(users, actualMatches, liveProb, actualScoreByNum),
    [users, actualMatches, liveProb, actualScoreByNum],
  )

  const tabs = onRoundChange && <RoundTabs activeKey={selectedKey} onRoundChange={onRoundChange} />

  // The summary tab is field-wide, not a round: skip the per-round machinery and the
  // mine/all mode toggle, and just show the involvement board.
  if (selectedKey === SUMMARY_KEY) {
    return (
      <div className="cx-view" dir="rtl">
        {tabs}
        <SummaryBoard standings={summaryStandings} me={user?.label} />
      </div>
    )
  }

  const modeToggle = (
    <div className="cx-modes" role="tablist" aria-label="תצוגת הצלבות">
      <button
        type="button" role="tab" aria-selected={view === 'mine'}
        className={`cx-mode${view === 'mine' ? ' cx-mode--active' : ''}`}
        onClick={() => setView('mine')}
      >
        ההצלבות שלי
      </button>
      <button
        type="button" role="tab" aria-selected={view === 'all'}
        className={`cx-mode${view === 'all' ? ' cx-mode--active' : ''}`}
        onClick={() => setView('all')}
      >
        מי ניחש מה
      </button>
    </div>
  )

  if (view === 'all') {
    return (
      <div className="cx-view" dir="rtl">
        {tabs}
        {modeToggle}
        <DeterminedBoard items={determined} round={round} me={user?.label} />
        <LiveTeamsBoard stages={liveStages} defaultStageKey={round.key} me={user?.label} />
      </div>
    )
  }

  if (!crossings) {
    return (
      <div className="cx-view cx-view--empty" dir="rtl">
        {tabs}
        {modeToggle}
        <div className="cx-empty-icon">🔀</div>
        <p className="cx-empty-text">בחרו שחקן למעלה כדי לראות את הזוגות שלכם</p>
      </div>
    )
  }

  const { locked, potential, missed } = crossings
  // A locked crossing whose match has actually been played reads as a finished
  // result (its own section); the rest stay in "נעולות" as sealed-but-unplayed.
  const finished = locked.filter(c => c.result)
  const stillLocked = locked.filter(c => !c.result)
  const matesFor = (c: Crossing) =>
    crossingParticipants(users, c.matchNum, c.teams[0].team, c.teams[1].team, user?.label)

  // Certain pairings are already folded into `locked` by computeUserCrossings, so
  // here we only split the still-open ones into ones the sim gives a chance and ones
  // it flatly rules out (0% once ready). The dead ones get their own section so the
  // picture is complete, without polluting "פתוחות" with confusing 0% chances.
  const potentialWithProb = potential.map(c => ({ c, prob: crossingProbability(c, probByMatch) }))
  const livePotential = potentialWithProb.filter(p => probStatus !== 'ready' || p.prob === null || p.prob > 0)
  const deadPotential = potentialWithProb.filter(p => probStatus === 'ready' && p.prob === 0)
  // Once we have probabilities, lead with the best chance. While they're still
  // computing we keep the most-resolved-first order computeUserCrossings gave us.
  if (probStatus === 'ready') {
    livePotential.sort((a, b) => (b.prob ?? 0) - (a.prob ?? 0) || a.c.matchNum - b.c.matchNum)
  }

  // "Won't happen" = pairings the model rules out (0%) plus ones already broken by
  // a team the bettor didn't pick. Same message either way, so they share one
  // category; each card still spells out its own reason.
  const gone = deadPotential.length + missed.length

  // locked + live + gone accounts for every match in the round.
  const hasCrossings = locked.length + potential.length + missed.length > 0

  // The round is fully played when every one of its slots has a real scoreline —
  // then the standing reads as a final result, not a projection.
  const roundTotal = round.hi - round.lo + 1
  const playedInRound = Object.keys(actualScoreByNum)
    .filter(n => Number(n) >= round.lo && Number(n) <= round.hi).length
  const roundSettled = playedInRound === roundTotal

  return (
    <div className="cx-view" dir="rtl">
      {tabs}
      {modeToggle}
      {hasCrossings ? (
        <>
          <p className="cx-caption">
            ה{round.noun} של {round.label} שניחשת — אילו זוגות כבר נסגרו לטובתך, ובאילו עוד אפשר לפגוע (עם סיכוי משוער שיֵצאו).
          </p>
          <p className="cx-scoring-note">
            ניקוד {round.label}: פגיעה בתוצאה {roundPoints(round.key).pagiya} נק׳ · צליפה מדויקת {roundPoints(round.key).tzelifa} נק׳ · אם לא פגעת — 0.
          </p>

          <div className="cx-summary">
            {finished.length > 0 && (
              <span className="cx-summary-stat cx-summary-stat--finished"><b>{finished.length}</b> הסתיימו</span>
            )}
            <span className="cx-summary-stat cx-summary-stat--locked"><b>{stillLocked.length}</b> נעולות</span>
            <span className="cx-summary-stat cx-summary-stat--potential"><b>{livePotential.length}</b> בפוטנציאל</span>
            {gone > 0 && (
              <span className="cx-summary-stat cx-summary-stat--dead"><b>{gone}</b> לא יקרו</span>
            )}
          </div>

          {finished.length > 0 && (
            <section className="cx-sec">
              <button
                type="button"
                className="cx-sec-head cx-sec-head--toggle"
                onClick={() => setFinishedOpen(o => !o)}
                aria-expanded={finishedOpen}
              >
                <span className="cx-sec-title cx-sec-title--finished">
                  🏁 הסתיימו ({finished.length})
                  <span className="cx-sec-chevron" aria-hidden="true">{finishedOpen ? '⌃' : '⌄'}</span>
                </span>
                <span className="cx-sec-sub">
                  {finishedOpen ? 'המשחק כבר שוחק — התוצאה האמיתית, מי עלתה, והניחוש שלך מולה' : 'משחקים שכבר הסתיימו — לחצו כדי לפתוח'}
                </span>
              </button>
              {finishedOpen && (
                <div className="cx-cards">
                  {finished.map(c => (
                    <FinishedCard
                      key={c.matchNum} crossing={c}
                      mates={matesFor(c)} expanded={openMates.has(c.matchNum)} onToggle={() => toggleMates(c.matchNum)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {stillLocked.length > 0 && (
            <section className="cx-sec">
              <div className="cx-sec-head">
                <span className="cx-sec-title cx-sec-title--locked">✓ נעולות</span>
                <span className="cx-sec-sub">המפגש כבר סגור — מכאן אפשר לצבור עליו ניקוד</span>
              </div>
              <div className="cx-cards">
                {stillLocked.map(c => (
                  <CrossingCard
                    key={c.matchNum} crossing={c} locked certain={c.certain} prob={null} status={probStatus}
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
                    prob={prob} breakdown={crossingBreakdown(c, probByMatch)} status={probStatus}
                    mates={matesFor(c)} expanded={openMates.has(c.matchNum)} onToggle={() => toggleMates(c.matchNum)}
                  />
                ))}
              </div>
            </section>
          )}

          {gone > 0 && (
            <section className="cx-sec">
              <div className="cx-sec-head">
                <span className="cx-sec-title cx-sec-title--dead">❌ לא יקרו</span>
                <span className="cx-sec-sub">נכנסה קבוצה אחרת, או שאין כבר סיכוי שהזוג ייפגש — לא ייתן נקודות</span>
              </div>
              <div className="cx-cards">
                {missed.map(c => (
                  <CrossingCard
                    key={c.matchNum} crossing={c} locked={false} missed prob={null} status={probStatus}
                    mates={matesFor(c)} expanded={openMates.has(c.matchNum)} onToggle={() => toggleMates(c.matchNum)}
                  />
                ))}
                {deadPotential.map(({ c }) => (
                  <CrossingCard
                    key={c.matchNum} crossing={c} locked={false} ruledOut prob={0}
                    breakdown={crossingBreakdown(c, probByMatch)} status={probStatus}
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

      <CrossingsLeaderboard standings={standings} detailByLabel={detailByLabel} me={user?.label} status={probStatus} noun={round.noun} probByMatch={probByMatch} settled={roundSettled} />
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
  // Open on the earliest stage still in play (round of 32 while it's live, the
  // round of 16 once it's done, and so on) so the view tracks the tournament's
  // progress rather than parking on the settled round of 32.
  const [roundKey, setRoundKey] = useState<string>(() => defaultCrossingsRound(results.knockoutStages))
  const round = ROUNDS.find(r => r.key === roundKey) ?? ROUNDS[0]
  const played = useMemo(() => realPlayedState(results), [results])
  const bracket = useMemo(() => buildKnockoutBracket(played), [played])
  const actualMatches = useMemo(
    () => bracket.filter(m => m.matchNum >= round.lo && m.matchNum <= round.hi),
    [bracket, round.lo, round.hi],
  )
  // Real played scorelines keyed by match number, pulled from the same played-state
  // the bracket is built from (knockout entries there are keyed by matchNum string).
  const actualScoreByNum = useMemo(() => {
    const map: Record<number, MatchScores> = {}
    for (const [k, v] of Object.entries(played)) {
      const n = Number(k)
      if (Number.isInteger(n) && v && !isUnpredicted(v)) map[n] = v
    }
    return map
  }, [played])
  // Golden-boot goals don't affect the bracket pairings, so passing them is only
  // about sharing the win-prob cache; the empty default keeps it simple.
  const { status, crossingProbByMatch } = useWinProbabilities(played, results.playerGoals ?? {})

  // Comparative "how many of my teams are still alive" — per stage, referenced to
  // each player's own form for that stage, so a count is "alive out of the teams I
  // sent here". Driven by real results, so the same picture regardless of probs.
  const liveStages = useMemo(() => buildLiveStages(users, results, bracket), [users, results, bracket])

  // Field-wide crossings involvement, summed across every round for the summary tab.
  // Only feed the sim in once ready, so a near-certain pairing counts as locked
  // consistently with the per-round view (computeUserCrossings' certain-promotion).
  const liveProb = useMemo(() => (status === 'ready' ? crossingProbByMatch : {}), [status, crossingProbByMatch])
  const summaryStandings = useMemo(
    () => rankedCrossingsSummary(computeCrossingsSummary(users, bracket, liveProb, actualScoreByNum)),
    [users, bracket, liveProb, actualScoreByNum],
  )

  return (
    <CrossingsList
      user={user}
      users={users}
      round={round}
      activeKey={roundKey}
      onRoundChange={setRoundKey}
      actualMatches={actualMatches}
      actualScoreByNum={actualScoreByNum}
      probByMatch={crossingProbByMatch}
      probStatus={status}
      liveStages={liveStages}
      summaryStandings={summaryStandings}
    />
  )
}
