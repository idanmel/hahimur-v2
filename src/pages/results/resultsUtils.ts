import type { TournamentResults } from '../../shared/types'

export function clampGoals(real: number, entered: number): number {
  return Math.max(real, entered)
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
