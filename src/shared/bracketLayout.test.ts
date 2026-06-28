import { test, expect } from 'vitest'
import { orderedRounds } from './bracketLayout'
import { tournamentResults } from '../tournament-results'

const nums = (ms: { matchNum: number }[]) => ms.map(m => m.matchNum)
const stages = tournamentResults.knockoutStages

test('orders every round in true bracket order, not by match number', () => {
  const r = orderedRounds(stages)
  expect(nums(r.sf)).toEqual([101, 102])
  expect(nums(r.qf)).toEqual([97, 98, 99, 100])
  expect(nums(r.r16)).toEqual([89, 90, 93, 94, 91, 92, 95, 96])
  // the R32 column is deliberately NOT in plain 73→88 order
  expect(nums(r.r32)).toEqual([74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87])
})

test('keeps all 16 R32 fixtures, each once', () => {
  const r = orderedRounds(stages)
  expect([...nums(r.r32)].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => 73 + i))
})
