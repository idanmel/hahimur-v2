import { Fragment, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { PredictionsState, TournamentResults } from '../../shared/types'
import type { Row, AdvancementSummary, StageReach } from '../../../sim-core'
import { realEliminations, effectiveEliminations, advancementSummaryForLabel } from '../../../sim-core'
import type { User } from '../../users'
import { TEAMS } from '../../shared/groups'
import { SCORERS } from '../../../golden-boot'
import { computeUserCrossings, crossingProbability } from '../crossings'
import { playedChrono, playedStateUpTo, winProbMatchLabel } from './realPlayed'
import { playedMatchId } from '../leaderboardRows'
import { useWinProbabilities } from './useWinProbabilities'
import { usePivotalMatches } from './usePivotalMatches'
import { pickPivotal, type PivotalCard, type PivotalMetric, type PivotalOutcome } from './pivotalPick'
import { fmtPct, buildBettorHeadline, buildStageForecast, stageForecastTotalEdge, buildBestCase } from './summaryText'
import type { BettorHeadline, HeadlineSubject, CrossingsDigest, GoldenBootDigest, StagePhase, StageForecastRow, BestCaseDigest } from './summaryText'

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

// Inline emphasis for the dense personal-read lines: the figures that carry the
// meaning — percentages, point totals, and the ± gaps vs the field — are bolded, and a
// signed gap is tinted green (advantage) or red (deficit) so it reads at a glance. The
// text builders stay pure strings (unit-tested); the highlighting lives only here, at
// render time, by wrapping matched number tokens. Order in the alternation matters:
// "<0.1%" and percentages before the points/paren forms so they win the match.
// A leading ±sign on a points token only counts when it isn't glued to a letter, so the
// hyphen in the Hebrew prefix "כ-" (≈, as in "כ-402 נק׳") is NOT read as a red minus.
const HL_TOKEN = /(<0\.1%|\d+(?:\.\d+)?%|(?<!\p{L})[+\-−]?\d+ נק׳|\([+\-−]\d+\))/gu
function tokenClass(tok: string): string {
  const t = tok.replace(/^\(/, '')
  if (t.startsWith('+')) return 'wp-hl wp-hl--up'
  if (t.startsWith('−') || t.startsWith('-')) return 'wp-hl wp-hl--down'
  return 'wp-hl'
}
function emphasize(text: string): ReactNode {
  // String.split with a capturing group interleaves plain text (even indices) and the
  // captured number tokens (odd indices).
  return text.split(HL_TOKEN).map((part, i) =>
    i % 2 === 1
      ? <b key={i} className={tokenClass(part)}>{part}</b>
      : <Fragment key={i}>{part}</Fragment>,
  )
}

const PHASE_TAG: Record<StagePhase, string> = { done: 'סוכם', live: 'בעיצומו', upcoming: 'תחזית' }

const edgeCls = (edge: number) => (edge > 0.5 ? 'pos' : edge < -0.5 ? 'neg' : 'mid')
// A signed gap, but a rounded-to-zero gap reads as a plain "0" (no misleading "+0").
const fmtEdge = (edge: number) => (edge > 0 ? `+${edge}` : edge < 0 ? `−${Math.abs(edge)}` : '0')

// The golden-boot slice of the forecast. Unlike the knockout rounds, its +10 bonus is an
// *absolute* race outcome — the pick topping or tying the scoring chart — not a ranking
// against the other bettors, so it carries the win/share odds and current goals.
interface GoldenBootForecast {
  scorerHe: string
  goals: number
  bootPct: number
  alive: boolean
  mine: number
  field: number
  edge: number
  phase: StagePhase
}

interface ForecastData {
  stages: StageForecastRow[]
  goldenBoot: GoldenBootForecast | null
}

// A single edge row (round or slice): the label + phase tag, the signed gap as a
// diverging bar scaled to the section's largest gap, and the points vs the field.
// A settled round shows banked points as a flat number; an undecided one shows a
// probability-weighted average ("כ-6 נק׳ בממוצע") — in any single reality you either
// score the chunk or nothing, but averaged over the sims it lands on a fraction.
function ForecastEdgeRow({ label, phase, edge, mine, field, maxAbs, extra }: {
  label: ReactNode; phase: StagePhase; edge: number; mine: number; field: number; maxAbs: number; extra?: ReactNode
}) {
  const cls = edgeCls(edge)
  const settled = phase === 'done'
  return (
    <li className="wp-fc-row">
      <div className="wp-fc-top">
        <span className="wp-fc-name">{label}<em className={`wp-fc-tag wp-fc-tag--${phase}`}>{PHASE_TAG[phase]}</em></span>
        <span className={`wp-fc-edge wp-fc-edge--${cls}`}>{fmtEdge(edge)}</span>
      </div>
      <div className="wp-fc-track">
        <div className={`wp-fc-fill wp-fc-fill--${cls}`} style={{ width: `${((Math.abs(edge) / maxAbs) * 100).toFixed(0)}%` }} />
      </div>
      <div className="wp-fc-val">
        {settled ? <><b>{mine}</b> נק׳</> : <>כ-<b>{mine}</b> נק׳ בממוצע</>}
        {' '}<span className="wp-fc-field">(שדה {field})</span>{extra}
      </div>
    </li>
  )
}

// גזרת התחזית — the breakdown that unpacks the win-% and expected place into concrete
// points, one slice at a time: each knockout round, then the golden boot. For each it
// shows the bettor's projected (or banked, once decided) points vs the field, the signed
// gap as a diverging bar, and a phase tag so a finished round reads as a settled summary
// and a coming one as a live forecast. The golden-boot slice adds its win/share odds and
// a note that its +10 is an absolute race outcome, not a duel with the other bettors.
function StageForecast({ rows, goldenBoot }: { rows: StageForecastRow[]; goldenBoot: GoldenBootForecast | null }) {
  if (!rows.length) return null
  const maxAbs = Math.max(...rows.map(s => Math.abs(s.edge)), goldenBoot ? Math.abs(goldenBoot.edge) : 0, 1)
  const total = stageForecastTotalEdge(rows)
  const totalCls = total > 0 ? 'pos' : total < 0 ? 'neg' : 'mid'
  return (
    <div className="wp-fc" dir="rtl">
      <div className="wp-fc-head">
        <span className="wp-fc-title">גזרת התחזית — נקודות לפי גזרה</span>
        <span className="wp-fc-sub">הבחירות שלך בכל גזרה מול ממוצע המהמרים. «סוכם» = כבר נסגר; «תחזית» = <b>ממוצע על פני אלפי סימולציות</b> (לא סכום מובטח — ברוב התרחישים 0, ובאלו שהבחירה מצליחה קופץ גבוה).</span>
      </div>
      <ul className="wp-fc-list">
        {rows.map(s => (
          <ForecastEdgeRow key={s.key} label={s.label} phase={s.phase} edge={s.edge} mine={s.mine} field={s.field} maxAbs={maxAbs} />
        ))}
      </ul>
      <div className={`wp-fc-total wp-fc-total--${totalCls}`}>
        יתרון נוקאאוט מצטבר מול השדה: <b>{total >= 0 ? '+' : '−'}{Math.abs(total)} נק׳</b>
      </div>
      {goldenBoot && (
        <div className="wp-fc-gb">
          <ul className="wp-fc-list wp-fc-list--single">
            <ForecastEdgeRow
              label={<>נעל זהב · {goldenBoot.scorerHe}</>}
              phase={goldenBoot.phase}
              edge={goldenBoot.edge}
              mine={goldenBoot.mine}
              field={goldenBoot.field}
              maxAbs={maxAbs}
              extra={<> · {goldenBoot.goals} שערים עד כה · סיכוי לנעל: <b>{goldenBoot.bootPct}%</b>{!goldenBoot.alive && <> · הקבוצה הודחה</>}</>}
            />
          </ul>
        </div>
      )}
    </div>
  )
}

// התרחיש האופטימלי — one *coherent*, forward-looking dream run, lifted straight from the
// sim: the single highest-scoring simulated bracket in which the bettor landed at their
// realistic ceiling place, restricted to picks still in play (settled ones — already out
// or already at their backed depth — are filtered out in buildRows, so the scenario
// shrinks as the tournament progresses). Because it's one real tournament, the picks'
// fates can't contradict each other — if two of the bettor's teams meet, only the winner
// advances, so the list can never show "Spain to the semis AND Portugal to the quarters"
// when the draw pits them in the round of 16. Each row is what happens to that pick in the
// remaining games (✓ reaches its backed depth, ✕ stopped earlier — often by another of the
// bettor's own teams); the payoff is that same tournament's place + points.
function BestCase({ bc }: { bc: BestCaseDigest }) {
  // "אפסי" only fits a truly tiny chance; a mid-single-digit peak reads as "קלוש".
  const peakOdds = bc.peakPct < 1 ? 'בסיכוי אפסי' : 'בסיכוי קלוש'
  return (
    <div className="wp-best" dir="rtl">
      <div className="wp-best-head">
        <span className="wp-best-title">התרחיש האופטימלי שלך</span>
        <span className="wp-best-sub">מה עוד צריך לקרות במשחקים שנותרו כדי שתטפס הכי גבוה — גורל אחד קוהרנטי מתוך הסימולציות (מתעדכן ככל שהטורניר מתקדם):</span>
      </div>
      <ul className="wp-best-list">
        {bc.lines.map((line, i) => (
          <li key={i} className={`wp-best-row${line.hit ? '' : ' wp-best-row--miss'}`}>
            <span className="wp-best-mark">{line.hit ? '✓' : '✕'}</span>
            <span className="wp-best-need"><b>{line.teamHe}</b> {line.reachedLabel}</span>
          </li>
        ))}
        {bc.third && (
          <li className={`wp-best-row${bc.third.won ? '' : ' wp-best-row--miss'}`}>
            <span className="wp-best-mark">{bc.third.won ? '✓' : '✕'}</span>
            <span className="wp-best-need"><b>{bc.third.teamHe}</b> {bc.third.won ? 'תזכה במשחק המקום השלישי' : 'לא תזכה במשחק המקום השלישי'}</span>
          </li>
        )}
        {bc.boot && (
          <li className={`wp-best-row${bc.boot.won ? '' : ' wp-best-row--miss'}`}>
            <span className="wp-best-mark">{bc.boot.won ? '✓' : '✕'}</span>
            <span className="wp-best-need"><b>{bc.boot.scorerHe}</b> {bc.boot.won ? 'יזכה בנעל הזהב' : 'לא יזכה בנעל הזהב'}</span>
          </li>
        )}
      </ul>
      <div className="wp-best-payoff">
        בתרחיש הזה אתה מסיים <b>מקום {bc.rank}</b> עם כ-<b>{bc.pts}</b> נק׳ — תרחיש כזה או טוב יותר קורה בכ-<b>{fmtPct(bc.rankPct)}</b> מהסימולציות.
        {bc.peak < bc.rank && (
          <> · בשיא התיאורטי אפשר עד <b>מקום {bc.peak}</b>, אך {peakOdds} ({fmtPct(bc.peakPct)}).</>
        )}
      </div>
    </div>
  )
}

// The shared body of a bettor's personal read: the standing paragraph, the best-case
// route, then the labelled storyline lines. Rendered identically at the top of the page
// and inside any row's expand-on-tap detail, so the two never drift apart.
function HeadlineBody({ h, knockoutsStarted, forecast, bestCase, pivotal }: { h: BettorHeadline; knockoutsStarted: boolean; forecast: ForecastData; bestCase: BestCaseDigest | null; pivotal?: ReactNode }) {
  return (
    <>
      <p className="wp-me-standing">{emphasize(h.standing)}</p>
      {bestCase && <BestCase bc={bestCase} />}
      <ul className="wp-me-lines">
        {h.route && <li><span className="wp-me-label">המסלול של {h.route.teamHe}</span><span>{emphasize(h.route.ladder)}</span></li>}
        {h.bigBets && <li><span className="wp-me-label">עוד קלפים גדולים</span><span>{emphasize(h.bigBets)}</span></li>}
        {h.remaining && <li><span className="wp-me-label">פוטנציאל בהמשך</span><span>{emphasize(h.remaining)}</span></li>}
        {h.advancers && <li><span className="wp-me-label">עולות</span><span>{emphasize(h.advancers)}</span></li>}
        {h.crossings && <li><span className="wp-me-label">הצלבות R32</span><span>{emphasize(h.crossings)}</span></li>}
        {h.eliminated && <li><span className="wp-me-label">{knockoutsStarted ? 'נפלו בנוקאאוט' : 'הודחו'}</span><span className="wp-elim">{h.eliminated}</span></li>}
      </ul>
      {pivotal}
      <StageForecast rows={forecast.stages} goldenBoot={forecast.goldenBoot} />
    </>
  )
}

// מה אם — the viewer's real decision point(s): the current-round fixture(s) whose
// outcome most swings their finish, each shown as a two-way fork with the odds on
// either result. Answers "which game should I actually sweat?" without making them
// open every match page. Renders nothing until the (worker-computed) picks arrive.
function WhatIfFork({ o, dir, lead }: { o: PivotalOutcome; dir: 'up' | 'down'; lead: PivotalMetric }) {
  // Lead with the race the viewer sweats (bold), but always name both finishes so
  // reaching the top 5 is shown next to the win, whichever one is the headline.
  const top5 = <>טופ 5 {lead === 'podium' ? <b>{fmtPct(o.podiumPct)}</b> : fmtPct(o.podiumPct)}</>
  const win = <>זכייה {lead === 'win' ? <b>{fmtPct(o.winPct)}</b> : fmtPct(o.winPct)}</>
  // RTL line: the arrow reads in the flow direction (right→left), pointing from the
  // condition ("X advances") to the resulting odds. A '→' glyph points backwards here.
  return (
    <span className={`wp-whatif-fork wp-whatif-fork--${dir}`}>
      {o.teamHe} עולה ← {lead === 'win' ? <>{win} · {top5}</> : <>{top5} · {win}</>}
    </span>
  )
}

function WhatIf({ cards, metric }: { cards: PivotalCard[]; metric: PivotalMetric }) {
  if (!cards.length) return null
  const plural = cards.length > 1
  return (
    <div className="wp-whatif" dir="rtl">
      <div className="wp-whatif-head">
        <span className="wp-whatif-title">מה אם — רגע ההכרעה שלך</span>
        <span className="wp-whatif-sub">{plural ? 'המשחקים שהכי מזיזים' : 'המשחק שהכי מזיז'} את הסיכוי שלך — לכל תרחיש, טופ 5 וזכייה:</span>
      </div>
      <ul className="wp-whatif-list">
        {cards.map(c => (
          <li key={c.matchNum} className="wp-whatif-row">
            <span className="wp-whatif-match">{c.aHe}–{c.bHe}</span>
            <span className="wp-whatif-forks">
              <WhatIfFork o={c.better} dir="up" lead={metric} />
              <WhatIfFork o={c.worse} dir="down" lead={metric} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Tap-to-open personal read for one bettor — the very same synthesis shown in the
// featured card up top, just for the clicked row (named, third person; or "אתה"
// when it's the viewer's own row).
function RowDetail({ row, advancement, stageReach, totalPlayers, isMe, crossings, goldenBoot, knockoutsStarted, forecast }: {
  row: Row; advancement?: AdvancementSummary | null; stageReach: Record<string, StageReach>; totalPlayers: number; isMe: boolean
  crossings: CrossingsDigest | null; goldenBoot: GoldenBootDigest | null
  knockoutsStarted: boolean; forecast: ForecastData
}) {
  const firstName = row.label.split(' ')[0]
  const subject: HeadlineSubject = isMe ? { self: true, firstName } : { self: false, name: row.label }
  const stagePhases = Object.fromEntries(forecast.stages.map(s => [s.key, s.phase]))
  const h = buildBettorHeadline(row, advancement ?? null, stageReach, totalPlayers, subject, crossings, goldenBoot, knockoutsStarted, stagePhases)
  const bestCase = buildBestCase(row)
  return (
    <div className="wp-detail-card" dir="rtl">
      <h4 className="wp-me-title wp-detail-title">{isMe ? `ההימור שלך, ${firstName}` : `ההימור של ${row.label}`}</h4>
      <HeadlineBody h={h} knockoutsStarted={knockoutsStarted} forecast={forecast} bestCase={bestCase} />
    </div>
  )
}

// The featured personal read for the identified bettor, pinned to the top of the
// page so they don't have to find and expand their own row — identical prose to the
// row detail. Built entirely from this bettor's own picks (no generic filler).
function MyHeadline({ name, row, advancement, stageReach, totalPlayers, crossings, goldenBoot, knockoutsStarted, forecast, pivotalCards, pivotalMetric }: {
  name: string; row: Row; advancement: AdvancementSummary | null; stageReach: Record<string, StageReach>; totalPlayers: number
  crossings: CrossingsDigest | null; goldenBoot: GoldenBootDigest | null
  knockoutsStarted: boolean; forecast: ForecastData
  pivotalCards: PivotalCard[]; pivotalMetric: PivotalMetric
}) {
  const firstName = name.split(' ')[0]
  const stagePhases = Object.fromEntries(forecast.stages.map(s => [s.key, s.phase]))
  const h = buildBettorHeadline(row, advancement, stageReach, totalPlayers, { self: true, firstName }, crossings, goldenBoot, knockoutsStarted, stagePhases)
  const bestCase = buildBestCase(row)
  return (
    <section className="wp-me" dir="rtl" aria-label="סיכום ההימור שלך">
      <h3 className="wp-me-title">ההימור שלך, {firstName}</h3>
      <HeadlineBody h={h} knockoutsStarted={knockoutsStarted} forecast={forecast} bestCase={bestCase} pivotal={<WhatIf cards={pivotalCards} metric={pivotalMetric} />} />
    </section>
  )
}

// Sentinel "point in time" meaning before a single ball was kicked — the pure
// pre-tournament priors, with everything simulated from team strength alone.
const PRE_TOURNAMENT = '__pre__'

export default function WinProbabilityView({ results, me, users = [] }: { results: TournamentResults; me?: string; users?: User[] }) {
  const chrono = useMemo(() => playedChrono(results), [results])
  const [openLabel, setOpenLabel] = useState<string | null>(null)
  // selected "point in time": a played match id, the PRE_TOURNAMENT sentinel, or
  // null which follows the latest game.
  const [selId, setSelId] = useState<string | null>(null)

  const selectedPre = selId === PRE_TOURNAMENT
  const effId = selectedPre
    ? null
    : selId && chrono.some(m => playedMatchId(m) === selId)
      ? selId
      : (chrono.length ? playedMatchId(chrono[chrono.length - 1]) : null)
  const isLatest = !selectedPre && !!effId && chrono.length > 0 && effId === playedMatchId(chrono[chrono.length - 1])
  const played = useMemo(() => (!selectedPre && effId ? playedStateUpTo(chrono, effId) : {}), [chrono, effId, selectedPre])
  const trimmed = useMemo(() => resultsUpTo(results, played), [results, played])
  const eliminations = useMemo(() => realEliminations(trimmed), [trimmed])
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

  const { status, rows, reachByTeam, groupFirstByTeam, stageReachByTeam, crossingProbByMatch } = useWinProbabilities(played, playerGoals)
  // "מה אם" for the viewer only, and only while following the latest match — the
  // conditional read is a per-viewer Monte-Carlo pass, so we don't fire it for
  // every scrubbed point in time or every other bettor's row.
  const pivotal = usePivotalMatches(isLatest && me ? me : '', played, playerGoals)
  // Certain real exits, widened by the model's verdict: a pick the simulation gives
  // essentially no path to the knockouts is shown as eliminated even before its
  // group formally closes — so "still alive" never contradicts a ~0% pick.
  const eliminationsEff = useMemo(() => effectiveEliminations(eliminations, reachByTeam), [eliminations, reachByTeam])

  // The R32 bracket as it stands at the viewed point — the reality each bettor's
  // cross-bracket pairings are judged against.
  const actualR32 = trimmed.knockoutStages.r32
  // Once any R32 match has a real score the group stage is settled history — the
  // headline then compresses the group lines and looks forward instead.
  const knockoutsStarted = actualR32.some(m => m.scores && m.scores.home !== null)
  // The whole round of 32 is played — its crossings read as a settled summary, not a
  // projection. (Requires the bracket to be fully drawn and every slot scored.)
  const r32Done = actualR32.length > 0 && actualR32.every(m => m.scores && m.scores.home !== null)

  // Phase of each knockout round at the viewed point, so the per-stage forecast can mark
  // finished rounds as settled and coming ones as a live projection.
  const phaseOfRound = (matches?: { scores?: { home: number | null } }[]): StagePhase => {
    const list = matches ?? []
    if (!list.length) return 'upcoming'
    const played = list.filter(m => m.scores && m.scores.home !== null).length
    if (played === 0) return 'upcoming'
    return played === list.length ? 'done' : 'live'
  }
  const ko = trimmed.knockoutStages
  const stagePhases: Record<string, StagePhase> = {
    r32: phaseOfRound(ko.r32), r16: phaseOfRound(ko.r16), qf: phaseOfRound(ko.qf),
    sf: phaseOfRound(ko.sf), third: phaseOfRound(ko.thirdPlace), final: phaseOfRound(ko.final),
  }
  // The golden boot resolves with the final whistle, so it borrows the final's phase.
  const goldenBootForecastFor = (row: Row): GoldenBootForecast | null => {
    if (!row.scorer || row.scorer === '—') return null
    const gb = row.stages.find(s => s.key === 'gb')
    if (!gb) return null
    const team = scorerTeam.get(row.scorer)
    return {
      scorerHe: row.scorer,
      goals: playerGoals[row.scorer] ?? 0,
      bootPct: Math.round(row.scorerBootPct),
      alive: team ? !eliminationsEff.has(team) : true,
      mine: Math.round(gb.val),
      field: Math.round(gb.field),
      edge: Math.round(gb.edge),
      phase: stagePhases.final,
    }
  }
  const stageForecastFor = (row: Row): ForecastData => ({
    stages: buildStageForecast(row, stagePhases),
    goldenBoot: goldenBootForecastFor(row),
  })
  const usersByLabel = useMemo(() => new Map(users.map(u => [u.label, u])), [users])
  const scorerTeam = useMemo(() => new Map(SCORERS.map(s => [s.name, s.team])), [])

  // One bettor's crossings picture, digested for the headline: locked (the meeting is
  // guaranteed), still-possible (with the likeliest named), and broken pairings.
  const crossingsDigestFor = (label: string): CrossingsDigest | null => {
    const u = usersByLabel.get(label)
    if (!u) return null
    const { locked, potential, missed } = computeUserCrossings(u.knockoutStages?.r32 ?? [], actualR32, crossingProbByMatch)
    const live = potential
      .map(c => ({ c, p: crossingProbability(c, crossingProbByMatch) ?? 0 }))
      .filter(x => x.p > 0)
      .sort((a, b) => b.p - a.p)
    if (!locked.length && !live.length && !missed.length) return null
    const top = live[0]
    return {
      locked: locked.length,
      liveCount: live.length,
      broken: missed.length + (potential.length - live.length),
      topLive: top
        ? { a: TEAMS[top.c.teams[0].team]?.he ?? top.c.teams[0].team, b: TEAMS[top.c.teams[1].team]?.he ?? top.c.teams[1].team, pct: Math.round(top.p * 100) }
        : undefined,
      done: r32Done,
    }
  }

  // The picked scorer's live status for one bettor's row.
  const goldenBootDigestFor = (row: Row): GoldenBootDigest | null => {
    if (!row.scorer || row.scorer === '—') return null
    const team = scorerTeam.get(row.scorer)
    const gb = row.stages.find(s => s.key === 'gb')
    return {
      scorerHe: row.scorer,
      goalsSoFar: playerGoals[row.scorer] ?? 0,
      alive: team ? !eliminationsEff.has(team) : true,
      edge: gb?.edge ?? 0,
    }
  }

  if (status === 'unsupported') {
    return <div className="lb-prob lb-prob--msg">הדפדפן הזה לא תומך בחישוב הסיכויים. נסו דפדפן עדכני.</div>
  }

  const loading = status === 'loading' || rows.length === 0

  // newest match first in the picker
  const pickerOptions = chrono.slice().reverse()

  return (
    <div className="lb-prob">
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
              const latestId = playedMatchId(chrono[chrono.length - 1])
              setSelId(v === latestId ? null : v)
            }}
          >
            {pickerOptions.map((m, i) => {
              const id = playedMatchId(m)
              return (
                <option key={id} value={id}>
                  {i === 0 ? 'המשחק האחרון — ' : ''}{winProbMatchLabel(m)}
                </option>
              )
            })}
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
        if (!meRow) return null
        // A bettor who's essentially a lock for the top 5 sweats the *win*; everyone
        // else sweats *reaching* it — so the fork reads on whichever race is live.
        const pivotalMetric: PivotalMetric = meRow.top5Pct >= 55 ? 'win' : 'podium'
        const pivotalCards = pickPivotal(pivotal.result, pivotalMetric)
        return (
          <MyHeadline
            name={me!}
            row={meRow}
            advancement={advancementSummaryForLabel(me!, reachByTeam, groupFirstByTeam, eliminationsEff)}
            stageReach={stageReachByTeam}
            totalPlayers={rows.length}
            crossings={crossingsDigestFor(me!)}
            goldenBoot={goldenBootDigestFor(meRow)}
            knockoutsStarted={knockoutsStarted}
            forecast={stageForecastFor(meRow)}
            pivotalCards={pivotalCards}
            pivotalMetric={pivotalMetric}
          />
        )
      })()}
      <div className="lb-prob-scroll">
        <table className="wp-table">
          <thead>
            <tr>
              <th className="wp-th wp-th--rank">#</th>
              <th className="wp-th wp-th--name">מהמר</th>
              <th className="wp-th wp-th--p1">ראשון</th>
              <th className="wp-th wp-th--p3">טופ 3</th>
              <th className="wp-th wp-th--p5">טופ 5</th>
              <th className="wp-th wp-th--exp">מקום צפוי</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isMe = r.label === me
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
                    <td className="wp-td wp-td--p1"><span className="wp-pct wp-pct--hero">{fmtPct(r.winPct)}</span></td>
                    <td className="wp-td wp-td--p3"><span className="wp-pct">{fmtPct(r.top3Pct)}</span></td>
                    <td className="wp-td wp-td--p5"><span className="wp-pct">{fmtPct(r.top5Pct)}</span></td>
                    <td className="wp-td wp-td--exp">
                      <ExpectedPlace curRank={r.curRank} expRank={r.expRank} />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="wp-detail-row">
                      <td className="wp-detail-cell" colSpan={6}>
                        <RowDetail
                          row={r}
                          advancement={advancementSummaryForLabel(r.label, reachByTeam, groupFirstByTeam, eliminationsEff)}
                          stageReach={stageReachByTeam}
                          totalPlayers={rows.length}
                          isMe={isMe}
                          crossings={crossingsDigestFor(r.label)}
                          goldenBoot={goldenBootDigestFor(r)}
                          knockoutsStarted={knockoutsStarted}
                          forecast={stageForecastFor(r)}
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
        <b>איך לקרוא:</b> מיון לפי הסיכוי לסיים <b>ראשון מבין כל המהמרים</b>. «ראשון / טופ 3 / טופ 5» = הסיכוי
        לסיים במקום הזה או טוב יותר. «מקום צפוי» = הדירוג הממוצע בסיום, וחץ מראה אם צפויים לעלות או לרדת.
        <b>לחצו על שורה</b> לסיכום אישי — ובראשו «התרחיש האופטימלי שלך»: מה עוד צריך לקרות במשחקים שנותרו כדי שתטפס הכי גבוה,
        ולמטה «גזרת התחזית» מפרקת את הסיכוי לנקודות בכל שלב נוקאאוט ובנעל הזהב.
        {knockoutsStarted && <> אנחנו כבר בנוקאאוט — עם פחות משחקים שנותרו נסגרים תרחישים, אז המספרים כאן מדויקים יותר מאי־פעם.</>}
        {!isLatest && <> בחרתם נקודת זמן קודמת — אפשר לחזור ל«המשחק האחרון» בבורר למעלה.</>}
      </p>
      </>
      )}
    </div>
  )
}
