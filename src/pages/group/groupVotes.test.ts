import { computeGroupVotes, computeGroupR32Pickers } from './groupVotes'
import type { User } from '../../users'

const BASE: Pick<User, 'groupMatches' | 'groupTables' | 'thirdPlaceQualification' | 'knockoutStages'> = {
  groupMatches: {},
  groupTables: {},
  thirdPlaceQualification: { resolved: true, all: [], qualifiers: [] },
  knockoutStages: { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] },
}

const southAfricaFirst: User = {
  ...BASE,
  label: 'Test 2',
  topGoalscorer: '',
  predictions: {
    A1: { home: 0, away: 3 }, // South Africa beats Mexico
    A2: { home: 1, away: 0 }, // South Korea beats Czech Republic
    A3: { home: 0, away: 3 }, // South Africa beats Czech Republic
    A4: { home: 0, away: 1 }, // South Korea beats Mexico
    A5: { home: 0, away: 1 }, // Mexico beats Czech Republic
    A6: { home: 3, away: 0 }, // South Africa beats South Korea
  },
}

const mexicoFirst: User = {
  ...BASE,
  label: 'Test',
  topGoalscorer: '',
  predictions: {
    A1: { home: 3, away: 0 }, // Mexico beats South Africa
    A2: { home: 1, away: 0 }, // South Korea beats Czech Republic
    A3: { home: 0, away: 1 }, // South Africa beats Czech Republic
    A4: { home: 3, away: 0 }, // Mexico beats South Korea
    A5: { home: 0, away: 3 }, // Mexico beats Czech Republic
    A6: { home: 1, away: 0 }, // South Africa beats South Korea
  },
}

test('returns nothing when there are no users', () => {
  expect(computeGroupVotes([], 'A')).toEqual({})
})

test('returns 1 first-place vote for Mexico when 1 user predicts Mexico finishing first', () => {
  const votes = computeGroupVotes([mexicoFirst], 'A')
  expect(votes['Mexico'][0]).toBe(1)
})

test('returns 1 first-place vote for each team when 2 users predict different winners', () => {
  const votes = computeGroupVotes([mexicoFirst, southAfricaFirst], 'A')
  expect(votes['Mexico'][0]).toBe(1)
  expect(votes['South Africa'][0]).toBe(1)
})

test('returns 2 first-place votes for Mexico when 2 users both predict Mexico first', () => {
  const votes = computeGroupVotes([mexicoFirst, mexicoFirst], 'A')
  expect(votes['Mexico'][0]).toBe(2)
})

test('returns correct 2nd-place vote when 1 user predicts Mexico first', () => {
  const votes = computeGroupVotes([mexicoFirst], 'A')
  expect(votes['South Africa'][1]).toBe(1)
})

test('ignores a user with no predictions', () => {
  const noPredictions: User = { ...BASE, label: 'Empty', topGoalscorer: '', predictions: {} }
  expect(computeGroupVotes([noPredictions], 'A')).toEqual({})
})

const withR32: User = {
  ...BASE,
  label: 'R32User',
  topGoalscorer: '',
  predictions: {},
  knockoutStages: {
    ...BASE.knockoutStages,
    r32: [
      { matchNum: 1, home: 'Mexico', away: 'South Korea', resolved: false },
    ],
  },
}

test('computeGroupR32Pickers: team in r32 gets the picker', () => {
  const result = computeGroupR32Pickers([withR32], 'A')
  expect(result['Mexico']).toContain('R32User')
  expect(result['South Korea']).toContain('R32User')
})

test('computeGroupR32Pickers: team not in r32 has empty list', () => {
  const result = computeGroupR32Pickers([withR32], 'A')
  expect(result['South Africa']).toHaveLength(0)
  expect(result['Czech Republic']).toHaveLength(0)
})

test('computeGroupR32Pickers: returns all group teams with empty lists when no users', () => {
  const result = computeGroupR32Pickers([], 'A')
  expect(result).toEqual({
    'Mexico': [],
    'South Africa': [],
    'South Korea': [],
    'Czech Republic': [],
  })
})
