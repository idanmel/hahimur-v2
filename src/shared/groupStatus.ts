import type { PredictionsState, Standing } from './types'
import { GROUP_MATCHES, ALL_GROUP_LETTERS } from './groups.ts'
import { calculateStandings } from './standings.ts'

export type GroupStatus = {
  group: string
  standings: Standing[]
  tiedTeams: Set<string>
  allFilled: boolean
  isComplete: boolean
}

export type GroupsDerivation = {
  allGroupData: GroupStatus[]
  groupsWithTies: Set<string>
  completedGroups: Set<string>
  allGroupsFilled: boolean
}

// Pure per-group status across all groups: standings, the unresolvable-tie set,
// whether every match is filled, and whether the group is "complete" (filled
// with no tie). The hard tie/standings math lives in calculateStandings; this
// layer just rolls it up into the flags the form UI flips classes on.
export function deriveGroupStatus(predictions: PredictionsState): GroupsDerivation {
  const allGroupData = ALL_GROUP_LETTERS
    .filter(l => l in GROUP_MATCHES)
    .map(l => {
      const matches = GROUP_MATCHES[l] ?? []
      const { standings, tiedTeams } = calculateStandings(matches, predictions)
      const allFilled = matches.length > 0 && matches.every(m => {
        const s = predictions[m.id]
        return s && s.home !== null && s.away !== null
      })
      return { group: l as string, standings, tiedTeams, allFilled, isComplete: allFilled && tiedTeams.size === 0 }
    })

  const groupsWithTies = new Set<string>()
  const completedGroups = new Set<string>()
  for (const d of allGroupData) {
    if (d.allFilled && d.tiedTeams.size > 0) groupsWithTies.add(d.group)
    if (d.isComplete) completedGroups.add(d.group)
  }
  const allGroupsFilled = allGroupData.every(d => d.allFilled)

  return { allGroupData, groupsWithTies, completedGroups, allGroupsFilled }
}
