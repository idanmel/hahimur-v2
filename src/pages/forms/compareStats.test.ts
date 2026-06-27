import { describe, expect, test } from 'vitest'
import {
  buildMatchDiff,
  matchTally,
  buildAgreement,
  buildScoreboard,
  buildBreakdownRows,
  buildGroupStandingsDiff,
  eliminatedTeams,
  buildKnockoutDiff,
  buildAdvancementAgreement,
} from './compareStats'
import { EMPTY_RESULTS, makeUser } from '../../leaderboard/testFixtures'
import type { KnockoutMatch, Standing, TournamentResults } from '../../shared/types'

function ko(matchNum: number, home: string, away: string, scores?: KnockoutMatch['scores']): KnockoutMatch {
  return { matchNum, home, away, resolved: scores != null, scores }
}

function st(team: string, played = 0): Standing {
  return { team, played, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }
}

function standing(team: string, played: number, points: number): Standing {
  return { team, played, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points }
}

const A1 = { id: 'A1', homeTeam: 'Mexico', awayTeam: 'South Africa' }

describe('buildMatchDiff', () => {
  test('flags rows where the two bets differ', () => {
    const userA = makeUser({ predictions: { A1: { home: 2, away: 0 } } })
    const userB = makeUser({ predictions: { A1: { home: 1, away: 1 } } })
    const rows = buildMatchDiff(userA, userB, EMPTY_RESULTS)
    const a1 = rows.find(r => r.id === 'A1')!
    expect(a1.differ).toBe(true)
    expect(a1.finished).toBe(false)
  })

  test('identical bets are not flagged as differing', () => {
    const userA = makeUser({ predictions: { A1: { home: 2, away: 0 } } })
    const userB = makeUser({ predictions: { A1: { home: 2, away: 0 } } })
    const a1 = buildMatchDiff(userA, userB, EMPTY_RESULTS).find(r => r.id === 'A1')!
    expect(a1.differ).toBe(false)
  })

  test('scores outcomes and points for finished matches', () => {
    const userA = makeUser({ predictions: { A1: { home: 2, away: 0 } } })
    const userB = makeUser({ predictions: { A1: { home: 1, away: 1 } } })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      groupMatches: { A: [{ ...A1, scores: { home: 2, away: 0 } }] },
    }
    const a1 = buildMatchDiff(userA, userB, results).find(r => r.id === 'A1')!
    expect(a1.finished).toBe(true)
    expect(a1.aOutcome).toBe('tzelifa')
    expect(a1.bOutcome).toBe('miss')
    expect(a1.aPoints).toBe(4)
    expect(a1.bPoints).toBe(0)
    expect(a1.winner).toBe('a')
  })
})

describe('matchTally', () => {
  test('counts finished-match wins per player', () => {
    const userA = makeUser({ predictions: { A1: { home: 2, away: 0 } } })
    const userB = makeUser({ predictions: { A1: { home: 1, away: 1 } } })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      groupMatches: { A: [{ ...A1, scores: { home: 2, away: 0 } }] },
    }
    expect(matchTally(buildMatchDiff(userA, userB, results))).toEqual({ a: 1, b: 0, tie: 0 })
  })
})

describe('buildAgreement', () => {
  test('counts identical scores and matching outcomes', () => {
    const userA = makeUser({ predictions: { A1: { home: 2, away: 0 } } })
    const userB = makeUser({ predictions: { A1: { home: 2, away: 0 } } })
    const agreement = buildAgreement(buildMatchDiff(userA, userB, EMPTY_RESULTS))
    expect(agreement.bothPredicted).toBe(1)
    expect(agreement.identicalScore).toBe(1)
    expect(agreement.sameOutcome).toBe(1)
  })
})

