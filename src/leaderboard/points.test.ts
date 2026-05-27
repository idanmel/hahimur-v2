import { describe, expect, test } from 'vitest'
import type { PredictionsState, KnockoutMatch } from '../shared/types'
import { calculateUserPoints, calculateKnockoutMatchPoints } from './points'

const NO_RESULTS: PredictionsState = {}

test('returns 0 when there are no results', () => {
  const predictions: PredictionsState = {
    A1: { home: 2, away: 1 },
    A2: { home: 0, away: 0 },
  }
  expect(calculateUserPoints(predictions, NO_RESULTS)).toBe(0)
})

describe('knockout match scoring', () => {
  test('R32 צליפה — exact score earns 7 points', () => {
    const predictions: PredictionsState = { '73': { home: 2, away: 1 } }
    const results: PredictionsState = { '73': { home: 2, away: 1 } }
    expect(calculateUserPoints(predictions, results)).toBe(7)
  })

  test('R32 פגיעה — correct winner, wrong score earns 5 points', () => {
    const predictions: PredictionsState = { '73': { home: 1, away: 0 } }
    const results: PredictionsState = { '73': { home: 3, away: 1 } }
    expect(calculateUserPoints(predictions, results)).toBe(5)
  })

  test('R32 wrong winner earns 0 points', () => {
    const predictions: PredictionsState = { '73': { home: 2, away: 0 } }
    const results: PredictionsState = { '73': { home: 0, away: 1 } }
    expect(calculateUserPoints(predictions, results)).toBe(0)
  })

  test('R32 צליפה — draw with matching drawWinner earns 7 points', () => {
    const predictions: PredictionsState = { '73': { home: 1, away: 1, drawWinner: 'home' } }
    const results: PredictionsState = { '73': { home: 1, away: 1, drawWinner: 'home' } }
    expect(calculateUserPoints(predictions, results)).toBe(7)
  })

  test('R32 פגיעה — draw with correct drawWinner but wrong score earns 5 points', () => {
    const predictions: PredictionsState = { '73': { home: 2, away: 2, drawWinner: 'away' } }
    const results: PredictionsState = { '73': { home: 1, away: 1, drawWinner: 'away' } }
    expect(calculateUserPoints(predictions, results)).toBe(5)
  })

  test('R32 פגיעה — regular win matches draw+drawWinner with same winner earns 5 points', () => {
    const predictions: PredictionsState = { '73': { home: 2, away: 1 } }
    const results: PredictionsState = { '73': { home: 1, away: 1, drawWinner: 'home' } }
    expect(calculateUserPoints(predictions, results)).toBe(5)
  })

  test('R16 צליפה earns 8 points', () => {
    const predictions: PredictionsState = { '89': { home: 2, away: 0 } }
    const results: PredictionsState = { '89': { home: 2, away: 0 } }
    expect(calculateUserPoints(predictions, results)).toBe(8)
  })

  test('QF צליפה earns 12 points', () => {
    const predictions: PredictionsState = { '97': { home: 1, away: 0 } }
    const results: PredictionsState = { '97': { home: 1, away: 0 } }
    expect(calculateUserPoints(predictions, results)).toBe(12)
  })

  test('SF צליפה earns 16 points', () => {
    const predictions: PredictionsState = { '101': { home: 3, away: 1 } }
    const results: PredictionsState = { '101': { home: 3, away: 1 } }
    expect(calculateUserPoints(predictions, results)).toBe(16)
  })

  test('3rd place צליפה earns 18 points', () => {
    const predictions: PredictionsState = { '103': { home: 2, away: 1 } }
    const results: PredictionsState = { '103': { home: 2, away: 1 } }
    expect(calculateUserPoints(predictions, results)).toBe(18)
  })

  test('Final צליפה earns 25 points', () => {
    const predictions: PredictionsState = { '104': { home: 1, away: 0 } }
    const results: PredictionsState = { '104': { home: 1, away: 0 } }
    expect(calculateUserPoints(predictions, results)).toBe(25)
  })
})

