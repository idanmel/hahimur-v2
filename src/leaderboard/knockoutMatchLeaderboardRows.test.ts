// @vitest-environment node
import { expect, test } from 'vitest'
import type { GroupMatch, KnockoutMatch, MatchScores, TournamentResults } from '../shared/types'
import { buildKnockoutMatchLeaderboardRows } from './knockoutMatchLeaderboardRows'
import { OLEH_POINTS } from './points'
import { EMPTY_RESULTS, makeUser } from './testFixtures'

// One group match sets each bettor's pre-knockout base, then two R32 matches on
// consecutive days. R32 scores pagiya=5 / tzelifa=7; the group match pagiya=2 /
// tzelifa=4.
const A1: GroupMatch = { id: 'A1', homeTeam: 'X', awayTeam: 'Y', matchDate: '11 ביוני', kickoffIST: '19:00', scores: { home: 2, away: 1 } }

const m73: KnockoutMatch = { matchNum: 73, home: 'KOR', away: 'CAN', resolved: true, scores: { home: 1, away: 0 }, matchDate: '28 ביוני', kickoffIST: '22:00' }
const m74: KnockoutMatch = { matchNum: 74, home: 'GER', away: 'SCO', resolved: true, scores: { home: 2, away: 1 }, matchDate: '29 ביוני', kickoffIST: '23:30' }

const results: TournamentResults = {
  ...EMPTY_RESULTS,
  groupMatches: { A: [A1] },
  knockoutStages: { r32: [m73, m74], r16: [], qf: [], sf: [], thirdPlace: [], final: [] },
}

const ko = (matchNum: number, home: string, away: string, scores: MatchScores): KnockoutMatch =>
  ({ matchNum, home, away, resolved: true, scores })

const bettor = (label: string, a1: MatchScores, r32: KnockoutMatch[]) =>
  makeUser({
    label,
    predictions: { A1: a1 },
    groupMatches: { A: [{ ...A1, scores: a1 }] },
    knockoutStages: { r32, r16: [], qf: [], sf: [], thirdPlace: [], final: [] },
  })

// Both nail A1 (tzelifa, base 4). Alice nails both R32 (tzelifa 7 each). Bob
// misses 73, and stores 74 with the teams reversed but the same scoreline, so a
// correct orientation still scores it tzelifa.
const alice = bettor('Alice', { home: 2, away: 1 }, [
  ko(73, 'KOR', 'CAN', { home: 1, away: 0 }),
  ko(74, 'GER', 'SCO', { home: 2, away: 1 }),
])
const bob = bettor('Bob', { home: 2, away: 1 }, [
  ko(73, 'KOR', 'CAN', { home: 0, away: 1 }),
  ko(74, 'SCO', 'GER', { home: 1, away: 2 }), // reversed teams → oriented GER 2–1 SCO
])

test('row carries oriented prediction and this-match points, sorted by cumulative total', () => {
  const rows = buildKnockoutMatchLeaderboardRows([alice, bob], results, m73)
  expect(rows.map(r => r.label)).toEqual(['Alice', 'Bob'])
  // Through 73: Alice 4+7=11, Bob 4+0=4.
  expect(rows[0]).toMatchObject({ label: 'Alice', prediction: { home: 1, away: 0 }, matchPoints: 7, total: 11 })
  expect(rows[1]).toMatchObject({ label: 'Bob', prediction: { home: 0, away: 1 }, matchPoints: 0, total: 4 })
})

test('orients a reversed prediction to the actual fixture and scores it', () => {
  const rows = buildKnockoutMatchLeaderboardRows([alice, bob], results, m74)
  const bobRow = rows.find(r => r.label === 'Bob')!
  // Bob stored SCO 1–GER 2; oriented to GER home it reads 2–1 and scores tzelifa.
  expect(bobRow.prediction).toEqual({ home: 2, away: 1 })
  expect(bobRow.matchPoints).toBe(7)
})

