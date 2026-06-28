// Pre-baked join from our knockout matchNum to the provider event ids, built by
// matching each fixture's kickoff UTC (every slot has a distinct minute) — so we
// hit fixed ids with no team-pairing, no name-aliasing, no waiting for the bracket
// to resolve. See KO_RESULTS_PIPELINE.md ("Mapping provider events → our matchNum").
//
// Round of 32 verified 2026-06-24. Generate later rounds the same way (pull each
// round's scoreboard window, join by kickoff UTC) once the group stage is done.
export const KO_ESPN_IDS: Record<number, number> = {
  73: 760486, 74: 760489, 75: 760488, 76: 760487,
  77: 760492, 78: 760490, 79: 760491, 80: 760495,
  81: 760494, 82: 760493, 83: 760496, 84: 760497,
  85: 760498, 86: 760500, 87: 760501, 88: 760499,
}

const BY_ESPN_ID: Record<string, number> = Object.fromEntries(
  Object.entries(KO_ESPN_IDS).map(([num, id]) => [String(id), Number(num)]),
)

// An ESPN scoreboard event id → our knockout matchNum, or undefined when the id
// isn't a known knockout fixture (e.g. a group match, or a round not yet baked).
export function espnIdToMatchNum(espnId: string | undefined): number | undefined {
  return espnId == null ? undefined : BY_ESPN_ID[espnId]
}
