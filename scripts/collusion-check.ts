/**
 * Forensic check for "someone saw everyone's forms and had AI build the
 * win-maximizing form" in Game 1 (the locked 104-match bracket).
 *
 * Theory of the tell:
 *  - A FIELD-BLIND form (max your own expected score) picks the global favorite
 *    for the big slots -> that pick is usually HIGH ownership (everyone's AI
 *    converges on the same favorite). Conformity is roughly uniform across cheap
 *    and expensive slots.
 *  - A FIELD-AWARE, win-maximizing form (needs to see rivals) does the opposite:
 *    it CONFORMS on cheap, near-unanimous slots (group games, worth 2-4 pts) and
 *    goes CONTRARIAN on the few high-value, high-variance slots (champion 25,
 *    finalists, SF 16, 3rd-place 20) toward a STRONG-but-uniquely-held team, so a
 *    single deep hit leapfrogs the whole pack.
 *
 * So the fingerprint = high cheap-conformity + high expensive-uniqueness on
 * teams the field itself rates as strong. We measure exactly that.
 */
import { USERS } from '../src/users'

const N = USERS.length
const others = (i: number) => USERS.filter((_, j) => j !== i)

// ---------- helpers ----------
function frac(pred: (u: (typeof USERS)[number]) => boolean, pool: (typeof USERS)[number][]) {
  return pool.filter(pred).length / pool.length
}
function z(vals: number[]) {
  const m = vals.reduce((a, b) => a + b, 0) / vals.length
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length) || 1
  return vals.map(v => (v - m) / sd)
}

// ---------- 1. group-stage conformity (cheap slots) ----------
const GROUPS = 'ABCDEFGHIJKL'.split('')
type Cell = { home: number; away: number }
function groupCells(u: (typeof USERS)[number]): Record<string, Cell> {
  const out: Record<string, Cell> = {}
  for (const g of GROUPS) for (const m of u.groupMatches[g] ?? []) {
    if (m.scores && m.scores.home != null && m.scores.away != null) out[m.id] = { home: m.scores.home, away: m.scores.away }
  }
  return out
}
const cells = USERS.map(groupCells)
const allMatchIds = [...new Set(cells.flatMap(c => Object.keys(c)))]

// modal exact score + modal direction per match
function dir(c: Cell) { return c.home > c.away ? 'H' : c.home < c.away ? 'A' : 'D' }
const modalExact: Record<string, string> = {}
const modalDir: Record<string, string> = {}
for (const id of allMatchIds) {
  const exact: Record<string, number> = {}
  const d: Record<string, number> = {}
  for (const c of cells) if (c[id]) {
    const k = `${c[id].home}-${c[id].away}`
    exact[k] = (exact[k] ?? 0) + 1
    d[dir(c[id])] = (d[dir(c[id])] ?? 0) + 1
  }
  modalExact[id] = Object.entries(exact).sort((a, b) => b[1] - a[1])[0][0]
  modalDir[id] = Object.entries(d).sort((a, b) => b[1] - a[1])[0][0]
}

// ---------- knockout / high-value slots ----------
const champ = (i: number) => USERS[i].predictedChampion
const third = (i: number) => USERS[i].predictedThirdPlaceWinner
const sfTeams = (i: number) => USERS[i].predictedSFTeams ?? []
const finalTeams = (i: number) => USERS[i].predictedFinalTeams ?? []
const qfTeams = (i: number) => USERS[i].predictedQFTeams ?? []
const boot = (i: number) => USERS[i].topGoalscorer

// field strength of a team = fraction of ALL forms that place it in the final four (SF)
const sfCount: Record<string, number> = {}
USERS.forEach((_, i) => sfTeams(i).forEach(t => { sfCount[t] = (sfCount[t] ?? 0) + 1 }))
const fieldStrength = (t: string) => (sfCount[t] ?? 0) / N

// champion ownership map (over whole field)
const champCount: Record<string, number> = {}
USERS.forEach((_, i) => { champCount[champ(i)] = (champCount[champ(i)] ?? 0) + 1 })

