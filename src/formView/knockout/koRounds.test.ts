import { roundKeyForMatch, isPairing, predictedPairing } from './koRounds'
import type { KnockoutMatch, KnockoutStages } from '../../shared/types'

const km = (matchNum: number, home: string, away: string, scores?: KnockoutMatch['scores']): KnockoutMatch =>
  ({ matchNum, home, away, resolved: true, scores })

const stages = (over: Partial<KnockoutStages>): KnockoutStages =>
  ({ r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [], ...over })

describe('roundKeyForMatch', () => {
  it('maps each match number to its round', () => {
    expect(roundKeyForMatch(73)).toBe('r32')
    expect(roundKeyForMatch(88)).toBe('r32')
    expect(roundKeyForMatch(89)).toBe('r16')
    expect(roundKeyForMatch(100)).toBe('qf')
    expect(roundKeyForMatch(102)).toBe('sf')
    expect(roundKeyForMatch(103)).toBe('thirdPlace')
    expect(roundKeyForMatch(104)).toBe('final')
  })

  it('returns undefined for a group-stage or out-of-range number', () => {
    expect(roundKeyForMatch(72)).toBeUndefined()
    expect(roundKeyForMatch(105)).toBeUndefined()
  })
})

describe('isPairing', () => {
  it('matches the two teams in either order', () => {
    expect(isPairing(km(73, 'Brazil', 'England'), 'Brazil', 'England')).toBe(true)
    expect(isPairing(km(73, 'England', 'Brazil'), 'Brazil', 'England')).toBe(true)
  })

  it('does not match a different pairing or an empty slot', () => {
    expect(isPairing(km(73, 'Brazil', 'France'), 'Brazil', 'England')).toBe(false)
    expect(isPairing(km(73, '', ''), 'Brazil', 'England')).toBe(false)
  })
})

describe('predictedPairing', () => {
  const actual = km(83, 'Portugal', 'Croatia')

  it('finds the pairing predicted at a different slot of the same round', () => {
    // bettor routed Portugal × Croatia through slot 87, reality through 83
    const ks = stages({ r32: [km(87, 'Portugal', 'Croatia', { home: 2, away: 1 })] })
    const m = predictedPairing(ks, actual)
    expect(m?.matchNum).toBe(87)
  })

  it('ignores the same pairing predicted in a different round', () => {
    const ks = stages({ r16: [km(89, 'Portugal', 'Croatia')] })
    expect(predictedPairing(ks, actual)).toBeUndefined()
  })

  it('returns undefined when the bettor did not predict the pairing', () => {
    const ks = stages({ r32: [km(83, 'Portugal', 'Ghana')] })
    expect(predictedPairing(ks, actual)).toBeUndefined()
  })
})
