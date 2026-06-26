// @vitest-environment node
// The race is anchored to the canonical scorer via resultsAsOf snapshots, so its
// numbers can never drift from the leaderboard. These guard that contract
// against the real tournament data.
import { describe, expect, test } from 'vitest'
import { tournamentResults as R } from '../tournament-results'
import { USERS } from '../users'
import { computeUserPoints } from './points'
import { playedMatchesChrono, resultsAsOf } from './resultsAsOf'
import { buildRaceFrames } from './raceFrames'

describe('resultsAsOf anchors the race to the leaderboard', () => {
  const chrono = playedMatchesChrono(R)

  test('final snapshot reproduces the live leaderboard total for every user', () => {
    const snap = resultsAsOf(R, chrono, chrono.length)
    for (const user of USERS) {
      expect(computeUserPoints(user, snap).total, user.label).toBe(computeUserPoints(user, R).total)
    }
  })

  test('every race frame equals computeUserPoints over its snapshot', () => {
    const frames = buildRaceFrames(USERS, R)
    expect(frames.length).toBe(chrono.length)
    for (let i = 1; i <= chrono.length; i++) {
      const snap = resultsAsOf(R, chrono, i)
      const bars = new Map(frames[i - 1].bars.map(b => [b.label, b.total]))
      for (const user of USERS) {
        expect(bars.get(user.label), `frame ${i} (${chrono[i - 1].id}) ${user.label}`).toBe(computeUserPoints(user, snap).total)
      }
    }
  })

  test('totals never decrease frame to frame', () => {
    const frames = buildRaceFrames(USERS, R)
    for (const user of USERS) {
      const totals = frames.map(f => f.bars.find(b => b.label === user.label)!.total)
      for (let i = 1; i < totals.length; i++) {
        expect(totals[i], `${user.label} frame ${i + 1}`).toBeGreaterThanOrEqual(totals[i - 1])
      }
    }
  })
})
