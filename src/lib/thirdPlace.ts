import type { Standing, ThirdPlaceStanding, ThirdPlaceQualification } from '../types'
import { goalDifference, byOverallGD } from './standings'

export function getThirdPlaceTeams(
  groupStandings: { group: string; standings: Standing[] }[]
): ThirdPlaceStanding[] {
  return groupStandings
    .filter(g => g.standings.length >= 3)
    .map(g => ({ ...g.standings[2], group: g.group }))
}

export function qualifyBestThirdPlace(
  teams: ThirdPlaceStanding[]
): ThirdPlaceQualification {
  const sorted = [...teams].sort((a, b) => b.points - a.points || byOverallGD(a, b))

  const eq = (x: ThirdPlaceStanding, y: ThirdPlaceStanding) =>
    x.points === y.points &&
    goalDifference(x) === goalDifference(y) &&
    x.goalsFor === y.goalsFor

  const tied = sorted.filter((t, i, arr) =>
    (arr[i - 1] && eq(t, arr[i - 1])) || (arr[i + 1] && eq(t, arr[i + 1]))
  )

  if (tied.length > 0) return { resolved: false, all: sorted, tied }
  return { resolved: true, qualifiers: sorted.slice(0, 8) }
}
