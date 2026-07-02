// Builds the Golden Boot race roster: the players picked by participants PLUS
// every real (possibly unpicked) contender pulled live from the ESPN feed.
// Pure and side-effect-free so its invariants are unit-tested.
//
// Invariants this protects (see GOLDEN_BOOT_RACE.md):
//  - Picked players ALWAYS appear (even at 0 goals) and render from their picked
//    goal tally — the exact number their points are scored from — so the board
//    can never contradict the points beside it.
//  - Unpicked players enter ONLY at RACE_BOARD_MIN_GOALS goals or more, rendered
//    from the ESPN accumulation. Unpicked names never touch playerGoals (that
//    stays picked-only, upstream).
//  - An unpicked player whose team is eliminated AND who trails the lead is
//    dropped entirely: his tally is frozen below a total he can't reach, and no
//    participant's points depend on him. An eliminated player AT the lead stays —
//    he can still (co-)win, which is exactly what denies everyone the bonus.
//  - Rows are returned sorted by goals desc; ties keep picked-before-unpicked
//    order (JS sort is stable).

// The bar an unpicked player must clear to enter the board.
export const RACE_BOARD_MIN_GOALS = 4

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
  teamByPlayer?: Record<string, string> // display name -> national team (curated)
  eliminatedTeams?: Set<string> // teams already out of the tournament
}): RaceBoard {
  const { pickedPlayers, pickedGoals, espnTotals, pickedEspnNames, nameMap } = args
  const teamByPlayer = args.teamByPlayer ?? {}
  const eliminatedTeams = args.eliminatedTeams ?? new Set<string>()

  const unpicked = Object.entries(espnTotals).filter(([name]) => !pickedEspnNames.has(name))

  // The lead across everyone (picked tally ∪ full ESPN totals) — an eliminated
  // unpicked player is dropped only when he trails it.
  const lead = Math.max(
    0,
    ...pickedPlayers.map(p => pickedGoals[p] ?? 0),
    ...Object.values(espnTotals),
  )

  const players = [...pickedPlayers]
  const realGoals: Record<string, number> = {}
  for (const p of pickedPlayers) realGoals[p] = pickedGoals[p] ?? 0

  // Sort unpicked by goals desc so, when two map to the same Hebrew/fallback, the
  // higher tally wins; then keep only those at the minimum-goals bar or above.
  for (const [espnName, goals] of unpicked.sort((a, b) => b[1] - a[1])) {
    if (goals < RACE_BOARD_MIN_GOALS) continue
    const he = nameMap[espnName] ?? espnName
    const team = teamByPlayer[he]
    if (team != null && eliminatedTeams.has(team) && goals < lead) continue
    if (he in realGoals) continue // already shown (picked, or an earlier alias)
    players.push(he)
    realGoals[he] = goals
  }

  players.sort((a, b) => (realGoals[b] ?? 0) - (realGoals[a] ?? 0))
  return { players, realGoals }
}
