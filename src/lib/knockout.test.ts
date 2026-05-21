import { describe, it, expect } from 'vitest'
import { resolveKnockout } from './knockout'
import type { R32Match } from '../types'

const unresolvedR32 = (matchNum: number): R32Match => ({
  matchNum, home: `Home${matchNum}`, away: `Away${matchNum}`, resolved: false,
})

const resolvedR32 = (matchNum: number, home: string, away: string): R32Match => ({
  matchNum, home, away, resolved: true,
})

describe('resolveKnockout', () => {
  it('returns correct structure with empty R32 input', () => {
    const result = resolveKnockout([], {})
    expect(result.r16).toHaveLength(8)
    expect(result.qf).toHaveLength(4)
    expect(result.sf).toHaveLength(2)
    expect(result.thirdPlace).toBeDefined()
    expect(result.final).toBeDefined()
  })

  it('r16[0] (match 89) is fed by winners of matches 74 and 77; placeholders when R32 unresolved', () => {
    const r32 = [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88].map(unresolvedR32)
    const { r16 } = resolveKnockout(r32, {})
    const m89 = r16[0]
    expect(m89.matchNum).toBe(89)
    expect(m89.home).toBe('מנצח 74')
    expect(m89.away).toBe('מנצח 77')
    expect(m89.resolved).toBe(false)
  })

  it('home win: home team advances to next round', () => {
    const r32 = [
      resolvedR32(74, 'TeamA', 'TeamB'),
      ...([73, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88].map(unresolvedR32)),
    ]
    const predictions = { '74': { home: 2, away: 1 } }
    const { r16 } = resolveKnockout(r32, predictions)
    const m89 = r16[0]
    expect(m89.home).toBe('TeamA')
    expect(m89.resolved).toBe(false) // away (match 77) still unresolved
  })

  it('away win: away team advances to next round', () => {
    const r32 = [
      resolvedR32(74, 'TeamA', 'TeamB'),
      ...([73, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88].map(unresolvedR32)),
    ]
    const predictions = { '74': { home: 1, away: 2 } }
    const { r16 } = resolveKnockout(r32, predictions)
    expect(r16[0].home).toBe('TeamB')
  })

  it('draw: next-round slot stays as placeholder', () => {
    const r32 = [
      resolvedR32(74, 'TeamA', 'TeamB'),
      ...([73, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88].map(unresolvedR32)),
    ]
    const predictions = { '74': { home: 1, away: 1 } }
    const { r16 } = resolveKnockout(r32, predictions)
    expect(r16[0].home).toBe('מנצח 74')
    expect(r16[0].resolved).toBe(false)
  })

  it('loser of SF match 101 becomes thirdPlace.home', () => {
    const r32 = Array.from({ length: 16 }, (_, i) =>
      resolvedR32(73 + i, `T${73 + i}`, `U${73 + i}`)
    )
    // Home wins all R32 and R16 through QF; then SF 101 has away win
    const predictions: Record<string, { home: number; away: number }> = {}
    for (let n = 73; n <= 100; n++) predictions[String(n)] = { home: 2, away: 0 }
    predictions['101'] = { home: 0, away: 2 }  // away team of 101 wins → home team is loser
    predictions['102'] = { home: 2, away: 0 }

    const { thirdPlace, sf } = resolveKnockout(r32, predictions)
    // sf[0] = match 101; its home team lost
    expect(thirdPlace.home).toBe(sf[0].home)
    expect(thirdPlace.resolved).toBe(true)
  })

  it('full chain: Final resolves when all matches have decisive predictions', () => {
    // 16 resolved R32 matches with distinct home teams named T73..T88
    const r32 = Array.from({ length: 16 }, (_, i) =>
      resolvedR32(73 + i, `T${73 + i}`, `U${73 + i}`)
    )
    // Decisive predictions: home always wins (score 2-0) for every match 73–102
    const predictions: Record<string, { home: number; away: number }> = {}
    for (let n = 73; n <= 102; n++) predictions[String(n)] = { home: 2, away: 0 }

    const { final } = resolveKnockout(r32, predictions)
    expect(final.resolved).toBe(true)
    // Winner of 101 and 102 should be real team names, not placeholders
    expect(final.home).not.toMatch(/^מנצח/)
    expect(final.away).not.toMatch(/^מנצח/)
  })
})
