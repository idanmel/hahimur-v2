// Pure Hebrew text builders for the win-probability card and the personal headline.
// Kept React-free so the wording can be unit-tested directly on synthetic data —
// the view just renders what these return.
import type { Row, AdvancementSummary, PickStatus, StageReach } from '../../../sim-core'
import { reachAtRank } from '../../../sim-core'

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
  return steps.map(s => `${s.word} ${Math.round(sr[s.key] * 100)}%`).join(' → ')
}

export interface MyHeadline {
  standing: string
  route?: { teamHe: string; ladder: string } // deepest live pick's simulated path
  bigBets?: string    // the other marquee depth calls (finalist/SF), with odds
  strength?: string   // top stages where you beat the field, in points
  weakness?: string   // top stage where you trail the field, in points
  fallen?: string     // group picks already out of the race
}

// A richer synthesised read of *your own* bet for the top of the page. Beyond the
// standing it shows the simulated *route* of your deepest live pick (which already
// bakes in the bracket/draw difficulty), your other marquee calls, where you most
// beat and trail the field in points, and the group busts. The full depth ladder for
// every pick stays in the row detail.
export function buildMyHeadline(
  row: Row,
  advancement: AdvancementSummary | null,
  stageReach: Record<string, StageReach>,
  totalPlayers: number,
): MyHeadline {
  const exp = Math.round(row.expRank)
  const dir = exp < row.curRank ? ' (צפוי לטפס)' : exp > row.curRank ? ' (צפוי לרדת)' : ''
  const standing = `אתה במקום ${row.curRank} מתוך ${totalPlayers}. סיכוי לזכייה: ${fmtPct(row.winPct)} · טופ 5: ${fmtPct(row.top5Pct)} · צפי סיום: מקום ${exp}${dir} עם כ-${Math.round(row.avgPts)} נק׳.`

  const out: MyHeadline = { standing }
  const sig = row.stages.filter(s => Math.abs(s.edge) >= EDGE_MIN)
  const strong = sig.filter(s => s.edge > 0).sort((a, b) => b.edge - a.edge).slice(0, 2).map(s => `${s.label} +${s.edge.toFixed(0)}`)
  const weak = sig.filter(s => s.edge < 0).sort((a, b) => a.edge - b.edge).slice(0, 1).map(s => `${s.label} −${Math.abs(s.edge).toFixed(0)}`)
  if (strong.length) out.strength = `${strong.join(', ')} (נק׳ מעל ממוצע המהמרים)`
  if (weak.length) out.weakness = `${weak.join(', ')} (נק׳ מתחת לממוצע)`

  if (advancement && advancement.total > 0) {
    const deepLive = advancement.picks.filter(p => p.stage !== 'out' && p.predictedRank >= 4).sort((a, b) => b.predictedRank - a.predictedRank)
    const lead = deepLive[0]
    if (lead) {
      const ladder = routeLadder(lead.team, lead.predictedRank, stageReach)
      if (ladder) out.route = { teamHe: lead.teamHe, ladder }
    }
    const others = advancement.picks.filter(p => p.predictedRank >= 5 && p.team !== lead?.team).sort((a, b) => b.predictedRank - a.predictedRank)
    if (others.length) out.bigBets = others.map(p => betPhrase(p, stageReach)).join(', ')
    const fallen = advancement.picks.filter(p => p.predictedRank <= 3 && p.stage === 'out').map(p => p.teamHe)
    if (fallen.length) out.fallen = fallen.join(', ')
  }
  return out
}