describe('buildScoreboard', () => {
  test('reports leader, gap and ranks', () => {
    const userA = makeUser({ label: 'A', topGoalscorer: 'Striker' })
    const userB = makeUser({ label: 'B' })
    const results: TournamentResults = { ...EMPTY_RESULTS, playerGoals: { Striker: 2 } }
    const board = buildScoreboard(userA, userB, [userA, userB], results)
    expect(board.aTotal).toBe(6)
    expect(board.bTotal).toBe(0)
    expect(board.leader).toBe('a')
    expect(board.gap).toBe(6)
    expect(board.aRank).toBe(1)
    expect(board.bRank).toBe(2)
  })

  test('ties share the same rank', () => {
    const userA = makeUser({ label: 'A' })
    const userB = makeUser({ label: 'B' })
    const board = buildScoreboard(userA, userB, [userA, userB], EMPTY_RESULTS)
    expect(board.leader).toBe('tie')
    expect(board.gap).toBe(0)
    expect(board.aRank).toBe(1)
    expect(board.bRank).toBe(1)
  })
})

describe('buildGroupStandingsDiff', () => {
  test('flags slots where the two predicted orderings agree', () => {
    const userA = makeUser({ groupTables: { A: [st('Mexico'), st('South Korea')] } })
    const userB = makeUser({ groupTables: { A: [st('South Korea'), st('Mexico')] } })
    const groupA = buildGroupStandingsDiff(userA, userB, EMPTY_RESULTS).find(g => g.group === 'A')!
    expect(groupA.finished).toBe(false)
    expect(groupA.slots[0].agree).toBe(false)
    expect(groupA.slots[0].aTeam).toBe('Mexico')
    expect(groupA.slots[0].bTeam).toBe('South Korea')
    expect(groupA.aPlacePoints).toBe(0)
  })

  test('awards a place point per correct position once a group is finished', () => {
    const userA = makeUser({ groupTables: { A: [st('Mexico'), st('South Korea')] } })
    const userB = makeUser({ groupTables: { A: [st('South Korea'), st('Mexico')] } })
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      groupTables: { A: [st('Mexico', 1), st('South Korea', 1)] },
    }
    const groupA = buildGroupStandingsDiff(userA, userB, results).find(g => g.group === 'A')!
    expect(groupA.finished).toBe(true)
    expect(groupA.slots[0].actualTeam).toBe('Mexico')
    expect(groupA.slots[0].aCorrect).toBe(true)
    expect(groupA.slots[0].bCorrect).toBe(false)
    expect(groupA.aPlacePoints).toBe(2)
    expect(groupA.bPlacePoints).toBe(0)
  })
})

describe('eliminatedTeams', () => {
  test('nobody is out while the knockout bracket is empty (group stage)', () => {
    expect(eliminatedTeams(EMPTY_RESULTS).size).toBe(0)
  })

  test('the loser of a resolved knockout match is out, the winner is not', () => {
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      knockoutStages: {
        ...EMPTY_RESULTS.knockoutStages,
        r32: [ko(73, 'Brazil', 'Haiti', { home: 3, away: 0 })],
      },
    }
    const out = eliminatedTeams(results)
    expect(out.has('Haiti')).toBe(true)
    expect(out.has('Brazil')).toBe(false)
  })

  test('penalty winner (drawWinner) stays in, the other team is out', () => {
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      knockoutStages: {
        ...EMPTY_RESULTS.knockoutStages,
        r16: [ko(90, 'Spain', 'Germany', { home: 1, away: 1, drawWinner: 'away' })],
      },
    }
    const out = eliminatedTeams(results)
    expect(out.has('Spain')).toBe(true)
    expect(out.has('Germany')).toBe(false)
  })

  test('a team locked into last place in its group is out before the bracket exists', () => {
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      groupTables: {
        A: [
          standing('Spain', 2, 6),
          standing('Italy', 2, 6),
          standing('Croatia', 2, 4),
          standing('Albania', 2, 0),
        ],
      },
    }
    const out = eliminatedTeams(results)
    // Albania can reach at most 3 pts; three teams already have more → locked last.
    expect(out.has('Albania')).toBe(true)
    expect(out.has('Croatia')).toBe(false)
    expect(out.has('Spain')).toBe(false)
  })

  test('a last-place team that can still climb out of last is not flagged', () => {
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      groupTables: {
        A: [
          standing('Spain', 1, 3),
          standing('Italy', 1, 3),
          standing('Croatia', 1, 3),
          standing('Albania', 1, 0),
        ],
      },
    }
    // Albania (max 6) can still overtake teams sitting on 3 → no certain elimination.
    expect(eliminatedTeams(results).has('Albania')).toBe(false)
  })

  test('third place is not treated as eliminated (best thirds can still advance)', () => {
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      groupTables: {
        A: [
          standing('Spain', 3, 9),
          standing('Italy', 3, 6),
          standing('Croatia', 3, 3),
          standing('Albania', 3, 0),
        ],
      },
    }
    const out = eliminatedTeams(results)
    // Croatia finished third but only two teams are above it → still a best-third hopeful.
    expect(out.has('Croatia')).toBe(false)
    expect(out.has('Albania')).toBe(true)
  })
})

