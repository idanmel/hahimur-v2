// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { isUnpredicted } from './types'

describe('isUnpredicted', () => {
  test('returns true when home is null', () => {
    expect(isUnpredicted({ home: null, away: 1 })).toBe(true)
  })

  test('returns true when away is null', () => {
    expect(isUnpredicted({ home: 2, away: null })).toBe(true)
  })

  test('returns true when both are null', () => {
    expect(isUnpredicted({ home: null, away: null })).toBe(true)
  })

  test('returns false when both scores are filled', () => {
    expect(isUnpredicted({ home: 2, away: 1 })).toBe(false)
  })
})
