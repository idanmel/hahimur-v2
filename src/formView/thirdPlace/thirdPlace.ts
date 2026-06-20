import type { Standing, ThirdPlaceStanding, ThirdPlaceQualification } from '../../shared/types'
import { goalDifference, byOverallGD } from '../../shared/standings.ts'

// Rank third-placed teams: points, then overall goal difference, then goals scored.
export function sortThirdPlaceTeams(teams: ThirdPlaceStanding[]): ThirdPlaceStanding[] {
  return [...teams].sort((a, b) => b.points - a.points || byOverallGD(a, b))
}

// Returns each group's third-placed team, already ranked against each other so
// every consumer (display, qualification) gets them in the order that matters.
export function getThirdPlaceTeams(
  groupStandings: { group: string; standings: Standing[] }[]
): ThirdPlaceStanding[] {
  return sortThirdPlaceTeams(
    groupStandings
      .filter(g => g.standings.length >= 3)
      .map(g => ({ ...g.standings[2], group: g.group }))
  )
}

const QUALIFY_COUNT = 8

export function qualifyBestThirdPlace(
  teams: ThirdPlaceStanding[]
): ThirdPlaceQualification {
  const sorted = sortThirdPlaceTeams(teams)

  const eq = (x: ThirdPlaceStanding, y: ThirdPlaceStanding) =>
    x.points === y.points &&
    goalDifference(x) === goalDifference(y) &&
    x.goalsFor === y.goalsFor

  if (sorted.length > QUALIFY_COUNT && eq(sorted[QUALIFY_COUNT - 1], sorted[QUALIFY_COUNT])) {
    const tied = sorted.filter(t => eq(t, sorted[QUALIFY_COUNT - 1]))
    return { resolved: false, all: sorted, tied }
  }

  return { resolved: true, all: sorted, qualifiers: sorted.slice(0, QUALIFY_COUNT) }
}
