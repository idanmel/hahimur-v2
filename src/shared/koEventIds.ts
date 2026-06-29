// Pre-baked join from our knockout matchNum to the provider event ids, built by
// matching each fixture's kickoff UTC (every slot has a distinct minute) — so we
// hit fixed ids with no team-pairing, no name-aliasing, no waiting for the bracket
// to resolve. See KO_RESULTS_PIPELINE.md ("Mapping provider events → our matchNum").
//
// Round of 32 verified 2026-06-24; R16–Final added 2026-06-29 by re-pulling the
// full-tournament scoreboard window and joining by kickoff UTC. That re-pull also
// confirmed ESPN did NOT reissue the R32 ids when placeholder slots got real teams
// (the S3 caveat), so the whole bracket is stable.
export const KO_ESPN_IDS: Record<number, number> = {
  // Round of 32
  73: 760486, 74: 760489, 75: 760488, 76: 760487,
  77: 760492, 78: 760490, 79: 760491, 80: 760495,
  81: 760494, 82: 760493, 83: 760496, 84: 760497,
  85: 760498, 86: 760500, 87: 760501, 88: 760499,
  // Round of 16
  89: 760503, 90: 760502, 91: 760504, 92: 760505,
  93: 760506, 94: 760507, 95: 760509, 96: 760508,
  // Quarterfinals
  97: 760510, 98: 760511, 99: 760512, 100: 760513,
  // Semifinals
  101: 760514, 102: 760515,
  // Third place & Final
  103: 760516, 104: 760517,
}

const BY_ESPN_ID: Record<string, number> = Object.fromEntries(
  Object.entries(KO_ESPN_IDS).map(([num, id]) => [String(id), Number(num)]),
)

// An ESPN scoreboard event id → our knockout matchNum, or undefined when the id
// isn't a known knockout fixture (e.g. a group match, or a round not yet baked).
export function espnIdToMatchNum(espnId: string | undefined): number | undefined {
  return espnId == null ? undefined : BY_ESPN_ID[espnId]
}