test('cumulative total excludes later knockout matches', () => {
  const rows = buildKnockoutMatchLeaderboardRows([alice, bob], results, m73)
  // As of 73, Alice's later 74 tzelifa (7) must not leak in.
  expect(rows.find(r => r.label === 'Alice')!.total).toBe(11)
  // Through 74 it does: Alice 18, Bob 11.
  const later = buildKnockoutMatchLeaderboardRows([alice, bob], results, m74)
  expect(later.find(r => r.label === 'Alice')!.total).toBe(18)
  expect(later.find(r => r.label === 'Bob')!.total).toBe(11)
})

test('movement on the first knockout match compares against the group-final standings', () => {
  const rows = buildKnockoutMatchLeaderboardRows([alice, bob], results, m73)
  // Before 73 both sit on 4 (joint 1st). 73 lifts Alice clear; Bob drops to 2nd.
  expect(rows.find(r => r.label === 'Alice')!.placeMovement).toBe(0)
  expect(rows.find(r => r.label === 'Bob')!.placeMovement).toBe(-1)
})

test('lists every bettor — a non-predictor shows no prediction and zero points', () => {
  const carol = bettor('Carol', { home: 0, away: 0 }, []) // missed A1, predicted no KO
  const rows = buildKnockoutMatchLeaderboardRows([alice, bob, carol], results, m73)
  const carolRow = rows.find(r => r.label === 'Carol')!
  expect(carolRow.prediction).toBeNull()
  expect(carolRow.matchPoints).toBe(0)
  expect(carolRow.total).toBe(0)
})

test('credits advancement when this match\'s winner was predicted to reach the next round', () => {
  // Eve nails A1 (base 4) and the 73 scoreline (tzelifa 7), and foresaw KOR — the
  // actual 73 winner — reaching the R16, so she earns the R32 advancement bonus.
  const eve = makeUser({
    label: 'Eve',
    predictions: { A1: { home: 2, away: 1 } },
    groupMatches: { A: [{ ...A1, scores: { home: 2, away: 1 } }] },
    knockoutStages: { r32: [ko(73, 'KOR', 'CAN', { home: 1, away: 0 })], r16: [], qf: [], sf: [], thirdPlace: [], final: [] },
    predictedR16Teams: ['KOR'],
  })
  const row = buildKnockoutMatchLeaderboardRows([eve], results, m73).find(r => r.label === 'Eve')!
  expect(row.matchPoints).toBe(7)
  expect(row.advancementPoints).toBe(OLEH_POINTS.r32)
  // Advancement folds into the running total: base 4 + scoreline 7 + advancement 7.
  expect(row.total).toBe(18)
})

test('no advancement bonus when the winner was not among the predicted advancers', () => {
  // Alice predicted no R16 bracket, so her correct 73 scoreline earns no advancement.
  const row = buildKnockoutMatchLeaderboardRows([alice], results, m73).find(r => r.label === 'Alice')!
  expect(row.advancementPoints).toBe(0)
})

test('before the match is played points are zero, total holds the standing so far, no movement', () => {
  const m75 = ko(75, 'NED', 'MAR', { home: null, away: null })
  const pending: TournamentResults = {
    ...results,
    knockoutStages: { ...results.knockoutStages, r32: [m73, m74, { ...m75, resolved: true, matchDate: '30 ביוני', kickoffIST: '04:00' }] },
  }
  const rows = buildKnockoutMatchLeaderboardRows([alice, bob], pending, { ...m75, resolved: true, matchDate: '30 ביוני', kickoffIST: '04:00' })
  const aliceRow = rows.find(r => r.label === 'Alice')!
  expect(aliceRow.matchPoints).toBe(0)
  expect(aliceRow.placeMovement).toBeNull()
  // Cumulative still reflects the played 73 + 74 (Alice 18).
  expect(aliceRow.total).toBe(18)
})