// Group A: Mexico, South Africa, South Korea, Czech Republic
// Matches: A1=Mex/SA, A2=SK/Czech, A3=Czech/SA, A4=Mex/SK, A5=Czech/Mex, A6=SA/SK
const GROUP_A_MEXICO_CZECH_TOP2: PredictionsState = {
  A1: { home: 2, away: 0 }, // Mexico beats SA
  A2: { home: 0, away: 2 }, // Czech beats SK
  A3: { home: 2, away: 0 }, // Czech beats SA
  A4: { home: 2, away: 0 }, // Mexico beats SK
  A5: { home: 0, away: 1 }, // Mexico beats Czech
  A6: { home: 0, away: 0 }, // SA draws SK
  // standings: Mexico 9pts, Czech 6pts, SA 1pt, SK 1pt → top 2: Mexico, Czech
}

const GROUP_A_MEXICO_SK_TOP2: PredictionsState = {
  A1: { home: 2, away: 0 }, // Mexico beats SA
  A2: { home: 2, away: 1 }, // SK beats Czech
  A3: { home: 0, away: 1 }, // SA beats Czech
  A4: { home: 2, away: 0 }, // Mexico beats SK
  A5: { home: 0, away: 2 }, // Mexico beats Czech
  A6: { home: 0, away: 2 }, // SK beats SA
  // standings: Mexico 9pts, SK 6pts, SA 3pts, Czech 0pts → top 2: Mexico, SK
}

const EIGHT_TEAMS = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta']

describe('knockout advancement (עולה)', () => {
  test('R32 → R16: 5 pts per correctly predicted advancing team', () => {
    expect(calculateUserPoints({}, {}, undefined, {
      predicted: { r32: ['Brazil', 'France', 'Germany'] },
      actual:    { r32: ['Brazil', 'Italy',  'Germany'] },
    })).toBe(10) // Brazil + Germany → 2 × 5
  })

  test('R16 → QF: 8 pts per correctly predicted advancing team', () => {
    expect(calculateUserPoints({}, {}, undefined, {
      predicted: { r16: ['Brazil', 'France'] },
      actual:    { r16: ['Brazil', 'Germany'] },
    })).toBe(8) // Brazil only → 1 × 8
  })

  test('QF → SF: 12 pts per correctly predicted advancing team', () => {
    expect(calculateUserPoints({}, {}, undefined, {
      predicted: { qf: ['Brazil', 'France'] },
      actual:    { qf: ['Brazil', 'France'] },
    })).toBe(24) // 2 × 12
  })

  test('SF → Final: 16 pts per correctly predicted advancing team', () => {
    expect(calculateUserPoints({}, {}, undefined, {
      predicted: { sf: ['Brazil'] },
      actual:    { sf: ['Brazil'] },
    })).toBe(16)
  })

  test('3rd place winner: 20 pts', () => {
    expect(calculateUserPoints({}, {}, undefined, {
      predicted: { thirdPlaceWinner: 'Brazil' },
      actual:    { thirdPlaceWinner: 'Brazil' },
    })).toBe(20)
  })

  test('champion: 25 pts', () => {
    expect(calculateUserPoints({}, {}, undefined, {
      predicted: { champion: 'Brazil' },
      actual:    { champion: 'Brazil' },
    })).toBe(25)
  })

  test('wrong prediction earns 0 pts', () => {
    expect(calculateUserPoints({}, {}, undefined, {
      predicted: { champion: 'Brazil', r32: ['Brazil'] },
      actual:    { champion: 'France', r32: ['France'] },
    })).toBe(0)
  })

  test('no knockout advancers provided → 0 pts', () => {
    expect(calculateUserPoints({}, {})).toBe(0)
  })
})

