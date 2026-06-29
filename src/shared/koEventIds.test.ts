import { describe, it, expect } from 'vitest'
import { KO_ESPN_IDS, espnIdToMatchNum } from './koEventIds'

describe('KO ESPN event id table', () => {
  it('maps the R32 opener (matchNum 73) to its ESPN event id', () => {
    expect(KO_ESPN_IDS[73]).toBe(760486)
  })

  it('round-trips an event id back to its matchNum', () => {
    expect(espnIdToMatchNum('760486')).toBe(73)
    expect(espnIdToMatchNum('760499')).toBe(88)
    expect(espnIdToMatchNum('760517')).toBe(104) // the final
  })

  it('returns undefined for an unknown event id (e.g. a group match)', () => {
    expect(espnIdToMatchNum('999999')).toBeUndefined()
  })

  it('covers every knockout fixture (R32 through the final) with distinct ids', () => {
    const nums = Object.keys(KO_ESPN_IDS).map(Number)
    // matchNums 73–104: R32 (16) + R16 (8) + QF (4) + SF (2) + 3rd + final = 32
    expect(nums).toEqual(expect.arrayContaining(Array.from({ length: 32 }, (_, i) => 73 + i)))
    expect(nums).toHaveLength(32)
    expect(new Set(Object.values(KO_ESPN_IDS)).size).toBe(32)
  })
})
