import type { TournamentResults, PredictionsState } from '../../shared/types'

export function clampGoals(real: number, entered: number): number {
  return Math.max(real, entered)
}

// "הכל צליפות": every match not already decided resolves exactly as YOU
// predicted, while played (locked) matches keep their real outcome. The name
// says what it does — your whole bet comes true, so you score צליפה on every
// undecided match — and deliberately NOT "best case", because it is neither a
// guaranteed points-maximum nor a guarantee of finishing first.
//
// Caveat worth remembering: the knockout bracket is re-derived from the group
// tables, and locked real results can flip a group's seeding versus the table
// you predicted. When that happens a team can slide into a bracket slot you
// meant for someone else and inherit the scorelines you stored there — so the
// played-out bracket may not be the one you pictured, and may even bank points
// for a team you never expected to advance (e.g. Colombia riding Portugal's
// winner-path once its real 3–1 makes it top group K instead of runner-up).
export function allTzelifotResults(
  base: PredictionsState,
  myPredictions: PredictionsState,
  lockedIds: Set<string>,
): PredictionsState {
  const next: PredictionsState = {}
  for (const id of Object.keys(base)) {
    next[id] = lockedIds.has(id) ? base[id] : (myPredictions[id] ?? base[id])
  }
  return next
}

export function getLockedMatchIds(results: TournamentResults): Set<string> {
  return new Set<string>([
    ...Object.values(results.groupMatches).flat()
      .filter(m => m.scores?.home != null && m.scores?.away != null)
      .map(m => m.id),
    ...Object.values(results.knockoutStages).flat()
      .filter(m => m.scores?.home != null && m.scores?.away != null)
      .map(m => String(m.matchNum)),
  ])
}
