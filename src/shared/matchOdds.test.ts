import { describe, it, expect } from 'vitest'
import { matchOutcomeOdds, advanceOdds, hasOdds } from './matchOdds'

const sum3 = (o: { homeWin: number; draw: number; awayWin: number }) => o.homeWin + o.draw + o.awayWin

describe('matchOutcomeOdds', () => {
  it('is a proper distribution that sums to 1', () => {
    expect(sum3(matchOutcomeOdds('Spain', 'Qatar'))).toBeCloseTo(1, 6)
    expect(sum3(matchOutcomeOdds('Germany', 'Brazil'))).toBeCloseTo(1, 6)
  })

  it('makes the much stronger team the clear favourite', () => {
    const o = matchOutcomeOdds('Spain', 'Qatar')
    expect(o.homeWin).toBeGreaterThan(0.7)
    expect(o.homeWin).toBeGreaterThan(o.awayWin)
  })

  it('is (near) symmetric when the sides swap, up to the host edge', () => {
    // Two non-host sides: swapping home/away just mirrors the win/lose legs.
    const a = matchOutcomeOdds('France', 'Croatia')
    const b = matchOutcomeOdds('Croatia', 'France')
    expect(a.homeWin).toBeCloseTo(b.awayWin, 6)
    expect(a.awayWin).toBeCloseTo(b.homeWin, 6)
    expect(a.draw).toBeCloseTo(b.draw, 6)
  })

  it('gives two evenly-matched sides near-equal win legs', () => {
    const o = matchOutcomeOdds('Argentina', 'Argentina')
    expect(o.homeWin).toBeCloseTo(o.awayWin, 6)
    expect(o.draw).toBeGreaterThan(0)
  })

  it('applies the host edge — the host is favoured over an equal rival', () => {
    // Mexico and Switzerland share the same rating, but Mexico hosts.
    const hosted = matchOutcomeOdds('Mexico', 'Switzerland')
    const neutral = matchOutcomeOdds('Switzerland', 'Switzerland')
    expect(hosted.homeWin).toBeGreaterThan(neutral.homeWin)
  })
})

describe('advanceOdds', () => {
  it('sums to 1 — someone always goes through', () => {
    const o = advanceOdds('Spain', 'Qatar')
    expect(o.home + o.away).toBeCloseTo(1, 6)
  })

  it('splits an even tie ~50/50', () => {
    const o = advanceOdds('Brazil', 'Brazil')
    expect(o.home).toBeCloseTo(0.5, 6)
  })

  it('advancing is at least as likely as winning in regulation (draw splits help)', () => {
    const win = matchOutcomeOdds('Spain', 'Qatar').homeWin
    const adv = advanceOdds('Spain', 'Qatar').home
    expect(adv).toBeGreaterThanOrEqual(win)
  })
})

describe('hasOdds', () => {
  it('is true for two rated teams and false for a placeholder slot', () => {
    expect(hasOdds('Spain', 'Qatar')).toBe(true)
    expect(hasOdds('Spain', 'מנצח 74')).toBe(false)
  })
})
