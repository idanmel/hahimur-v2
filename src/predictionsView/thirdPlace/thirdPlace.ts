import type { Standing, ThirdPlaceStanding, ThirdPlaceQualification } from '../../shared/types'
import { goalDifference, byOverallGD } from '../../shared/standings'

export function getThirdPlaceTeams(
  groupStandings: { group: string; standings: Standing[] }[]
): ThirdPlaceStanding[] {
  return groupStandings
    .filter(g => g.standings.length >= 3)
    .map(g => ({ ...g.standings[2], group: g.group }))
}

const QUALIFY_COUNT = 8

export function qualifyBestThirdPlace(
  teams: ThirdPlaceStanding[]
): ThirdPlaceQualification {
  const sorted = [...teams].sort((a, b) => b.points - a.points || byOverallGD(a, b))

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
