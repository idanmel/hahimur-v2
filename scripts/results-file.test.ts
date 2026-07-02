import { describe, expect, test } from 'vitest'
import { parseKoScores, renderKoScores, readRealGoals } from './results-file.ts'
import { tournamentResults } from '../src/tournament-results.ts'

// A predicted/real knockout score is the regulation (90') score; drawWinner names
// the advancer when regulation ended level. These prove the results-file format
// round-trips both shapes — crucially the advancer on a regulation draw.
const empty = `const koScores: Record<string, MatchScores> = {
}`

describe('koScores parse/render', () => {
  test('empty block parses to {}', () => {
    expect(parseKoScores(empty)).toEqual({})
  })

  test('round-trips a decisive regulation score', () => {
    const scores = { '73': { home: 1, away: 0 } }
    expect(parseKoScores(renderKoScores(empty, scores))).toEqual(scores)
  })

  test('round-trips a regulation draw with an advancer', () => {
    const scores = { '79': { home: 1, away: 1, drawWinner: 'home' as const } }
    expect(parseKoScores(renderKoScores(empty, scores))).toEqual(scores)
  })

  test('round-trips a 0-0 advanced on penalties', () => {
    const scores = { '78': { home: 0, away: 0, drawWinner: 'away' as const } }
    expect(parseKoScores(renderKoScores(empty, scores))).toEqual(scores)
  })

  test('renders multiple matches, mixed decisive and draw-advancer', () => {
    const scores = {
      '73': { home: 1, away: 0 },
      '78': { home: 0, away: 0, drawWinner: 'away' as const },
      '79': { home: 1, away: 1, drawWinner: 'home' as const },
    }
    expect(parseKoScores(renderKoScores(empty, scores))).toEqual(scores)
  })

  test('overwrites a previously rendered block (idempotent re-render)', () => {
    const once = renderKoScores(empty, { '73': { home: 1, away: 0 } })
    const twice = renderKoScores(once, { '73': { home: 2, away: 1 } })
    expect(parseKoScores(twice)).toEqual({ '73': { home: 2, away: 1 } })
  })
})

describe('real goals', () => {
  // The cron writes real goals and the app ships them; both must see the exact
  // same data, whatever the storage format is.
  test('the cron reads the same real-goals data the app ships', () => {
    expect(readRealGoals()).toEqual(tournamentResults.playerMatchGoals)
  })
})
