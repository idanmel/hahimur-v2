import { describe, it, expect } from 'vitest'
import { buildGoldenBootBoard } from './goldenBootBoard'

const nameMap = { 'Lionel Messi': 'מסי', 'Erling Haaland': 'הולאנד' }
const pickedEspnNames = new Set(['Kylian Mbappé'])

describe('buildGoldenBootBoard', () => {
  it('always shows picked players, even at zero goals', () => {
    const { players, realGoals } = buildGoldenBootBoard({
      pickedPlayers: ['אמבפה', 'קיין'],
      pickedGoals: { אמבפה: 3, קיין: 0 },
      espnTotals: { 'Kylian Mbappé': 3 },
      pickedEspnNames,
      nameMap,
    })
    expect(players).toContain('קיין')
    expect(realGoals['קיין']).toBe(0)
  })

  it('ranks an unpicked leader above picked players and includes a within-one chaser', () => {
    const { players, realGoals } = buildGoldenBootBoard({
      pickedPlayers: ['אמבפה'],
      pickedGoals: { אמבפה: 4 },
      espnTotals: { 'Kylian Mbappé': 4, 'Lionel Messi': 6, 'Erling Haaland': 5 },
      pickedEspnNames,
      nameMap,
    })
    // Sorted by goals desc: Messi 6, Haaland 5, Mbappé 4
    expect(players).toEqual(['מסי', 'הולאנד', 'אמבפה'])
    expect(realGoals).toEqual({ מסי: 6, הולאנד: 5, אמבפה: 4 })
  })

  it('excludes an unpicked player two behind the lead', () => {
    const { players } = buildGoldenBootBoard({
      pickedPlayers: ['אמבפה'],
      pickedGoals: { אמבפה: 6 },
      espnTotals: { 'Kylian Mbappé': 6, 'Erling Haaland': 4 },
      pickedEspnNames,
      nameMap,
    })
    // Haaland (4) is 2 behind the lead (6) -> excluded
    expect(players).toEqual(['אמבפה'])
  })

  it('does not double-count a picked player from the ESPN totals', () => {
    const { players } = buildGoldenBootBoard({
      pickedPlayers: ['אמבפה'],
      pickedGoals: { אמבפה: 6 },
      espnTotals: { 'Kylian Mbappé': 6 },
      pickedEspnNames,
      nameMap,
    })
    expect(players).toEqual(['אמבפה'])
  })

  it('falls back to the Latin name for an uncurated leader', () => {
    const { players, realGoals } = buildGoldenBootBoard({
      pickedPlayers: ['אמבפה'],
      pickedGoals: { אמבפה: 3 },
      espnTotals: { 'Some Newcomer': 6 },
      pickedEspnNames,
      nameMap,
    })
    expect(players[0]).toBe('Some Newcomer')
    expect(realGoals['Some Newcomer']).toBe(6)
  })

  it('shows no unpicked rows before any goals are scored', () => {
    const { players } = buildGoldenBootBoard({
      pickedPlayers: ['אמבפה', 'קיין'],
      pickedGoals: {},
      espnTotals: {},
      pickedEspnNames,
      nameMap,
    })
    expect(players).toEqual(['אמבפה', 'קיין'])
  })
})
