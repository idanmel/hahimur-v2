import { describe, it, expect } from 'vitest'
import { americanToImplied, marketOutcomeOdds, marketAdvanceOdds, hasMarketLine } from './marketOdds'

describe('americanToImplied', () => {
  it('converts positive (underdog) money lines', () => {
    expect(americanToImplied(100)).toBeCloseTo(0.5, 6)
    expect(americanToImplied(150)).toBeCloseTo(0.4, 6)
  })

  it('converts negative (favourite) money lines', () => {
    expect(americanToImplied(-200)).toBeCloseTo(2 / 3, 6)
    expect(americanToImplied(-144)).toBeCloseTo(144 / 244, 6)
  })
})

describe('marketOutcomeOdds', () => {
  it('returns null for a fixture with no posted line', () => {
    expect(marketOutcomeOdds('Spain', 'Qatar')).toBeNull()
  })

  it('is a de-vigged distribution that sums to 1', () => {
    const o = marketOutcomeOdds('Spain', 'France')!
    expect(o.homeWin + o.draw + o.awayWin).toBeCloseTo(1, 6)
  })

  it('mirrors home/away when the sides are swapped', () => {
    const a = marketOutcomeOdds('Spain', 'France')!
    const b = marketOutcomeOdds('France', 'Spain')!
    expect(a.homeWin).toBeCloseTo(b.awayWin, 6)
    expect(a.awayWin).toBeCloseTo(b.homeWin, 6)
    expect(a.draw).toBeCloseTo(b.draw, 6)
  })

  it('has France as the market favourite over Spain', () => {
    // Book: France +135 vs Spain +220 → France the shorter (more likely) price.
    const o = marketOutcomeOdds('France', 'Spain')!
    expect(o.homeWin).toBeGreaterThan(o.awayWin)
  })
})

describe('marketAdvanceOdds', () => {
  it('returns null for a fixture with no posted line', () => {
    expect(marketAdvanceOdds('Spain', 'Qatar')).toBeNull()
  })

  it('sums to 1 and favours France to advance', () => {
    const o = marketAdvanceOdds('France', 'Spain')!
    expect(o.home + o.away).toBeCloseTo(1, 6)
    expect(o.home).toBeGreaterThan(0.5)
    expect(o.home).toBeCloseTo(0.563, 2) // France -144 / Spain +118, de-vigged
  })
})

describe('England–Argentina (semifinal 2)', () => {
  it('has a de-vigged 3-way that sums to 1', () => {
    const o = marketOutcomeOdds('England', 'Argentina')!
    expect(o.homeWin + o.draw + o.awayWin).toBeCloseTo(1, 6)
  })

  it('makes England the razor-thin advance favourite (-114 vs -106)', () => {
    const o = marketAdvanceOdds('England', 'Argentina')!
    expect(o.home + o.away).toBeCloseTo(1, 6)
    expect(o.home).toBeGreaterThan(o.away)
    expect(o.home).toBeCloseTo(0.509, 2)
  })
})

describe('hasMarketLine', () => {
  it('is true for a fixture on file (either order) and false otherwise', () => {
    expect(hasMarketLine('Spain', 'France')).toBe(true)
    expect(hasMarketLine('France', 'Spain')).toBe(true)
    expect(hasMarketLine('England', 'Argentina')).toBe(true)
    expect(hasMarketLine('Spain', 'Qatar')).toBe(false)
  })
})