describe('3rd-place qualification (עולה)', () => {
  test('all 8 predicted qualifiers match → 40 pts', () => {
    expect(calculateUserPoints({}, {}, {
      predictedThirdQualifiers: EIGHT_TEAMS,
      actualThirdQualifiers: EIGHT_TEAMS,
    })).toBe(40)
  })

  test('partial match → 5 pts per correct qualifier', () => {
    expect(calculateUserPoints({}, {}, {
      predictedThirdQualifiers: EIGHT_TEAMS,
      actualThirdQualifiers: [...EIGHT_TEAMS.slice(0, 3), 'X', 'Y', 'Z', 'W', 'V'],
    })).toBe(15) // 3 matches × 5pts
  })

  test('no match → 0 pts', () => {
    expect(calculateUserPoints({}, {}, {
      predictedThirdQualifiers: EIGHT_TEAMS,
      actualThirdQualifiers: ['X', 'Y', 'Z', 'W', 'V', 'U', 'T', 'S'],
    })).toBe(0)
  })

  test('no qualifiers provided → 0 pts', () => {
    expect(calculateUserPoints({}, {})).toBe(0)
  })
})

describe('group advancement (עולה)', () => {
  test('both predicted top-2 teams actually advance → 10 pts', () => {
    expect(calculateUserPoints(GROUP_A_MEXICO_CZECH_TOP2, GROUP_A_MEXICO_CZECH_TOP2)).toBe(
      4 * 6 + 10 // 6 exact scores + 2 עולה × 5pts
    )
  })

  test('only 1 of 2 predicted top-2 teams advances → 5 pts עולה', () => {
    // user predicted Mexico+Czech, actual Mexico+SK
    // A1(2-0 exact=4) + A4(2-0 exact=4) + A5(same winner=2) + Mexico עולה(5) = 15
    expect(calculateUserPoints(GROUP_A_MEXICO_CZECH_TOP2, GROUP_A_MEXICO_SK_TOP2)).toBe(15)
  })

  test('neither predicted top-2 team advances → 0 עולה pts', () => {
    // user: Mexico+Czech top 2; actual: SK(9pts)+SA(6pts) top 2
    const skSaActual: PredictionsState = {
      A1: { home: 0, away: 3 }, // SA beats Mexico
      A2: { home: 3, away: 0 }, // SK beats Czech
      A3: { home: 0, away: 3 }, // SA beats Czech
      A4: { home: 0, away: 3 }, // SK beats Mexico
      A5: { home: 3, away: 0 }, // Czech beats Mexico (flipped so no פגיעה with prediction)
      A6: { home: 0, away: 3 }, // SK beats SA
      // standings: SK 9pts, SA 6pts, Czech 3pts, Mexico 0pts → top 2: SK, SA
    }
    expect(calculateUserPoints(GROUP_A_MEXICO_CZECH_TOP2, skSaActual)).toBe(0)
  })

  test('incomplete group results → no עולה pts awarded', () => {
    const incompleteResults: PredictionsState = {
      A1: { home: 2, away: 0 }, // only 1 of 6 group A matches played
    }
    expect(calculateUserPoints(GROUP_A_MEXICO_CZECH_TOP2, incompleteResults)).toBe(4) // only match pts
  })
})

describe('golden boot (מלך שערים)', () => {
  test('3 pts per goal scored by predicted player', () => {
    expect(calculateUserPoints({}, {}, undefined, undefined, {
      predictedPlayer: 'Messi',
      actualGoals: { Messi: 5 },
      goldenBootWinner: 'Ronaldo',
    })).toBe(15) // 5 goals × 3 pts
  })

  test('+10 bonus if predicted player wins the golden boot', () => {
    expect(calculateUserPoints({}, {}, undefined, undefined, {
      predictedPlayer: 'Messi',
      actualGoals: { Messi: 6 },
      goldenBootWinner: 'Messi',
    })).toBe(28) // 6 × 3 + 10
  })

  test('0 pts if predicted player scored no goals', () => {
    expect(calculateUserPoints({}, {}, undefined, undefined, {
      predictedPlayer: 'Messi',
      actualGoals: { Ronaldo: 7 },
      goldenBootWinner: 'Ronaldo',
    })).toBe(0)
  })

  test('no golden boot data → 0 pts', () => {
    expect(calculateUserPoints({}, {})).toBe(0)
  })
})

