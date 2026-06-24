// Pure Hebrew text builders for the win-probability card and the personal headline.
// Kept React-free so the wording can be unit-tested directly on synthetic data —
// the view just renders what these return.
import type { Row, AdvancementSummary, StageReach } from '../../../sim-core'
import { reachAtRank } from '../../../sim-core'

// A win% that rounds to 0.0 isn't a proven impossibility — at the card's sim count
// it just means "below the resolution we can see". Showing "<0.1%" instead of "0%"
// keeps it honest (and matches why such a bettor can still top a best-case board).
export function fmtPct(p: number): string {
  return p > 0 && p < 0.1 ? '<0.1%' : `${p.toFixed(1)}%`
}

// Short Hebrew header for the depth a team was backed to reach.
export const DEPTH_HEAD: Record<number, string> = { 7: 'אלופה', 6: 'לגמר', 5: 'לחצי', 4: 'לרבע' }

// The forward-looking phrasing for the deepest live bet — "as far as you sent it".
const DEPTH_GOAL: Record<number, string> = {
  7: 'שתזכה באליפות', 6: 'שתגיע לגמר', 5: 'שתגיע לחצי הגמר', 4: 'שתגיע לרבע הגמר',
}

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
  const fmt = (s: Row['stages'][number]) => `${s.label} (${s.edge > 0 ? '+' : '−'}${Math.abs(s.edge).toFixed(0)})`
  const strong = sig.filter(s => s.edge > 0).sort((a, b) => b.edge - a.edge).slice(0, 3).map(fmt)
  const weak = sig.filter(s => s.edge < 0).sort((a, b) => a.edge - b.edge).slice(0, 2).map(fmt)
  const parts: string[] = []
  if (strong.length) parts.push(`מרוויח על המתחרים ב${strong.join(', ')}`)
  if (weak.length) parts.push(`מפסיד להם ב${weak.join(', ')}`)
  return parts.join(' · ')
}

// The deepest pick the bettor still has alive (QF+), with the model's odds it reaches
// that depth — the storyline their bet now hangs on. Ties break on the better odds.
function topAliveBet(s: AdvancementSummary, stageReach: Record<string, StageReach>): { teamHe: string; rank: number; pct: number } | null {
  const alive = s.picks.filter(p => p.stage !== 'out' && p.predictedRank >= 4)
  if (!alive.length) return null
  const reach = (p: typeof alive[number]) => reachAtRank(stageReach[p.team], p.predictedRank)
  const top = alive.sort((a, b) => b.predictedRank - a.predictedRank || reach(b) - reach(a))[0]
  return { teamHe: top.teamHe, rank: top.predictedRank, pct: reach(top) }
}

export interface MyHeadline {
  standing: string
  edge?: string
  marquee?: string   // the deep picks, with odds
  fallen?: string    // group picks already out of the race
  storyline?: string // the deepest live bet — what to root for next
}

// A fuller, synthesised read of *your own* bet for the top of the page — beyond the
// per-row detail. Opens with the hard standing numbers, then explains it with the
// scoring edge that actually moves the needle, the marquee deep picks, any group
// busts, and the live bet the rest of the run hangs on. Every part is a fact tied to
// this bettor's own picks and the model — no generic "you have a steady bracket" prose.
export function buildMyHeadline(
  row: Row,
  advancement: AdvancementSummary | null,
  stageReach: Record<string, StageReach>,
  totalPlayers: number,
): MyHeadline {
  const exp = Math.round(row.expRank)
  const dir = exp < row.curRank ? ', צפוי לטפס' : exp > row.curRank ? ', צפוי לרדת' : ''
  const standing = `אתה במקום ${row.curRank} מתוך ${totalPlayers}. הסיכוי שלך לקחת את הקופה: ${fmtPct(row.winPct)} (טופ 5: ${fmtPct(row.top5Pct)}), והמודל צופה לך סיום ממוצע במקום ${exp}${dir}.`

  const out: MyHeadline = { standing }
  out.edge = edgeClause(row) ?? undefined
  if (advancement && advancement.total > 0) {
    out.marquee = deepPicksClause(advancement, stageReach) ?? undefined
    const fallen = advancement.picks.filter(p => p.predictedRank <= 3 && p.stage === 'out').map(p => p.teamHe)
    if (fallen.length) out.fallen = fallen.join(', ')
    const top = topAliveBet(advancement, stageReach)
    if (top) out.storyline = `מכאן הסיפור שלך הוא ${top.teamHe}: המודל נותן ${Math.round(top.pct * 100)}% ${DEPTH_GOAL[top.rank]}.`
  }
  return out
}
