import type { KnockoutMatch, KnockoutStages } from './types'

// The knockout tree: each match number → the two earlier matches whose winners
// meet in it. Mirrors the wiring in resolveKnockout (formView/knockout/knockout.ts),
// kept here as plain data so the bracket view can lay rounds out in true bracket
// order. The R32 matches (73–88) are the leaves, so they don't appear as keys.
export const KO_CHILDREN: Record<number, [number, number]> = {
  104: [101, 102],
  101: [97, 98],   102: [99, 100],
  97: [89, 90],    98: [93, 94],    99: [91, 92],    100: [95, 96],
  89: [74, 77],    90: [73, 75],    93: [83, 84],    94: [81, 82],
  91: [76, 78],    92: [79, 80],    95: [86, 88],    96: [85, 87],
}

// Left-to-right leaf order: the R32 match numbers in the order their winners stack
// down a classic bracket. DFS, left child before right.
function leaves(root: number): number[] {
  const kids = KO_CHILDREN[root]
  return kids ? [...leaves(kids[0]), ...leaves(kids[1])] : [root]
}

const LEAF_ORDER = leaves(104)
// A match sorts by where its first descendant leaf falls — so every round reads
// top-to-bottom in the same order the bracket would draw it, and no lines cross.
const leafRank = (n: number) => LEAF_ORDER.indexOf(leaves(n)[0])

export type OrderedRounds = Record<'r32' | 'r16' | 'qf' | 'sf', KnockoutMatch[]>

// Every round laid out as one column, top-to-bottom in true bracket order, so a
// match in one column lines up between the pair that feeds it in the column before.
export function orderedRounds(stages: KnockoutStages): OrderedRounds {
  const byOrder = (ms: KnockoutMatch[]) =>
    [...ms].sort((a, b) => leafRank(a.matchNum) - leafRank(b.matchNum))
  return { r32: byOrder(stages.r32), r16: byOrder(stages.r16), qf: byOrder(stages.qf), sf: byOrder(stages.sf) }
}