describe('group stage match scoring', () => {
  test('צליפה — exact score earns 4 points', () => {
    const predictions: PredictionsState = { A1: { home: 2, away: 1 } }
    const results: PredictionsState = { A1: { home: 2, away: 1 } }
    expect(calculateUserPoints(predictions, results)).toBe(4)
  })

  test('פגיעה — correct result but wrong score earns 2 points', () => {
    const predictions: PredictionsState = { A1: { home: 1, away: 0 } }
    const results: PredictionsState = { A1: { home: 3, away: 1 } }
    expect(calculateUserPoints(predictions, results)).toBe(2)
  })

  test('wrong result earns 0 points', () => {
    const predictions: PredictionsState = { A1: { home: 2, away: 0 } }
    const results: PredictionsState = { A1: { home: 0, away: 1 } }
    expect(calculateUserPoints(predictions, results)).toBe(0)
  })

  test('predicted draw, actual draw earns 2 points (פגיעה)', () => {
    const predictions: PredictionsState = { A1: { home: 1, away: 1 } }
    const results: PredictionsState = { A1: { home: 0, away: 0 } }
    expect(calculateUserPoints(predictions, results)).toBe(2)
  })

  test('points accumulate across multiple matches', () => {
    const predictions: PredictionsState = {
      A1: { home: 2, away: 1 }, // exact → 4
      A2: { home: 1, away: 0 }, // correct result → 2
      A3: { home: 3, away: 0 }, // wrong → 0
    }
    const results: PredictionsState = {
      A1: { home: 2, away: 1 },
      A2: { home: 2, away: 0 },
      A3: { home: 0, away: 1 },
    }
    expect(calculateUserPoints(predictions, results)).toBe(6)
  })
})

describe('ko match participation', () => {
  const bracket = (matchNum: number, home: string, away: string): KnockoutMatch => ({
    matchNum, home, away, resolved: true,
  })

  test('user gets points when bracket has the same teams', () => {
    const predictions: PredictionsState = { '101': { home: 2, away: 1 } }
    const results: PredictionsState    = { '101': { home: 2, away: 1 } }
    expect(calculateKnockoutMatchPoints(predictions, results, [bracket(101, 'Brazil', 'England')], [bracket(101, 'Brazil', 'England')])).toBe(16)
  })

  test('user gets 0 when bracket has different teams', () => {
    const predictions: PredictionsState = { '101': { home: 2, away: 1 } }
    const results: PredictionsState    = { '101': { home: 2, away: 1 } }
    expect(calculateKnockoutMatchPoints(predictions, results, [bracket(101, 'France', 'Argentina')], [bracket(101, 'Brazil', 'England')])).toBe(0)
  })

  test('home/away order does not matter for participation', () => {
    const predictions: PredictionsState = { '101': { home: 2, away: 1 } }
    const results: PredictionsState    = { '101': { home: 2, away: 1 } }
    expect(calculateKnockoutMatchPoints(predictions, results, [bracket(101, 'England', 'Brazil')], [bracket(101, 'Brazil', 'England')])).toBe(16)
  })

  test('only the non-participating match is skipped, others still score', () => {
    const predictions: PredictionsState = { '101': { home: 2, away: 1 }, '102': { home: 1, away: 0 } }
    const results: PredictionsState    = { '101': { home: 2, away: 1 }, '102': { home: 1, away: 0 } }
    const userBracket   = [bracket(101, 'France', 'Argentina'), bracket(102, 'Germany', 'Spain')]
    const actualBracket = [bracket(101, 'Brazil',  'England'),  bracket(102, 'Germany', 'Spain')]
    // 101: no participation → 0; 102: participates, exact score → 16
    expect(calculateKnockoutMatchPoints(predictions, results, userBracket, actualBracket)).toBe(16)
  })
})
