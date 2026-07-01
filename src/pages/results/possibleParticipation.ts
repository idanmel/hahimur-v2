import type { KnockoutStages, MatchScores, TournamentResults } from '../../shared/types'
import type { User } from '../../users'
import { TEAMS } from '../../shared/groups'
import { allKO } from '../../formView/knockout/koRounds'
import { eliminatedTeams } from '../forms/compareStats'
import { ancestorAt, convergeRound, teamR32Map } from '../forms/survivorsStats'

// The bettor's still-possible bet on one future match: the two teams they
// predicted to meet there, and the scoreline they gave (if any). Shown in the
// bracket beside the "עדיין אפשרי" frame.
export interface PossiblePred {
  home: string
  away: string
  scores?: MatchScores
}

// The winners'-path rounds we can still project a meeting into, paired with their
// bracket depth (r16 = 1 … final = 4). R32 (depth 0) is settled the moment the
// groups finish, so there is never a "still possible" R32 slot. The third-place
// match is handled separately below — it's fed by the two beaten semi-finalists,
// not by a winners' path, so the "converge on this slot" rule doesn't apply to it.
const PROJECTABLE_ROUNDS: { key: keyof KnockoutStages; round: number }[] = [
  { key: 'r16', round: 1 },
  { key: 'qf', round: 2 },
  { key: 'sf', round: 3 },
  { key: 'final', round: 4 },
]

// Bracket depth of the semi-finals — the round whose losers contest third place.
const SF_ROUND = 3
// The real third-place fixture's match number.
const THIRD_PLACE_MATCH = 103

/**
 * Future knockout matches the bettor can *still* participate in: an unresolved
 * fixture where a pairing they predicted for that round is still on the table —
 * both teams are alive and their real bracket paths converge exactly at that
 * slot, so the two could yet meet there.
 *
 * This is the future-facing twin of the resolved-only "משתתף" marker. The two
 * are mutually exclusive by construction: a slot is either already resolved (and
 * a candidate for "משתתף") or still open (and a candidate for "עדיין אפשרי").
 *
 * Consistent with how knockout predictions score — credit for a pairing lands
 * wherever its two teams meet within the round (see {@link predictedPairing}) —
 * so "still possible" means "these two can still meet in this round", located to
 * the real slot their paths lead to.
 */
export function possibleParticipation(
  user: User,
  results: TournamentResults,
): { ids: Set<string>; predictions: Record<string, PossiblePred> } {
  const bracket = allKO(results.knockoutStages)
  const out = eliminatedTeams(results)
  const realR32 = teamR32Map(bracket)
  const realByNum = new Map(bracket.map(m => [m.matchNum, m]))

  const ids = new Set<string>()
  const predictions: Record<string, PossiblePred> = {}

  for (const { key, round } of PROJECTABLE_ROUNDS) {
    for (const pm of user.knockoutStages[key] ?? []) {
      const home = pm.home
      const away = pm.away
      // Both sides must be real teams the bettor actually named (not placeholders).
      if (!(home in TEAMS) || !(away in TEAMS)) continue
      // A busted pick — one team already knocked out — can't come back.
      if (out.has(home) || out.has(away)) continue
      const rh = realR32.get(home)
      const ra = realR32.get(away)
      if (rh == null || ra == null) continue
      // They must be able to meet *in this round* — no earlier, no later.
      if (convergeRound([rh, ra]) !== round) continue
      const slot = ancestorAt(rh, round) // == ancestorAt(ra, round)
      const real = realByNum.get(slot)
      if (!real || real.resolved) continue // resolved slots belong to "משתתף"
      const id = String(slot)
      ids.add(id)
      predictions[id] = { home, away, scores: pm.scores ?? undefined }
    }
  }

  // Third place is contested by the two beaten semi-finalists — one from each half
  // of the draw. So a bettor's predicted third-place pairing is still on the table
  // when both teams are alive and sit in *different* semi-finals: each can reach its
  // own semi, lose it, and meet the other here. (Same-half picks would meet in the
  // semi or earlier, so they could never both be the two losing semi-finalists.)
  const third = user.knockoutStages.thirdPlace?.[0]
  const realThird = realByNum.get(THIRD_PLACE_MATCH)
  if (third && realThird && !realThird.resolved && third.home in TEAMS && third.away in TEAMS
      && !out.has(third.home) && !out.has(third.away)) {
    const rh = realR32.get(third.home)
    const ra = realR32.get(third.away)
    if (rh != null && ra != null && ancestorAt(rh, SF_ROUND) !== ancestorAt(ra, SF_ROUND)) {
      const id = String(THIRD_PLACE_MATCH)
      ids.add(id)
      predictions[id] = { home: third.home, away: third.away, scores: third.scores ?? undefined }
    }
  }

  return { ids, predictions }
}
