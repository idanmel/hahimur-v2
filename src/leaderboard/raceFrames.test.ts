// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { buildRaceFrames } from './raceFrames'
import { makeUser } from './testFixtures'
import type { TournamentResults } from '../shared/types'

// Two played group matches in chronological order; two bettors with known hits.
// Group A: A1 = Mexico 2–0 South Africa, A2 = South Korea 1–1 Czech Republic.
const results: TournamentResults = {
  groupMatches: {
    A: [
      { id: 'A1', homeTeam: 'Mexico', awayTeam: 'South Africa', matchDate: '11 ביוני', kickoffIST: '22:00', scores: { home: 2, away: 0 } },
      { id: 'A2', homeTeam: 'South Korea', awayTeam: 'Czech Republic', matchDate: '12 ביוני', kickoffIST: '05:00', scores: { home: 1, away: 1 } },
    ],
  },
  // Left incomplete on purpose: no advancement/place awarded, so this test
  // isolates the cumulative per-match scoring.
  groupTables: {},
  thirdPlaceQualification: { resolved: false, all: [], tied: [] },
  knockoutStages: { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] },
}

// Alice nails both exactly (4 + 4). Bob gets the direction right both times (2 + 2).
const alice = makeUser({ label: 'Alice', groupMatches: { A: [
  { id: 'A1', homeTeam: 'Mexico', awayTeam: 'South Africa', scores: { home: 2, away: 0 } },
  { id: 'A2', homeTeam: 'South Korea', awayTeam: 'Czech Republic', scores: { home: 1, away: 1 } },
] } })
const bob = makeUser({ label: 'Bob', groupMatches: { A: [
  { id: 'A1', homeTeam: 'Mexico', awayTeam: 'South Africa', scores: { home: 1, away: 0 } },
  { id: 'A2', homeTeam: 'South Korea', awayTeam: 'Czech Republic', scores: { home: 0, away: 0 } },
] } })

describe('buildRaceFrames', () => {
  test('one frame per played group match, in chronological order', () => {
    const frames = buildRaceFrames([alice, bob], results)
    expect(frames.map(f => f.matchId)).toEqual(['A1', 'A2'])
    expect(frames.map(f => f.date)).toEqual(['11 ביוני', '12 ביוני'])
  })

  test('each frame carries the match result as a caption', () => {
    const [first] = buildRaceFrames([alice, bob], results)
    expect(first.matchLabel).toBe('מקסיקו 2–0 דרום אפריקה')
  })

  test('bars hold each bettor cumulative total, sorted high to low', () => {
    const frames = buildRaceFrames([alice, bob], results)
    expect(frames[0].bars).toEqual([
      { label: 'Alice', total: 4 },
      { label: 'Bob', total: 2 },
    ])
    expect(frames[1].bars).toEqual([
      { label: 'Alice', total: 8 },
      { label: 'Bob', total: 4 },
    ])
  })

  test('a bettor total never decreases from frame to frame (cumulative)', () => {
    const frames = buildRaceFrames([alice, bob], results)
    for (const label of ['Alice', 'Bob']) {
      const totals = frames.map(f => f.bars.find(b => b.label === label)!.total)
      for (let i = 1; i < totals.length; i++) expect(totals[i]).toBeGreaterThanOrEqual(totals[i - 1])
    }
  })

  test('no played matches yields no frames', () => {
    const empty: TournamentResults = { ...results, groupMatches: {} }
    expect(buildRaceFrames([alice, bob], empty)).toEqual([])
  })
})
