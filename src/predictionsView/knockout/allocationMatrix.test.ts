import { describe, it, expect } from 'vitest'
import { ALLOCATION_MATRIX } from './allocationMatrix'

const SLOTS = ['1A', '1B', '1D', '1E', '1G', '1I', '1K', '1L'] as const
const ALL_GROUPS = 'ABCDEFGHIJKL'.split('')

// C(12,8) = 495
function allCombinations(): string[] {
  const result: string[] = []
  function pick(start: number, chosen: string[]) {
    if (chosen.length === 8) { result.push(chosen.join('')); return }
    for (let i = start; i < ALL_GROUPS.length; i++) {
      pick(i + 1, [...chosen, ALL_GROUPS[i]])
    }
  }
  pick(0, [])
  return result
}

describe('ALLOCATION_MATRIX', () => {
  it('has exactly 495 entries', () => {
    expect(Object.keys(ALLOCATION_MATRIX)).toHaveLength(495)
  })

  it('has all C(12,8) = 495 group combinations as keys', () => {
    const expected = allCombinations()
    expect(expected).toHaveLength(495)
    for (const combo of expected) {
      expect(ALLOCATION_MATRIX).toHaveProperty(combo)
    }
  })

  it('every key is 8 sorted distinct letters from A-L', () => {
    for (const key of Object.keys(ALLOCATION_MATRIX)) {
      expect(key).toHaveLength(8)
      const letters = key.split('')
      expect(letters).toEqual([...letters].sort())
      expect(new Set(letters).size).toBe(8)
      for (const letter of letters) {
        expect(ALL_GROUPS).toContain(letter)
      }
    }
  })

  it('every entry has all 8 winner slots', () => {
    for (const [key, entry] of Object.entries(ALLOCATION_MATRIX)) {
      for (const slot of SLOTS) {
        expect(entry, `key=${key}`).toHaveProperty(slot)
      }
    }
  })

  it('every matchup is a 3rd-place team from one of the 8 qualifying groups', () => {
    for (const [key, entry] of Object.entries(ALLOCATION_MATRIX)) {
      const qualifiers = new Set(key.split(''))
      for (const slot of SLOTS) {
        const opp = entry[slot]
        expect(opp, `key=${key} slot=${slot}`).toMatch(/^3[A-L]$/)
        expect(qualifiers, `key=${key} slot=${slot} opp=${opp}`).toContain(opp[1])
      }
    }
  })

  it('each qualifying group appears exactly once across the 8 matchups (bijection)', () => {
    for (const [key, entry] of Object.entries(ALLOCATION_MATRIX)) {
      const qualifiers = key.split('')
      const assigned = SLOTS.map(s => entry[s][1])
      expect(assigned.sort(), `key=${key}`).toEqual([...qualifiers].sort())
    }
  })

  // Spot checks from Annex C of the FIFA WC 2026 tournament regulations
  // via https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage
  describe('spot checks against official source (Annex C)', () => {
    it('combination 1 (EFGHIJKL): correct matchups', () => {
      const e = ALLOCATION_MATRIX['EFGHIJKL']
      expect(e['1A']).toBe('3E')
      expect(e['1B']).toBe('3J')
      expect(e['1D']).toBe('3I')
      expect(e['1E']).toBe('3F')
      expect(e['1G']).toBe('3H')
      expect(e['1I']).toBe('3G')
      expect(e['1K']).toBe('3L')
      expect(e['1L']).toBe('3K')
    })

    it('combination 2 (DFGHIJKL): correct matchups', () => {
      const e = ALLOCATION_MATRIX['DFGHIJKL']
      expect(e['1A']).toBe('3H')
      expect(e['1B']).toBe('3G')
      expect(e['1D']).toBe('3I')
      expect(e['1E']).toBe('3D')
      expect(e['1G']).toBe('3J')
      expect(e['1I']).toBe('3F')
      expect(e['1K']).toBe('3L')
      expect(e['1L']).toBe('3K')
    })

    it('combination 495 (ABCDEFGH): correct matchups', () => {
      const e = ALLOCATION_MATRIX['ABCDEFGH']
      expect(e['1A']).toBe('3H')
      expect(e['1B']).toBe('3G')
      expect(e['1D']).toBe('3B')
      expect(e['1E']).toBe('3C')
      expect(e['1G']).toBe('3A')
      expect(e['1I']).toBe('3F')
      expect(e['1K']).toBe('3D')
      expect(e['1L']).toBe('3E')
    })
  })
})
