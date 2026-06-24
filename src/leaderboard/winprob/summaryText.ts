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

// The marquee calls for the top-of-page headline: the boldest depth bets a bettor
// made (champion and finalist), each with the model's odds and a "(הודחה)" flag if
// busted. If they backed nothing that deep, fall back to their two deepest live
// picks. Deliberately short — the full depth ladder lives in the row detail.
function bigBetsClause(s: AdvancementSummary, stageReach: Record<string, StageReach>): string | null {
  let pool = s.picks.filter(p => p.predictedRank >= 6).sort((a, b) => b.predictedRank - a.predictedRank)
  if (!pool.length) pool = s.picks.filter(p => p.stage !== 'out' && p.predictedRank >= 4).sort((a, b) => b.predictedRank - a.predictedRank).slice(0, 2)
  if (!pool.length) return null
  return pool.map(p => p.stage === 'out'
    ? `${p.teamHe} (${DEPTH_TO[p.predictedRank]}) — כבר הודחה`
    : `${p.teamHe} ${DEPTH_TO[p.predictedRank]} (${Math.round(reachAtRank(stageReach[p.team], p.predictedRank) * 100)}%)`,
  ).join(', ')
}

export interface MyHeadline {
  standing: string
  bigBets?: string    // the marquee depth calls (champion/finalist)
  edgeLabel?: string  // 'החוזק שלך' | 'החיסרון שלך'
  edge?: string       // the single biggest points gap vs the field
  fallen?: string     // group picks already out of the race
}

// A tight, synthesised read of *your own* bet for the top of the page — an executive
// summary that doesn't just repeat the row detail. The standing numbers (with your
// projected finishing points), your boldest calls, the single factor that most moves
// you against the field, and the group busts. The full depth ladder and per-stage
// edge breakdown stay in the row detail, so the headline reads as a headline.
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
  // The one stage where this bettor diverges most from the field — strength or weakness.
  const sig = row.stages.filter(s => Math.abs(s.edge) >= EDGE_MIN).sort((a, b) => Math.abs(b.edge) - Math.abs(a.edge))
  if (sig.length) {
    const s = sig[0]
    out.edgeLabel = s.edge > 0 ? 'החוזק שלך' : 'החיסרון שלך'
    out.edge = s.edge > 0
      ? `${s.label} (+${s.edge.toFixed(0)} נק׳ מעל ממוצע המהמרים)`
      : `${s.label} (−${Math.abs(s.edge).toFixed(0)} נק׳ מתחת לממוצע)`
  }
  if (advancement && advancement.total > 0) {
    out.bigBets = bigBetsClause(advancement, stageReach) ?? undefined
    const fallen = advancement.picks.filter(p => p.predictedRank <= 3 && p.stage === 'out').map(p => p.teamHe)
    if (fallen.length) out.fallen = fallen.join(', ')
  }
  return out
}
