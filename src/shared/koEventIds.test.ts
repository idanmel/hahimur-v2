import { describe, it, expect } from 'vitest'
import { KO_ESPN_IDS, espnIdToMatchNum } from './koEventIds'

describe('KO ESPN event id table', () => {
  it('maps the R32 opener (matchNum 73) to its ESPN event id', () => {
    expect(KO_ESPN_IDS[73]).toBe(760486)
  })

  it('round-trips an event id back to its matchNum', () => {
    expect(espnIdToMatchNum('760486')).toBe(73)
    expect(espnIdToMatchNum('760499')).toBe(88)
  })

  it('returns undefined for an unknown event id (e.g. a group match)', () => {
    expect(espnIdToMatchNum('999999')).toBeUndefined()
  })

  it('covers all 16 round-of-32 fixtures with distinct ids', () => {
    const nums = Object.keys(KO_ESPN_IDS).map(Number)
    expect(nums).toEqual(expect.arrayContaining(Array.from({ length: 16 }, (_, i) => 73 + i)))
    expect(new Set(Object.values(KO_ESPN_IDS)).size).toBe(16)
  })
})