describe('eliminatedTeams — standings, not bracket slots', () => {
  function group(teams: [string, number, number][]): Standing[] {
    return teams.map(([team, played, points]) => standing(team, played, points))
  }

  function completeGroup(letter: string, thirdTeam: string, thirdPoints: number): Standing[] {
    return group([[`${letter}1`, 3, 9], [`${letter}2`, 3, 6], [thirdTeam, 3, thirdPoints], [`${letter}4`, 3, 0]])
  }

  // A finished group whose third place is a fully-specified standing (so its goal
  // difference / goals for participate in the best-thirds tiebreak).
  function third(team: string, points: number, gf: number, ga: number): Standing {
    return { team, played: 3, won: 0, drawn: 0, lost: 0, goalsFor: gf, goalsAgainst: ga, points }
  }
  function groupWithThird(letter: string, thirdStanding: Standing): Standing[] {
    return [standing(`${letter}1`, 3, 9), standing(`${letter}2`, 3, 6), thirdStanding, standing(`${letter}4`, 3, 0)]
  }

  test('qualified teams stay in even when their bracket slot is an unresolved descriptor', () => {
    // The real R32 pairs the group winner against a "best third" descriptor — the
    // winner is named, the opponent is still "שלישית א/ב/ג". The old bracket-sweep
    // would have buried every team not literally named in the bracket.
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      groupTables: {
        A: group([['Argentina', 3, 9], ['Norway', 3, 6], ['Senegal', 3, 3], ['Iraq', 3, 0]]),
      },
      knockoutStages: {
        ...EMPTY_RESULTS.knockoutStages,
        r32: [ko(73, 'Argentina', 'שלישית ב/ה/ו/ט/י')],
      },
    }
    const out = eliminatedTeams(results)
    expect(out.has('Argentina')).toBe(false) // group winner — obviously still in
    expect(out.has('Norway')).toBe(false) // runner-up
    expect(out.has('Iraq')).toBe(true) // last place in a finished group
  })

  test('with few groups settled and the cut open, third place stays alive', () => {
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      thirdPlaceQualification: { resolved: false, all: [], tied: [] },
      groupTables: {
        A: group([['Mexico', 3, 9], ['South Africa', 3, 4], ['South Korea', 3, 3], ['Czech Republic', 3, 1]]),
      },
    }
    const out = eliminatedTeams(results)
    expect(out.has('South Korea')).toBe(false) // 3rd — could still be a best third
    expect(out.has('Czech Republic')).toBe(true) // 4th — done
  })

  test('a low third is out once eight better thirds are locked in ahead of it', () => {
    // Real WC26 mid-tournament shape: groups A–I finished, J/K/L still playing, so
    // the best-thirds cut is unresolved. Uruguay's 2-point third is behind eight
    // other settled thirds (all on 3–4 pts) → mathematically out of the cut.
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      thirdPlaceQualification: { resolved: false, all: [], tied: [] },
      groupTables: {
        A: completeGroup('A', 'South Korea', 3),
        B: completeGroup('B', 'Bosnia', 4),
        C: completeGroup('C', 'Scotland', 3),
        D: completeGroup('D', 'Paraguay', 4),
        E: completeGroup('E', 'Ecuador', 4),
        F: completeGroup('F', 'Sweden', 4),
        G: completeGroup('G', 'Iran', 3),
        H: group([['Spain', 3, 7], ['Cape Verde', 3, 3], ['Uruguay', 3, 2], ['Saudi Arabia', 3, 2]]),
        I: completeGroup('I', 'Senegal', 3),
        J: group([['Argentina', 2, 6], ['Austria', 2, 3], ['Algeria', 2, 3], ['Jordan', 2, 0]]),
      },
    }
    const out = eliminatedTeams(results)
    expect(out.has('Uruguay')).toBe(true) // eight thirds already ahead on points
    expect(out.has('South Korea')).toBe(false) // only four are strictly ahead — still alive
    expect(out.has('Algeria')).toBe(false) // group J unfinished — nobody out on position
  })

  test('a third tied on points is out when the goal-difference tiebreak leaves eight above it', () => {
    // Every settled third has the same 3 points; only goal difference separates them.
    // "Lowball" shares the points but trails all eight others on GD, so the official
    // tiebreak (points → GD → goals for) locks it into ninth — a points-only check
    // would have wrongly kept it alive.
    const better = (letter: string) => groupWithThird(letter, third(`${letter}3`, 3, 3, 2)) // GD +1
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      thirdPlaceQualification: { resolved: false, all: [], tied: [] },
      groupTables: {
        A: better('A'), B: better('B'), C: better('C'), D: better('D'),
        E: better('E'), F: better('F'), G: better('G'), H: better('H'),
        I: groupWithThird('I', third('Lowball', 3, 1, 6)), // same points, GD -5
      },
    }
    const out = eliminatedTeams(results)
    expect(out.has('Lowball')).toBe(true) // eight thirds rank above on the tiebreak
    expect(out.has('A3')).toBe(false) // a joint-best third is still alive
  })

  test('once the best-thirds are resolved, a non-qualifying third is out', () => {
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      thirdPlaceQualification: {
        resolved: true,
        all: [],
        qualifiers: [{ ...standing('Scotland', 3, 4), group: 'C' }],
      },
      groupTables: {
        A: group([['Mexico', 3, 9], ['South Africa', 3, 4], ['South Korea', 3, 3], ['Czech Republic', 3, 1]]),
      },
    }
    const out = eliminatedTeams(results)
    expect(out.has('South Korea')).toBe(true) // 3rd and not among the qualified thirds
  })

  test('an unfinished group eliminates nobody on position alone', () => {
    const results: TournamentResults = {
      ...EMPTY_RESULTS,
      groupTables: {
        K: group([['Colombia', 2, 6], ['Portugal', 2, 4], ['DR Congo', 2, 1], ['Uzbekistan', 2, 0]]),
      },
    }
    expect(eliminatedTeams(results).size).toBe(0)
  })
})

