import { describe, expect, test } from 'vitest'
import { vennStage, knockoutChronoNav, findInStages } from './koMatch'
import type { KnockoutStages } from '../../shared/types'

// findKnockoutMatch sources fixtures from the derived knockoutStages, so a match
// that has a baked result carries its score (and advancer) straight onto the
// fixture the page renders. findInStages is the pure lookup behind it.
describe('findInStages', () => {
  const stages: KnockoutStages = {
    r32: [
      { matchNum: 73, home: 'South Korea', away: 'Canada', resolved: true, scores: { home: 2, away: 1 } },
      { matchNum: 74, home: 'Germany', away: 'Scotland', resolved: true },
    ],
    r16: [], qf: [], sf: [], thirdPlace: [], final: [],
  }

  test('returns the fixture with its baked result attached', () => {
    expect(findInStages(stages, 73)).toEqual(
      { matchNum: 73, home: 'South Korea', away: 'Canada', resolved: true, scores: { home: 2, away: 1 } },
    )
  })

  test('returns a fixture without scores when none is baked', () => {
    expect(findInStages(stages, 74)?.scores).toBeUndefined()
  })

  test('returns null for a match not in the bracket', () => {
    expect(findInStages(stages, 999)).toBeNull()
  })
})

// Every knockout match feeds a "who predicted each team this far" Venn — except
// the third-place match. The stage it checks is the one the two teams must have
// reached to meet in this match: a R32 winner reaches the R16, a R16 winner the
// QF, and so on; the final asks about who was predicted as a finalist. Nobody
// advances into the third-place match (its teams are the semi losers), so it
// gets no Venn — the page lists outright third-place picks instead.
describe('vennStage', () => {
  test('R32 matches ask who predicted each team into the round of 16', () => {
    expect(vennStage(73)).toEqual({ stage: 'r16', label: 'שמינית גמר' })
    expect(vennStage(88)).toEqual({ stage: 'r16', label: 'שמינית גמר' })
  })

  test('R16 matches ask about the quarter-finals', () => {
    expect(vennStage(89)).toEqual({ stage: 'qf', label: 'רבע גמר' })
    expect(vennStage(96)).toEqual({ stage: 'qf', label: 'רבע גמר' })
  })

  test('quarter-finals ask about the semi-finals', () => {
    expect(vennStage(97)).toEqual({ stage: 'sf', label: 'חצי גמר' })
    expect(vennStage(100)).toEqual({ stage: 'sf', label: 'חצי גמר' })
  })

  test('semi-finals ask about the final', () => {
    expect(vennStage(101)).toEqual({ stage: 'final', label: 'גמר' })
    expect(vennStage(102)).toEqual({ stage: 'final', label: 'גמר' })
  })

  test('the third-place match feeds no venn', () => {
    expect(vennStage(103)).toBeNull()
  })

  test('the final asks who predicted each team as a finalist', () => {
    expect(vennStage(104)).toEqual({ stage: 'final', label: 'גמר' })
  })
})

// The bracket numbers (73–104) run by round, not by clock: match 76 kicks off
// (Jun 29 20:00) before 74 (Jun 29 23:30) and 75 (Jun 30). The prev/next arrows
// must follow the kickoff schedule, not the match number.
describe('knockoutChronoNav', () => {
  test('the first match played has no previous, and next is the earliest-kicking R32 match', () => {
    expect(knockoutChronoNav(73)).toEqual({ prevNum: null, nextNum: 76 })
  })

  test('steps in kickoff order even when it disagrees with the match number', () => {
    expect(knockoutChronoNav(76)).toEqual({ prevNum: 73, nextNum: 74 })
    expect(knockoutChronoNav(74)).toEqual({ prevNum: 76, nextNum: 75 })
  })

  test('crosses from the round of 32 into the round of 16 chronologically', () => {
    // 87 (Jul 4 04:30) is the last R32 match played; 90 (Jul 4 20:00) is next.
    expect(knockoutChronoNav(87)).toEqual({ prevNum: 86, nextNum: 90 })
  })

  test('the final is the last match played and has no next', () => {
    expect(knockoutChronoNav(104)).toEqual({ prevNum: 103, nextNum: null })
  })
})
