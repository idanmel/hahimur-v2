import type { TournamentResults } from '../shared/types'
import type { User } from '../users'

export const EMPTY_RESULTS: TournamentResults = {
  groupMatches: {},
  groupTables: {},
  thirdPlaceQualification: { resolved: false, all: [], tied: [] },
  knockoutStages: { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] },
}

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    label: 'Test',
    predictions: {},
    topGoalscorer: '',
    groupMatches: {},
    groupTables: {},
    thirdPlaceQualification: { resolved: false, all: [], tied: [] },
    knockoutStages: { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] },
    ...overrides,
  }
}
