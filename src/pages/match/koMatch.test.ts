import { describe, expect, test } from 'vitest'
import { vennStage } from './koMatch'

// Every knockout match feeds a "who predicted each team this far" Venn. The stage
// it checks is the one the two teams must have reached to meet in this match:
// a R32 winner reaches the R16, a R16 winner the QF, and so on. The two odd
// matches — third place and the final — ask about the round both teams already
// reached (semis / final).
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

  test('the third-place match asks who reached the semi-finals', () => {
    expect(vennStage(103)).toEqual({ stage: 'sf', label: 'חצי גמר' })
  })

  test('the final asks who predicted each team as a finalist', () => {
    expect(vennStage(104)).toEqual({ stage: 'final', label: 'גמר' })
  })
})