// ---------- per-user metrics ----------
type Row = {
  name: string
  cheapConform: number     // group exact-score agreement w/ field mode (0-1)
  cheapDirConform: number  // group direction agreement (0-1)
  champ: string
  champOwn: number         // fraction of OTHERS sharing this champion
  champStrength: number    // field-rated strength of the champion
  champLeverage: number    // strength * (1 - ownership) -> strong & unique
  finalUnique: number      // avg (1-ownership) of the two finalists, strength-gated
  sfUnique: number         // avg (1-ownership) of SF four, strength-gated
  bigLeverage: number      // combined expensive-slot leverage
  maxPairSim: number       // most similar single rival (group exact overlap)
}
const rows: Row[] = USERS.map((u, i) => {
  const c = cells[i]
  const ids = Object.keys(c)
  const cheapConform = ids.filter(id => `${c[id].home}-${c[id].away}` === modalExact[id]).length / ids.length
  const cheapDirConform = ids.filter(id => dir(c[id]) === modalDir[id]).length / ids.length

  const oth = others(i)
  const champOwn = frac(o => o.predictedChampion === champ(i), oth)
  const champStrength = fieldStrength(champ(i))
  const champLeverage = champStrength * (1 - champOwn)

  const finalUnique = finalTeams(i).map(t => fieldStrength(t) * (1 - frac(o => (o.predictedFinalTeams ?? []).includes(t), oth)))
    .reduce((a, b) => a + b, 0) / Math.max(1, finalTeams(i).length)
  const sfUnique = sfTeams(i).map(t => fieldStrength(t) * (1 - frac(o => (o.predictedSFTeams ?? []).includes(t), oth)))
    .reduce((a, b) => a + b, 0) / Math.max(1, sfTeams(i).length)

  // 3rd place winner leverage
  const thirdLev = fieldStrength(third(i)) * (1 - frac(o => o.predictedThirdPlaceWinner === third(i), oth))

  const bigLeverage = 25 * champLeverage + 25 * finalUnique + 16 * sfUnique + 20 * thirdLev

  // pairwise similarity: exact-score group overlap w/ the single most similar rival
  const maxPairSim = Math.max(...oth.map(o => {
    const oc = groupCells(o)
    const common = ids.filter(id => oc[id])
    if (!common.length) return 0
    return common.filter(id => oc[id].home === c[id].home && oc[id].away === c[id].away).length / common.length
  }))

  return {
    name: u.label, cheapConform, cheapDirConform, champ: champ(i), champOwn,
    champStrength, champLeverage, finalUnique, sfUnique, bigLeverage, maxPairSim,
  }
})

// combined "field-aware index": conform cheap (z) + leverage expensive (z)
const zConform = z(rows.map(r => r.cheapConform))
const zBig = z(rows.map(r => r.bigLeverage))
const fieldAwareIndex = rows.map((_, i) => zConform[i] + zBig[i])

console.log('\n=== CHAMPION OWNERSHIP (how many of 26 picked each champion) ===')
Object.entries(champCount).sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log(`  ${t.padEnd(16)} ${n}`))

console.log('\n=== FIELD-AWARE INDEX (high = conforms on cheap + unique-strong on expensive) ===')
console.log('name'.padEnd(22), 'idx'.padStart(6), 'cheapConf'.padStart(10), 'dirConf'.padStart(8), 'bigLev'.padStart(8), 'champ'.padStart(14), 'own'.padStart(6), 'str'.padStart(5))
rows.map((r, i) => ({ r, idx: fieldAwareIndex[i] }))
  .sort((a, b) => b.idx - a.idx)
  .forEach(({ r, idx }) => console.log(
    r.name.padEnd(22),
    idx.toFixed(2).padStart(6),
    r.cheapConform.toFixed(2).padStart(10),
    r.cheapDirConform.toFixed(2).padStart(8),
    r.bigLeverage.toFixed(1).padStart(8),
    r.champ.padStart(14),
    r.champOwn.toFixed(2).padStart(6),
    r.champStrength.toFixed(2).padStart(5),
  ))

console.log('\n=== PAIRWISE: most-similar rival (group exact overlap). Low = avoids duplicating anyone ===')
rows.map(r => r).sort((a, b) => a.maxPairSim - b.maxPairSim)
  .forEach(r => console.log(`  ${r.name.padEnd(22)} maxSim=${r.maxPairSim.toFixed(2)}`))

// ---------- CONFORMITY GRADIENT: conform cheap, diverge expensive ----------
// expensiveConform = ownership-weighted agreement on champion + finalists + SF
// (how much this user's big picks match the field). A field-aware win-optimizer
// wants cheapConform HIGH but expensiveConform LOW.
const expConform = USERS.map((_, i) => {
  const oth = others(i)
  const champA = frac(o => o.predictedChampion === champ(i), oth)
  const finA = finalTeams(i).map(t => frac(o => (o.predictedFinalTeams ?? []).includes(t), oth))
  const sfA = sfTeams(i).map(t => frac(o => (o.predictedSFTeams ?? []).includes(t), oth))
  const all = [champA, ...finA, ...sfA]
  return all.reduce((a, b) => a + b, 0) / all.length
})
function pct(vals: number[]) {
  return vals.map(v => vals.filter(x => x < v).length / (vals.length - 1))
}
const cheapPct = pct(rows.map(r => r.cheapConform))
const expPct = pct(expConform)
console.log('\n=== CONFORMITY GRADIENT (gap = cheapPct - expensivePct). High + = conforms cheap, diverges on the expensive slots (the field-aware win fingerprint) ===')
console.log('name'.padEnd(22), 'gap'.padStart(6), 'cheapPct'.padStart(9), 'expPct'.padStart(7), 'champLev'.padStart(9), 'finUniq'.padStart(8), 'sfUniq'.padStart(7))
rows.map((r, i) => ({ r, gap: cheapPct[i] - expPct[i], i }))
  .sort((a, b) => b.gap - a.gap)
  .forEach(({ r, gap }) => console.log(
    r.name.padEnd(22),
    gap.toFixed(2).padStart(6),
    cheapPct[rows.indexOf(r)].toFixed(2).padStart(9),
    expPct[rows.indexOf(r)].toFixed(2).padStart(7),
    r.champLeverage.toFixed(2).padStart(9),
    r.finalUnique.toFixed(2).padStart(8),
    r.sfUnique.toFixed(2).padStart(7),
  ))
