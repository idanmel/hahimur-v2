import type { User } from '../../users/index'
import { TEAMS } from '../../shared/groups'

interface TeamFinalStat {
  team: string
  championPickers: string[]
  runnerUpPickers: string[]
  total: number
}

export function computeFinalStats(users: User[]): TeamFinalStat[] {
  const map = new Map<string, { championPickers: string[]; runnerUpPickers: string[] }>()

  const get = (team: string) => {
    if (!map.has(team)) map.set(team, { championPickers: [], runnerUpPickers: [] })
    return map.get(team)!
  }

  for (const user of users) {
    if (user.predictedChampion) {
      get(user.predictedChampion).championPickers.push(user.label)
    }
    if (user.predictedFinalTeams && user.predictedChampion) {
      const runnerUp = user.predictedFinalTeams.find(t => t !== user.predictedChampion)
      if (runnerUp) get(runnerUp).runnerUpPickers.push(user.label)
    }
  }

  return [...map.entries()]
    .map(([team, { championPickers, runnerUpPickers }]) => ({
      team,
      championPickers,
      runnerUpPickers,
      total: championPickers.length + runnerUpPickers.length,
    }))
    .sort((a, b) => {
      const diff = b.total - a.total
      return diff !== 0 ? diff : b.championPickers.length - a.championPickers.length
    })
}

interface FinalMatchup {
  teams: [string, string]
  wins: [number, number]
  winnerPickers: [string[], string[]]
}

export function computeFinalMatchups(users: User[]): FinalMatchup[] {
  const map = new Map<string, { teams: [string, string]; wins: [number, number]; winnerPickers: [string[], string[]] }>()

  for (const user of users) {
    if (user.predictedFinalTeams?.length === 2) {
      const sorted = [...user.predictedFinalTeams].sort() as [string, string]
      const key = sorted.join('|')
      if (!map.has(key)) map.set(key, { teams: sorted, wins: [0, 0], winnerPickers: [[], []] })
      const entry = map.get(key)!
      if (user.predictedChampion === sorted[0]) {
        entry.wins[0]++
        entry.winnerPickers[0].push(user.label)
      } else if (user.predictedChampion === sorted[1]) {
        entry.wins[1]++
        entry.winnerPickers[1].push(user.label)
      }
    }
  }

  return [...map.values()].sort((a, b) => {
    const totalA = a.wins[0] + a.wins[1]
    const totalB = b.wins[0] + b.wins[1]
    return totalB - totalA
  })
}

export interface TeamStageStat {
  team: string
  r32: string[]
  r16: string[]
  qf: string[]
  sf: string[]
  final: string[]
  thirdPlace: string[]
  champion: string[]
}

export function computeTeamStageStats(users: User[]): TeamStageStat[] {
  const counts: Record<string, { r32: string[]; r16: string[]; qf: string[]; sf: string[]; final: string[]; thirdPlace: string[]; champion: string[] }> = {}

  const get = (team: string) => {
    if (!counts[team]) counts[team] = { r32: [], r16: [], qf: [], sf: [], final: [], thirdPlace: [], champion: [] }
    return counts[team]
  }

  for (const team of Object.keys(TEAMS)) get(team)

  for (const user of users) {
    for (const match of user.knockoutStages.r32) {
      get(match.home).r32.push(user.label)
      get(match.away).r32.push(user.label)
    }
    for (const team of user.predictedR16Teams ?? []) get(team).r16.push(user.label)
    for (const team of user.predictedQFTeams ?? []) get(team).qf.push(user.label)
    for (const team of user.predictedSFTeams ?? []) get(team).sf.push(user.label)
    for (const team of user.predictedFinalTeams ?? []) get(team).final.push(user.label)
    if (user.predictedThirdPlaceWinner) get(user.predictedThirdPlaceWinner).thirdPlace.push(user.label)
    if (user.predictedChampion) get(user.predictedChampion).champion.push(user.label)
  }

  return Object.entries(counts)
    .map(([team, c]) => ({ team, ...c }))
    .sort((a, b) => {
      const score = (x: TeamStageStat) => x.champion.length * 6 + x.final.length * 5 + x.sf.length * 4 + x.qf.length * 3 + x.r16.length * 2 + x.r32.length
      return score(b) - score(a)
    })
}

interface GoalScorerStat {
  player: string
  pickers: string[]
}

export function computeGoalScorerStats(users: User[]): GoalScorerStat[] {
  const map = new Map<string, string[]>()
  for (const user of users) {
    if (user.topGoalscorer) {
      if (!map.has(user.topGoalscorer)) map.set(user.topGoalscorer, [])
      map.get(user.topGoalscorer)!.push(user.label)
    }
  }
  return [...map.entries()]
    .map(([player, pickers]) => ({ player, pickers }))
    .sort((a, b) => b.pickers.length - a.pickers.length)
}
