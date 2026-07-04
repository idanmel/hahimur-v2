// Pure Hebrew text builders for the win-probability card and the personal headline.
// Kept React-free so the wording can be unit-tested directly on synthetic data —
// the view just renders what these return.
import type { Row, AdvancementSummary, PickStatus, StageReach } from '../../../sim-core'
import { reachAtRank } from '../../../sim-core'
import { OLEH_POINTS } from '../points'

// A win% that rounds to 0.0 isn't a proven impossibility — at the card's sim count
// it just means "below the resolution we can see". Showing "<0.1%" instead of "0%"
// keeps it honest (and matches why such a bettor can still top a best-case board).
export function fmtPct(p: number): string {
  return p > 0 && p < 0.1 ? '<0.1%' : `${p.toFixed(1)}%`
}

// Short Hebrew header for the depth a team was backed to reach.
export const DEPTH_HEAD: Record<number, string> = { 7: 'אלופה', 6: 'לגמר', 5: 'לחצי הגמר', 4: 'לרבע הגמר' }

// The destination phrasing for a single named bet — "France to the title".
const DEPTH_TO: Record<number, string> = { 7: 'לאליפות', 6: 'לגמר', 5: 'לחצי הגמר', 4: 'לרבע הגמר' }

// The bettor's *deep* picks (quarter-final and beyond), each with the model's odds
// to reach the exact stage they predicted — "you took Spain all the way: 18% title,
// England to the final: 29%…". This is the heart of the round: it ties each pick to
// the depth it was bet at, in percentages. Eliminated picks are flagged outright.
// Grouped by depth (deepest first); a pick is listed once, at its deepest stage.
export function deepPicksClause(s: AdvancementSummary, stageReach: Record<string, StageReach>): string | null {
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
export function groupPicksClause(s: AdvancementSummary): string | null {
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
export function edgeClause(row: Row): string | null {
  const sig = row.stages.filter(s => Math.abs(s.edge) >= EDGE_MIN)
  if (!sig.length) return null
  const fmt = (s: Row['stages'][number]) => `${s.label} ${s.edge > 0 ? '+' : '−'}${Math.abs(s.edge).toFixed(0)}`
  const strong = sig.filter(s => s.edge > 0).sort((a, b) => b.edge - a.edge).slice(0, 3).map(fmt)
  const weak = sig.filter(s => s.edge < 0).sort((a, b) => a.edge - b.edge).slice(0, 2).map(fmt)
  const parts: string[] = []
  if (strong.length) parts.push(`מרוויח על המתחרים בנקודות: ${strong.join(', ')}`)
  if (weak.length) parts.push(`מפסיד: ${weak.join(', ')}`)
  return parts.join(' · ')
}

// One marquee call, with the model's odds and a "(הודחה)" flag if busted.
function betPhrase(p: PickStatus, stageReach: Record<string, StageReach>): string {
  return p.stage === 'out'
    ? `${p.teamHe} (${DEPTH_TO[p.predictedRank]}) — הודחה`
    : `${p.teamHe} ${DEPTH_TO[p.predictedRank]} (${Math.round(reachAtRank(stageReach[p.team], p.predictedRank) * 100)}%)`
}

// The simulated *route* of a team through the bracket, stage by stage. Because the
// engine resolves the real Round-of-32 cross and plays each knockout head-to-head
// against whoever the draw delivers, this ladder already encodes path difficulty:
// an easy draw melts slowly, a brutal half drops off a cliff. Shown for the bettor's
// deepest live pick, from the round of 16 up to the depth they backed it.
const ROUTE_STEPS: { word: string; key: keyof StageReach; rank: number }[] = [
  { word: 'שמינית', key: 'r16', rank: 3 },
  { word: 'רבע', key: 'qf', rank: 4 },
  { word: 'חצי', key: 'sf', rank: 5 },
  { word: 'גמר', key: 'final', rank: 6 },
  { word: 'אלופה', key: 'champion', rank: 7 },
]
function routeLadder(team: string, predictedRank: number, stageReach: Record<string, StageReach>): string | null {
  const sr = stageReach[team]
  if (!sr) return null
  const steps = ROUTE_STEPS.filter(s => s.rank <= predictedRank)
  if (steps.length < 2) return null
  // RTL line: the arrow must point in the reading direction (right→left), so the
  // ladder reads forward as שמינית → … → אלופה. A ' → ' glyph points backwards here.
  return steps.map(s => `${s.word} ${Math.round(sr[s.key] * 100)}%`).join(' ← ')
}

export interface BettorHeadline {
  standing: string
  nextStep?: string   // forward-looking: the rare deep picks that must come through to climb
  route?: { teamHe: string; ladder: string } // deepest live pick's simulated path
  bigBets?: string    // the other marquee depth calls (finalist/SF), with odds
  advancers?: string  // how many backed teams escaped the group + points banked, vs field
  remaining?: string  // forward look at the points still to be won in the rounds left
  crossings?: string  // R32 cross-bracket pairings: locked / possible / broken, vs field
  potential?: string  // total projected points vs the field + the stage driving the gap
  fragility?: string  // how result-dependent the bet is (the central-90% points band)
  goldenBoot?: string // the picked top scorer's standing and projected edge
  eliminated?: string // every pick already knocked out (group or knockout)
}

// The crossings picture for one bettor, pre-digested by the view from the live sim
// so this module stays pure: how many of their R32 cross-bracket pairings are nailed
// on (the meeting will happen), how many can still come true, how many already broke,
// and the single likeliest live one to call out by name.
export interface CrossingsDigest {
  locked: number
  liveCount: number
  broken: number
  topLive?: { a: string; b: string; pct: number }
  // The round of 32 is fully played: the crossings read as a settled summary
  // (what materialized), not as a projection of what still might happen.
  done?: boolean
}

// The picked golden-boot scorer's live status, digested by the view: their goals so
// far, whether their team is still in, and the projected points edge vs the field.
export interface GoldenBootDigest {
  scorerHe: string
  goalsSoFar: number
  alive: boolean
  edge: number
}

// The forward-looking "what has to happen to climb" digest: the bettor's live deep
// picks (QF+) that *few others backed this deep*, so their advancing is exactly where
// this bettor gains ground on the field. Each carries the depth it was bet at, the
// model's current chance of reaching it, and how many *other* bettors share the pick.
export interface NextStepPick {
  teamHe: string
  predictedRank: number // depth backed (7=title … 4=QF); names the milestone
  pct: number           // model chance to reach that depth, already ×100 and rounded
  others: number        // other bettors who also backed it this deep (0 = unique)
}
export interface NextStepDigest {
  picks: NextStepPick[]
}

// מה צריך לקרות — the punchy, pool-relative to-do list: which of the bettor's rare
// deep picks need to come through to gain on the field, each with its live chance and
// how lonely the call is. Forward-looking by design — it replaces dwelling on the
// settled group stage. Null when the bettor has no differentiating live deep pick.
export function nextStepClause(d: NextStepDigest): string | null {
  if (!d.picks.length) return null
  const items = d.picks.map(p => {
    const who = p.others === 0 ? 'רק אתה עליה' : `עוד ${p.others} עליה`
    return `${p.teamHe} ${DEPTH_TO[p.predictedRank]} ${p.pct}% (${who})`
  })
  return items.join(' · ')
}

// How result-dependent a bet is *relative to the pool* — the only fragility that
// matters in a winner-takes-the-pot race. The view digests the bettor's live deep
// picks (QF+) into two buckets:
//   • rare      — few other bettors backed them this deep, so they're where the bettor
//                 wins or loses ground vs the field (high leverage, true fragility).
//   • consensus — most of the field backed them too, so if they fall everyone falls
//                 together and the bettor's standing barely moves (low leverage).
// Each carries `others` = how many *other* bettors share that deep pick.
export interface FragilityDigest {
  rare: { teamHe: string; others: number }[]
  consensus: { teamHe: string; others: number }[]
}

// תלות בתוצאות — answers "if my big teams go out, does it actually cost me, given who
// else picked them?". The rare, high-leverage picks are already spelled out in «מה
// צריך לקרות», so this line stays focused on the *consensus* deep picks — the ones most
// of the field shares, whose collapse drags everyone down together and so barely moves
// this bettor's standing. Returns null when there's no consensus pick to reassure about.
export function fragilityClause(d: FragilityDigest): string | null {
  if (!d.consensus.length) return null
  const list = d.consensus.map(p => `${p.teamHe} (עוד ${p.others})`).join(', ')
  return `${list} קונצנזוס — אם ייפלו, כל המתחרים נופלים יחד, אז מיקומך כמעט לא ישתנה`
}

// The expected points the bettor banks at one stage and how it compares to the field
// average there — read straight off the row the sim produced, rounded for prose.
function stageEdge(row: Row | undefined, key: string): { val: number; field: number; edge: number } | null {
  const s = row?.stages.find(st => st.key === key)
  if (!s) return null
  return { val: Math.round(s.val), field: Math.round(s.field), edge: Math.round(s.edge) }
}

// עולות — how many of the teams the bettor backed to escape their group actually did,
// and the advancement points that locks in. Group play is over, so reach is 0/1 and a
// team that reached the R32 banked OLEH_POINTS.group whatever it did next — exactly the
// pool's advancement credit, the most concrete "points already in the bag" line we have.
// With a row, it also says how the bettor's group-stage haul stacks up against the field
// — the comparative read that explains part of the win-% gap.
// `compact` (once the knockouts are under way) drops the field-average tail and keeps
// only the banked-points note — the group stage is history, so it earns one short line.
export function advancersClause(s: AdvancementSummary, row?: Row, compact = false): string | null {
  if (!s.total) return null
  const advanced = s.picks.filter(p => p.reach >= 0.5).length
  const base = advanced
    ? `${advanced} מתוך ${s.total} שבחרת עלו מהבתים — ${advanced * OLEH_POINTS.group} נק׳ עלייה כבר בכיס`
    : `אף אחת מ-${s.total} הקבוצות שבחרת לא עלתה מהבתים`
  if (compact) return base
  const g = stageEdge(row, 'group')
  if (g && Math.abs(g.edge) >= 1) {
    return `${base} · בשלב הבתים ${g.val} נק׳ מול ${g.field} בממוצע (${g.edge >= 0 ? '+' : '−'}${Math.abs(g.edge)})`
  }
  return base
}

// הצלבות — the value in the bettor's R32 cross-bracket pairings, the rare high-yield
// calls. While the round is live: "locked" pairings will physically happen, "still
// possible" ones are upside (likeliest named), "broken" are gone, and the R32 points
// are a projection. Once the round is done (`d.done`) it flips to a settled summary —
// how many predicted matchups materialized and the R32 points actually banked vs the
// field — with no future-tense wording, since nothing there is still to be decided.
export function crossingsClause(d: CrossingsDigest, row?: Row): string | null {
  const parts: string[] = []
  const r = stageEdge(row, 'r32')
  if (d.done) {
    const total = d.locked + d.broken
    if (total > 0) parts.push(`${d.locked} מתוך ${total} מפגשים שחזית התקיימו`)
    if (r && Math.abs(r.edge) >= 1) {
      parts.push(`בשלב ה-32 ${r.val} נק׳ מול ${r.field} בממוצע (${r.edge >= 0 ? '+' : '−'}${Math.abs(r.edge)})`)
    }
    return parts.length ? parts.join(' · ') : null
  }
  if (d.locked) parts.push(`${d.locked} כבר נעולות — המפגש מובטח`)
  if (d.liveCount) {
    parts.push(d.topLive
      ? `${d.liveCount} עוד אפשריות (הקרובה: ${d.topLive.a}–${d.topLive.b} ${d.topLive.pct}%)`
      : `${d.liveCount} עוד אפשריות`)
  }
  if (d.broken) parts.push(`${d.broken} כבר נשברו`)
  if (r && Math.abs(r.edge) >= 1) {
    parts.push(`בשלב ה-32 ${r.val} נק׳ צפויות מול ${r.field} בממוצע (${r.edge >= 0 ? '+' : '−'}${Math.abs(r.edge)})`)
  }
  return parts.length ? parts.join(' · ') : null
}

// פוטנציאל — the line that answers the question every bettor asks looking at their
// win-%: "why am I at X%?". It sums the per-stage edges into a single total-points gap
// vs the field (what the sim is really ranking on) and names the stage carrying most of
// it — so the percentage reads as a consequence of concrete projected points, not magic.
export function potentialClause(row: Row): string | null {
  if (!row.stages.length) return null
  const diff = Math.round(row.stages.reduce((acc, s) => acc + s.edge, 0))
  const top = [...row.stages].sort((a, b) => Math.abs(b.edge) - Math.abs(a.edge))[0]
  if (!top || Math.abs(Math.round(top.edge)) < 1) return null
  const lever = `${top.label} ${top.edge >= 0 ? '+' : '−'}${Math.abs(Math.round(top.edge))} נק׳`
  const side = diff >= 0 ? `כ-${diff} נק׳ מעל ממוצע המהמרים` : `כ-${Math.abs(diff)} נק׳ מתחת לממוצע המהמרים`
  return `הצפי הכולל שלך ${side} — ${diff >= 0 ? 'עיקר היתרון' : 'עיקר הפיגור'}: ${lever}`
}

// גזרת התחזית — the per-stage forecast that unpacks the win-% and expected place into
// concrete points, one knockout round at a time. For each round it carries the bettor's
// projected (or, once played, banked) points, the field average there, the signed gap,
// and the round's phase so the view can mark finished rounds as a settled summary and
// coming rounds as a forecast that still moves. This is the visual companion to the
// prose potential line — it shows *where* the number comes from, round by round.
export type StagePhase = 'done' | 'live' | 'upcoming'

export interface StageForecastRow {
  key: string
  label: string
  mine: number
  field: number
  edge: number
  phase: StagePhase
}

// The knockout ladder, in bracket order — including the third-place match, which
// carries a heavy bonus (a correct third-place winner is worth a lot). Group stage and
// golden boot sit outside this list (group is pre-knockout; the boot is its own slice).
const FORECAST_KEYS = ['r32', 'r16', 'qf', 'sf', 'third', 'final'] as const

export function buildStageForecast(row: Row, phases: Partial<Record<string, StagePhase>> = {}): StageForecastRow[] {
  const out: StageForecastRow[] = []
  for (const key of FORECAST_KEYS) {
    const s = row.stages.find(st => st.key === key)
    if (!s) continue
    out.push({
      key,
      label: s.label,
      mine: Math.round(s.val),
      field: Math.round(s.field),
      edge: Math.round(s.edge),
      phase: phases[key] ?? 'upcoming',
    })
  }
  return out
}

// The cumulative knockout gap vs the field — the one-number takeaway under the
// per-round breakdown, tying the rounds back to why the bettor sits where they do.
export function stageForecastTotalEdge(rows: StageForecastRow[]): number {
  return rows.reduce((acc, r) => acc + r.edge, 0)
}

// פוטנציאל בהמשך — once the settled group/R32 recap drops away, this looks purely
// forward: the expected points still to be won across the knockout rounds that
// haven't finished, plus the round carrying the biggest edge vs the field (framed as
// the opportunity or the risk). It replaces the backward "advancers/crossings banked"
// recap once those stages are history. Null when no live round holds real points.
export function remainingPotentialClause(row: Row, phases: Partial<Record<string, StagePhase>>): string | null {
  const live = FORECAST_KEYS
    .map(k => row.stages.find(st => st.key === k))
    .filter((s): s is Row['stages'][number] => !!s && phases[s.key] !== 'done')
  if (!live.length) return null
  const mine = Math.round(live.reduce((a, s) => a + s.val, 0))
  if (mine < 1) return null
  const base = `עוד כ-${mine} נק׳ צפויות לך מהשלבים שנותרו`
  const top = [...live].sort((a, b) => Math.abs(b.edge) - Math.abs(a.edge))[0]
  const e = Math.round(top.edge)
  if (Math.abs(e) < 1) return base
  const lever = `${top.label} ${e >= 0 ? '+' : '−'}${Math.abs(e)} נק׳ מול השדה`
  return `${base} — ${e >= 0 ? 'עיקר ההזדמנות' : 'עיקר הסיכון'}: ${lever}`
}

// נעל זהב — the picked scorer's race: goals banked so far, a flag if their team is out
// (which caps the bet), and the projected points edge against the field when it matters.
export function goldenBootClause(d: GoldenBootDigest): string | null {
  if (!d.scorerHe || d.scorerHe === '—') return null
  let s = d.goalsSoFar > 0 ? `${d.scorerHe} — ${d.goalsSoFar} שערים עד כה` : `${d.scorerHe} — טרם כבש`
  if (!d.alive) s += ' · הקבוצה הודחה'
  else if (Math.abs(d.edge) >= EDGE_MIN) s += ` · ${d.edge > 0 ? '+' : '−'}${Math.abs(d.edge).toFixed(0)} נק׳ מול הממוצע`
  return s
}

// Who we're writing about — second person ("אתה") for the viewer's own featured
// card, or the bettor's name in the row detail. Keeps the prose identical bar the
// subject, so the expand-on-tap read matches the headline at the top of the page.
export type HeadlineSubject =
  | { self: true; firstName: string }
  | { self: false; name: string }

// Where a bettor sits in words, not just a number — so the standing reads like a
// verdict on their real situation rather than a stat dump.
function rankPhrase(rank: number, total: number): string {
  if (rank <= 1) return 'בראש הטבלה'
  if (rank <= Math.max(2, Math.ceil(total * 0.15))) return 'בצמרת הטבלה'
  if (rank <= Math.ceil(total / 2)) return 'בחצי העליון'
  if (rank < total) return 'בחצי התחתון'
  return 'בתחתית הטבלה'
}

// How alive the title hopes are, framed by the model's win odds.
function chancePhrase(winPct: number): string {
  if (winPct >= 25) return 'מועמד מוביל לזכייה'
  if (winPct >= 12) return 'מועמד רציני לזכייה'
  if (winPct >= 4) return 'עדיין בתמונה לזכייה'
  if (winPct > 0) return 'אאוטסיידר לזכייה'
  return 'כמעט מחוץ למרוץ על הזכייה'
}

// The opening paragraph: standing in words + place, the live title odds, and the
// model's projected finish with its trajectory — all grounded in this bettor's
// own numbers, in second or third person per `subject`.
function standingText(row: Row, totalPlayers: number, subject: HeadlineSubject): string {
  const exp = Math.round(row.expRank)
  const subj = subject.self ? 'אתה' : subject.name
  const place = `${subj} ${rankPhrase(row.curRank, totalPlayers)}, מקום ${row.curRank} מתוך ${totalPlayers}.`
  const chance = `${chancePhrase(row.winPct)} — ${fmtPct(row.winPct)} לזכייה, ${fmtPct(row.top5Pct)} לטופ 5.`
  const avg = Math.round(row.avgPts)
  // A leader the model expects to slip gets a blunt "leading now, but…" so the gap
  // between the current standing and the projected finish reads as the headline.
  const slipLead = row.curRank === 1 ? 'מוביל כעת אך ' : ''
  const proj =
    exp < row.curRank ? `המודל צופה טיפוס למקום ${exp} בסיום, עם צפי של כ-${avg} נק׳.`
    : exp > row.curRank ? `${slipLead}המודל צופה נסיגה למקום ${exp} בסיום, עם צפי של כ-${avg} נק׳.`
    : `המודל צופה סיום סביב מקום ${exp}, עם צפי של כ-${avg} נק׳.`
  return `${place} ${chance} ${proj}`
}

// A synthesised read of one bettor's bet, used both for the viewer's featured card
// at the top and for the expand-on-tap detail of any row (same prose, subject aside).
// Beyond the standing it shows the simulated *route* of the deepest live pick (which
// already bakes in the bracket/draw difficulty), the other marquee calls, where the
// bettor most beats and trails the field in points, and the group busts.
export function buildBettorHeadline(
  row: Row,
  advancement: AdvancementSummary | null,
  stageReach: Record<string, StageReach>,
  totalPlayers: number,
  subject: HeadlineSubject,
  crossings: CrossingsDigest | null = null,
  goldenBoot: GoldenBootDigest | null = null,
  fragility: FragilityDigest | null = null,
  // Once the knockouts are under way the group stage is settled history: the
  // advancers line drops and only knockout-depth busts stay in "eliminated".
  knockoutsStarted = false,
  nextStep: NextStepDigest | null = null,
  // Phase of each knockout round at the viewed point — lets the settled group/R32
  // recap give way to a forward "points still to come" line once they're history.
  stagePhases: Partial<Record<string, StagePhase>> = {},
): BettorHeadline {
  const standing = standingText(row, totalPlayers, subject)

  const out: BettorHeadline = { standing }

  // Lead the read with what still has to happen for this bettor to gain ground.
  if (nextStep) {
    const ns = nextStepClause(nextStep)
    if (ns) out.nextStep = ns
  }

  if (advancement && advancement.total > 0) {
    const deepLive = advancement.picks.filter(p => p.stage !== 'out' && p.predictedRank >= 4).sort((a, b) => b.predictedRank - a.predictedRank)
    const lead = deepLive[0]
    if (lead) {
      const ladder = routeLadder(lead.team, lead.predictedRank, stageReach)
      if (ladder) out.route = { teamHe: lead.teamHe, ladder }
    }
    const others = advancement.picks.filter(p => p.predictedRank >= 5 && p.team !== lead?.team).sort((a, b) => b.predictedRank - a.predictedRank)
    if (others.length) out.bigBets = others.map(p => betPhrase(p, stageReach)).join(', ')

    // Before the knockouts, recap the group escapes + banked points. Once they start,
    // the group is settled history — drop that recap and look forward instead.
    if (!knockoutsStarted) {
      const advancers = advancersClause(advancement, row, false)
      if (advancers) out.advancers = advancers
    }

    // Eliminated picks. Before the knockouts it's every bust (group calls still fresh).
    // Once they start we keep only *knockout* losses — deep picks (QF+) that reached the
    // round of 32 (reach ≥ 0.5) and then fell — so the line clearly means "teams I lost
    // in the bracket", not group no-shows (those are summarised in the advancers line).
    const eliminated = advancement.picks
      .filter(p => p.stage === 'out' && (!knockoutsStarted || (p.predictedRank >= 4 && p.reach >= 0.5)))
      .map(p => p.teamHe)
    if (eliminated.length) out.eliminated = eliminated.join(', ')
  }

  // The R32 cross-bracket recap only while the round is still live; once it's settled
  // it's behind us, so the forward "remaining rounds" line takes its place.
  if (crossings && !crossings.done) {
    const c = crossingsClause(crossings, row)
    if (c) out.crossings = c
  }

  // With the group (and any settled early rounds) behind us, look ahead: the points
  // still on the table in the rounds left, and where the biggest edge sits.
  if (knockoutsStarted) {
    const rem = remainingPotentialClause(row, stagePhases)
    if (rem) out.remaining = rem
  }

  const potential = potentialClause(row)
  if (potential) out.potential = potential

  if (fragility) {
    const f = fragilityClause(fragility)
    if (f) out.fragility = f
  }

  if (goldenBoot) {
    const gb = goldenBootClause(goldenBoot)
    if (gb) out.goldenBoot = gb
  }

  return out
}
