// @vitest-environment node
import { describe, test, expect } from 'vitest'
import { computeFinalStats, computeFinalMatchups, computeTeamStageStats } from './stats'
import type { User } from '../../users/index'
import type { ThirdPlaceQualification, KnockoutStages, GroupMatch } from '../../shared/types'

const emptyKO: KnockoutStages = { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] }
const emptyTP: ThirdPlaceQualification = { resolved: false, all: [], tied: [] }

function makeUser(
  label: string,
  predictedChampion: string,
  predictedFinalTeams?: string[],
  predictedSFTeams?: string[],
  predictedQFTeams?: string[],
  predictedR16Teams?: string[],
): User {
  return {
    label,
    predictions: {},
    topGoalscorer: '',
    groupTables: {},
    thirdPlaceQualification: emptyTP,
    groupMatches: {} as Record<string, GroupMatch[]>,
    knockoutStages: emptyKO,
    predictedChampion,
    predictedFinalTeams,
    predictedSFTeams,
    predictedQFTeams,
    predictedR16Teams,
  }
}

const USERS: User[] = [
  makeUser('עידן', 'France', ['France', 'Brazil']),
  makeUser('ינייב', 'France', ['France', 'Argentina']),
  makeUser('תומר', 'France', ['France', 'Argentina']),
  makeUser('אורן', 'Brazil', ['France', 'Brazil']),
  makeUser('אלדד', 'Brazil', ['France', 'Brazil']),
  makeUser('טל', 'Portugal', ['Spain', 'Portugal']),
  makeUser('אלרד', 'Portugal', ['France', 'Portugal']),
  makeUser('רועי', 'Spain', ['Spain', 'Portugal']),
]

describe('computeFinalStats', () => {
  test('each team appears exactly once', () => {
    const result = computeFinalStats(USERS)
    const teams = result.map(r => r.team)
    expect(new Set(teams).size).toBe(teams.length)
  })

  test('France has 3 champion picks and 3 runner-up picks', () => {
    const france = computeFinalStats(USERS).find(r => r.team === 'France')!
    expect(france.championPickers).toHaveLength(3)
    expect(france.runnerUpPickers).toHaveLength(3)
  })

  test('Argentina has 0 champion picks and 2 runner-up picks', () => {
    const arg = computeFinalStats(USERS).find(r => r.team === 'Argentina')!
    expect(arg.championPickers).toHaveLength(0)
    expect(arg.runnerUpPickers).toHaveLength(2)
  })

  test('France total is 6 and appears before Argentina', () => {
    const result = computeFinalStats(USERS)
    expect(result.find(r => r.team === 'France')!.total).toBe(6)
    expect(result.findIndex(r => r.team === 'France')).toBeLessThan(result.findIndex(r => r.team === 'Argentina'))
  })

  test('France champion pickers include correct names', () => {
    const france = computeFinalStats(USERS).find(r => r.team === 'France')!
    expect(france.championPickers).toContain('עידן')
    expect(france.championPickers).toContain('ינייב')
    expect(france.championPickers).toContain('תומר')
  })
})

describe('computeFinalMatchups', () => {
  test('returns 4 unique matchups', () => {
    expect(computeFinalMatchups(USERS)).toHaveLength(4)
  })

  test('France vs Brazil has total count 3 and appears before France vs Argentina', () => {
    const result = computeFinalMatchups(USERS)
    const fb = result.find(m => m.teams.includes('France') && m.teams.includes('Brazil'))!
    expect(fb.wins[0] + fb.wins[1]).toBe(3)
    const fbIdx = result.findIndex(m => m.teams.includes('France') && m.teams.includes('Brazil'))
    const faIdx = result.findIndex(m => m.teams.includes('France') && m.teams.includes('Argentina'))
    expect(fbIdx).toBeLessThan(faIdx)
  })

  test('France vs Brazil winner pickers include correct names', () => {
    const result = computeFinalMatchups(USERS)
    const fb = result.find(m => m.teams.includes('France') && m.teams.includes('Brazil'))!
    const allPickers = [...fb.winnerPickers[0], ...fb.winnerPickers[1]]
    expect(allPickers).toContain('עידן')
    expect(allPickers).toContain('אורן')
    expect(allPickers).toContain('אלדד')
  })
})

const STAGE_USERS: User[] = [
  makeUser('א', 'France', ['France', 'Brazil'], ['France', 'Brazil', 'Germany', 'Spain'], ['France', 'Brazil', 'Germany', 'Spain', 'Argentina', 'Portugal', 'England', 'Netherlands'], ['France', 'Brazil', 'Germany', 'Spain', 'Argentina', 'Portugal', 'England', 'Netherlands', 'Belgium', 'Italy', 'Japan', 'Morocco', 'Uruguay', 'Mexico', 'Denmark', 'Australia']),
  makeUser('ב', 'France', ['France', 'Germany'], ['France', 'Germany', 'Brazil', 'Spain'], ['France', 'Germany', 'Brazil', 'Spain', 'Argentina', 'Portugal', 'England', 'Netherlands'], ['France', 'Germany', 'Brazil', 'Spain', 'Argentina', 'Portugal', 'England', 'Netherlands', 'Belgium', 'Italy', 'Japan', 'Morocco', 'Uruguay', 'Mexico', 'Denmark', 'Australia']),
  makeUser('ג', 'Brazil', ['France', 'Brazil'], ['France', 'Brazil', 'Germany', 'Argentina'], ['France', 'Brazil', 'Germany', 'Argentina', 'Spain', 'Portugal', 'England', 'Netherlands'], ['France', 'Brazil', 'Germany', 'Argentina', 'Spain', 'Portugal', 'England', 'Netherlands', 'Belgium', 'Italy', 'Japan', 'Morocco', 'Uruguay', 'Mexico', 'Denmark', 'Australia']),
]

describe('computeTeamStageStats', () => {
  test('France has r16 count 3 and champion count 2', () => {
    const france = computeTeamStageStats(STAGE_USERS).find(r => r.team === 'France')!
    expect(france.r16).toHaveLength(3)
    expect(france.champion).toHaveLength(2)
  })

  test('Brazil has final count 2 and champion count 1', () => {
    const brazil = computeTeamStageStats(STAGE_USERS).find(r => r.team === 'Brazil')!
    expect(brazil.final).toHaveLength(2)
    expect(brazil.champion).toHaveLength(1)
  })

  test('France appears before Germany (higher score)', () => {
    const result = computeTeamStageStats(STAGE_USERS)
    expect(result.findIndex(r => r.team === 'France')).toBeLessThan(result.findIndex(r => r.team === 'Germany'))
  })

  test('r32 counts teams from knockoutStages.r32', () => {
    const user: User = {
      label: 'test', predictions: {}, topGoalscorer: '', groupTables: {},
      thirdPlaceQualification: emptyTP, groupMatches: {} as Record<string, GroupMatch[]>,
      knockoutStages: { ...emptyKO, r32: [
        { matchNum: 1, home: 'France', away: 'Germany', resolved: false },
        { matchNum: 2, home: 'Brazil', away: 'Spain', resolved: false },
      ]},
      predictedChampion: 'France', predictedFinalTeams: ['France', 'Brazil'],
    }
    const result = computeTeamStageStats([user])
    expect(result.find(r => r.team === 'France')!.r32).toHaveLength(1)
    expect(result.find(r => r.team === 'Germany')!.r32).toHaveLength(1)
  })
})
