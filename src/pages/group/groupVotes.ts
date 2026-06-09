import { GROUPS } from '../../shared/groups'
import { calculateStandings } from '../../shared/standings'
import type { User } from '../../users'

export type GroupVotes = Record<string, number[]>
export type GroupVotePickers = Record<string, string[][]>


export function computeGroupVotes(users: User[], groupLetter: string): GroupVotes {
  if (users.length === 0) return {}

  const votes: GroupVotes = {}

  for (const user of users) {
    const { standings } = calculateStandings(GROUPS[groupLetter].matches, user.predictions)
    if (standings.every(s => s.played === 0)) continue
    standings.forEach((standing, position) => {
      if (!votes[standing.team]) votes[standing.team] = [0, 0, 0, 0]
      votes[standing.team][position]++
    })
  }

  return votes
}

export function computeGroupVotePickers(users: User[], groupLetter: string): GroupVotePickers {
  if (users.length === 0) return {}

  const pickers: GroupVotePickers = {}

  for (const user of users) {
    const { standings } = calculateStandings(GROUPS[groupLetter].matches, user.predictions)
    if (standings.every(s => s.played === 0)) continue
    standings.forEach((standing, position) => {
      if (!pickers[standing.team]) pickers[standing.team] = [[], [], [], []]
      pickers[standing.team][position].push(user.label)
    })
  }

  return pickers
}

export function computeGroupR32Pickers(
  users: User[],
  groupLetter: string
): Record<string, string[]> {
  const groupTeams = new Set<string>()
  for (const match of GROUPS[groupLetter].matches) {
    groupTeams.add(match.homeTeam)
    groupTeams.add(match.awayTeam)
  }

  const result: Record<string, string[]> = {}
  for (const team of groupTeams) result[team] = []

  for (const user of users) {
    for (const match of user.knockoutStages.r32) {
      if (groupTeams.has(match.home)) result[match.home].push(user.label)
      if (groupTeams.has(match.away)) result[match.away].push(user.label)
    }
  }

  return result
}
