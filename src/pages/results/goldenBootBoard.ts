// Builds the Golden Boot race roster: the players picked by participants PLUS the
// real (possibly unpicked) leaders and close chasers pulled live from the ESPN
// feed. Pure and side-effect-free so its invariants are unit-tested.
//
// Invariants this protects (see GOLDEN_BOOT_RACE.md):
//  - Picked players ALWAYS appear (even at 0 goals) and render from their picked
//    goal tally — the exact number their points are scored from — so the board
//    can never contradict the points beside it.
//  - Unpicked players enter ONLY when within one goal of the lead (leaders +
//    chasers), rendered from the ESPN accumulation. Unpicked names never touch
//    playerGoals (that stays picked-only, upstream).
//  - The lead is computed across everyone (picked tally ∪ full ESPN totals) so a
//    real leader nobody picked still sets the bar.
//  - Rows are returned sorted by goals desc; ties keep picked-before-unpicked
//    order (JS sort is stable).

export interface RaceBoard {
  players: string[]
  realGoals: Record<string, number>
}

export function buildGoldenBootBoard(args: {
  pickedPlayers: string[] // Hebrew names, always shown
  pickedGoals: Record<string, number> // Hebrew -> goals (picked players' tally)
  espnTotals: Record<string, number> // raw ESPN Latin name -> goals (everyone)
  pickedEspnNames: Set<string> // ESPN names that are picked (excluded from unpicked)
  nameMap: Record<string, string> // ESPN Latin -> Hebrew (curated); Latin fallback
}): RaceBoard {
  const { pickedPlayers, pickedGoals, espnTotals, pickedEspnNames, nameMap } = args

  const unpicked = Object.entries(espnTotals).filter(([name]) => !pickedEspnNames.has(name))

  const lead = Math.max(
    0,
    ...pickedPlayers.map(p => pickedGoals[p] ?? 0),
    ...Object.values(espnTotals),
  )

  const players = [...pickedPlayers]
  const realGoals: Record<string, number> = {}
  for (const p of pickedPlayers) realGoals[p] = pickedGoals[p] ?? 0

  // Sort unpicked by goals desc so, when two map to the same Hebrew/fallback, the
  // higher tally wins; then keep only leaders + within-one chasers.
  for (const [espnName, goals] of unpicked.sort((a, b) => b[1] - a[1])) {
    if (goals <= 0 || goals < lead - 1) continue
    const he = nameMap[espnName] ?? espnName
    if (he in realGoals) continue // already shown (picked, or an earlier alias)
    players.push(he)
    realGoals[he] = goals
  }

  players.sort((a, b) => (realGoals[b] ?? 0) - (realGoals[a] ?? 0))
  return { players, realGoals }
}
