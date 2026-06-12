import { competitionRanks } from './rank'

const byScore = (r: { score: number }) => r.score

test('distinct scores get sequential ranks', () => {
  const rows = [{ score: 10 }, { score: 8 }, { score: 5 }]
  expect(competitionRanks(rows, byScore)).toEqual([1, 2, 3])
})

test('tied scores share a rank and the next rank skips', () => {
  const rows = [{ score: 10 }, { score: 8 }, { score: 8 }, { score: 5 }]
  expect(competitionRanks(rows, byScore)).toEqual([1, 2, 2, 4])
})

test('a tie at first place leaves no second place', () => {
  const rows = [{ score: 10 }, { score: 10 }, { score: 8 }]
  expect(competitionRanks(rows, byScore)).toEqual([1, 1, 3])
})

test('three-way tie', () => {
  const rows = [{ score: 7 }, { score: 7 }, { score: 7 }, { score: 1 }]
  expect(competitionRanks(rows, byScore)).toEqual([1, 1, 1, 4])
})

test('empty rows give empty ranks', () => {
  expect(competitionRanks([], byScore)).toEqual([])
})