function koStages(stage: keyof TournamentResults['knockoutStages'], matches: KnockoutMatch[]) {
  return { ...EMPTY_RESULTS.knockoutStages, [stage]: matches }
}

describe('buildKnockoutDiff', () => {
  test('excludes slots where the two players predicted a different matchup', () => {
    const userA = makeUser({ knockoutStages: koStages('r16', [ko(89, 'Brazil', 'Japan', { home: 2, away: 0 })]) })
    const userB = makeUser({ knockoutStages: koStages('r16', [ko(89, 'Brazil', 'Germany', { home: 1, away: 0 })]) })
    expect(buildKnockoutDiff(userA, userB)).toHaveLength(0)
  })

  test('flags identical result + same advancer on the same matchup', () => {
    const userA = makeUser({ knockoutStages: koStages('r16', [ko(89, 'Brazil', 'Japan', { home: 2, away: 0 })]) })
    const userB = makeUser({ knockoutStages: koStages('r16', [ko(89, 'Brazil', 'Japan', { home: 2, away: 0 })]) })
    const [row] = buildKnockoutDiff(userA, userB)
    expect(row.differ).toBe(false)
    expect(row.sameAdvance).toBe(true)
    expect(row.stageHe).toBe('שמינית גמר')
  })

  test('same advancer but different score is not identical', () => {
    const userA = makeUser({ knockoutStages: koStages('qf', [ko(97, 'France', 'Morocco', { home: 2, away: 0 })]) })
    const userB = makeUser({ knockoutStages: koStages('qf', [ko(97, 'Morocco', 'France', { home: 0, away: 1 })]) })
    const [row] = buildKnockoutDiff(userA, userB)
    expect(row.differ).toBe(true)
    expect(row.sameAdvance).toBe(true)
  })

  test('matches the result regardless of home/away orientation', () => {
    const userA = makeUser({ knockoutStages: koStages('qf', [ko(97, 'France', 'Morocco', { home: 2, away: 1 })]) })
    const userB = makeUser({ knockoutStages: koStages('qf', [ko(97, 'Morocco', 'France', { home: 1, away: 2 })]) })
    const [row] = buildKnockoutDiff(userA, userB)
    expect(row.differ).toBe(false)
    expect(row.sameAdvance).toBe(true)
  })

  test('penalty winner decides the advancer when the score is level', () => {
    const userA = makeUser({ knockoutStages: koStages('r32', [ko(78, 'Ivory Coast', 'Norway', { home: 0, away: 0, drawWinner: 'away' })]) })
    const userB = makeUser({ knockoutStages: koStages('r32', [ko(78, 'Ivory Coast', 'Norway', { home: 0, away: 0, drawWinner: 'home' })]) })
    const [row] = buildKnockoutDiff(userA, userB)
    expect(row.differ).toBe(true)
    expect(row.sameAdvance).toBe(false)
  })
})

