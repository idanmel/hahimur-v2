import { describe, it, expect } from 'vitest'
import { isAnyLive } from './useLiveScores'

// L1 kicks off '17 ביוני' 23:00 Israel time = 2026-06-17T20:00Z, window is 6h.
const L1 = { id: 'L1', matchDate: '17 ביוני', kickoffIST: '23:00' }
const L2 = { id: 'L2', matchDate: '18 ביוני', kickoffIST: '02:00' }

describe('isAnyLive', () => {
  it('is true while a not-yet-final match is inside its window', () => {
    expect(isAnyLive([L1], new Set(), new Date('2026-06-17T21:00:00Z'))).toBe(true)
  })

  it('is false before kickoff', () => {
    expect(isAnyLive([L1], new Set(), new Date('2026-06-17T19:00:00Z'))).toBe(false)
  })

  it('is false after the window has elapsed', () => {
    expect(isAnyLive([L1], new Set(), new Date('2026-06-18T02:30:00Z'))).toBe(false)
  })

  it('ignores matches that already have a final baked score', () => {
    const finals = new Set(['L1'])
    expect(isAnyLive([L1], finals, new Date('2026-06-17T21:00:00Z'))).toBe(false)
  })

  it('is true if any match in the list is live', () => {
    const now = new Date('2026-06-18T00:30:00Z') // L2 window (kickoff 2026-06-17T23:00Z)
    expect(isAnyLive([L1, L2], new Set(), now)).toBe(true)
  })

  it('gates on a knockout fixture too (keyed by matchNum)', () => {
    // matchNum 73 kicks off 28 ביוני 22:00 IST = 2026-06-28T19:00Z.
    const ko = { id: '73', matchDate: '28 ביוני', kickoffIST: '22:00' }
    expect(isAnyLive([ko], new Set(), new Date('2026-06-28T19:30:00Z'))).toBe(true)
    expect(isAnyLive([ko], new Set(['73']), new Date('2026-06-28T19:30:00Z'))).toBe(false)
  })
})
