import { describe, test, expect } from 'vitest'
import type { PodiumByAdvancer } from '../../../sim-core'
import { pickPivotal } from './pivotalPick'

// Minimal PodiumByAdvancer factory — only the fields pickPivotal reads matter.
function m(over: Partial<PodiumByAdvancer> & Pick<PodiumByAdvancer, 'matchNum' | 'teamA' | 'teamB'>): PodiumByAdvancer {
  return {
    podiumIfA: 0, podiumIfB: 0, podiumBaseline: 0,
    winIfA: 0, winIfB: 0, winBaseline: 0,
    nA: 2000, nB: 2000,
    ...over,
  }
}

describe('pickPivotal', () => {
  test('frames the higher outcome as "better", rounds the swing, orders by swing', () => {
    const cards = pickPivotal([
      m({ matchNum: 10, teamA: 'AAA', teamB: 'BBB', podiumIfA: 0.40, podiumIfB: 0.20 }), // swing 20
      m({ matchNum: 11, teamA: 'CCC', teamB: 'DDD', podiumIfA: 0.10, podiumIfB: 0.35 }), // swing 25
    ], 'podium')
    expect(cards).toHaveLength(2)
    // Bigger swing first.
    expect(cards[0].matchNum).toBe(11)
    expect(cards[0].better.teamHe).toBe('DDD')
    expect(cards[0].worse.teamHe).toBe('CCC')
    expect(cards[0].better.podiumPct).toBeCloseTo(35)
    expect(cards[0].swing).toBe(25)
    expect(cards[1].matchNum).toBe(10)
    expect(cards[1].better.teamHe).toBe('AAA')
  })

  test('carries both finishes on every outcome, whatever the ranking metric', () => {
    const [card] = pickPivotal([
      m({ matchNum: 5, teamA: 'AAA', teamB: 'BBB', winIfA: 0.30, winIfB: 0.05, podiumIfA: 0.85, podiumIfB: 0.60 }),
    ], 'win')
    expect(card.better.teamHe).toBe('AAA')
    expect(card.better.winPct).toBeCloseTo(30)
    expect(card.better.podiumPct).toBeCloseTo(85)
    expect(card.worse.winPct).toBeCloseTo(5)
    expect(card.worse.podiumPct).toBeCloseTo(60)
  })

  test('drops foregone conclusions (underdog advances too rarely)', () => {
    const cards = pickPivotal([
      m({ matchNum: 1, teamA: 'AAA', teamB: 'BBB', podiumIfA: 0.5, podiumIfB: 0.1, nA: 3800, nB: 200 }), // 5% underdog
    ], 'podium')
    expect(cards).toHaveLength(0)
  })

  test('drops fixtures that barely move the viewer (swing under 3pp)', () => {
    const cards = pickPivotal([
      m({ matchNum: 1, teamA: 'AAA', teamB: 'BBB', podiumIfA: 0.31, podiumIfB: 0.30 }),
    ], 'podium')
    expect(cards).toHaveLength(0)
  })

  test('reads the win metric when asked, and respects the limit', () => {
    const cards = pickPivotal([
      m({ matchNum: 1, teamA: 'AAA', teamB: 'BBB', winIfA: 0.30, winIfB: 0.05, podiumIfA: 0.5, podiumIfB: 0.5 }),
      m({ matchNum: 2, teamA: 'CCC', teamB: 'DDD', winIfA: 0.20, winIfB: 0.05 }),
    ], 'win', 1)
    expect(cards).toHaveLength(1)
    expect(cards[0].matchNum).toBe(1)
    expect(cards[0].better.winPct).toBeCloseTo(30)
  })
})