describe('buildAdvancementAgreement', () => {
  test('counts shared advancers per stage and whether the champion matches', () => {
    const userA = makeUser({ predictedR16Teams: ['A', 'B', 'C'], predictedFinalTeams: ['A', 'B'], predictedChampion: 'A' })
    const userB = makeUser({ predictedR16Teams: ['A', 'B', 'X'], predictedFinalTeams: ['A', 'C'], predictedChampion: 'A' })
    const { rows, championShared } = buildAdvancementAgreement(userA, userB)
    expect(rows.find(r => r.label === 'שמינית גמר')!.shared).toBe(2)
    expect(rows.find(r => r.label === 'גמר')!.shared).toBe(1)
    expect(championShared).toBe(true)
  })

  test('champion agreement is null when one side has no pick', () => {
    const userA = makeUser({ predictedChampion: 'A' })
    const userB = makeUser({})
    expect(buildAdvancementAgreement(userA, userB).championShared).toBeNull()
  })
})

describe('buildBreakdownRows', () => {
  test('returns one row per stage with the per-stage leader', () => {
    const userA = makeUser({ label: 'A', topGoalscorer: 'Striker' })
    const userB = makeUser({ label: 'B' })
    const results: TournamentResults = { ...EMPTY_RESULTS, playerGoals: { Striker: 1 } }
    const rows = buildBreakdownRows(userA, userB, results)
    expect(rows).toHaveLength(8)
    const golden = rows.find(r => r.label === 'מלך השערים')!
    expect(golden.a).toBe(3)
    expect(golden.b).toBe(0)
    expect(golden.leader).toBe('a')
  })
})
