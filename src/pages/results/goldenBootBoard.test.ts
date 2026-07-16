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

  it('ranks unpicked players with 4+ goals above picked players, sorted by goals', () => {
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

  it('includes an unpicked player far behind the lead once he reaches 4 goals', () => {
    const { players, realGoals } = buildGoldenBootBoard({
      pickedPlayers: ['אמבפה'],
      pickedGoals: { אמבפה: 7 },
      espnTotals: { 'Kylian Mbappé': 7, 'Erling Haaland': 4 },
      pickedEspnNames,
      nameMap,
    })
    // Haaland (4) is 3 behind the lead (7), but 4 goals is enough to show
    expect(players).toEqual(['אמבפה', 'הולאנד'])
    expect(realGoals['הולאנד']).toBe(4)
  })

  it('excludes an unpicked player with fewer than 4 goals, even within one of the lead', () => {
    const { players } = buildGoldenBootBoard({
      pickedPlayers: ['אמבפה'],
      pickedGoals: { אמבפה: 4 },
      espnTotals: { 'Kylian Mbappé': 4, 'Erling Haaland': 3 },
      pickedEspnNames,
      nameMap,
    })
    // Haaland (3) chases within one, but is below the 4-goal bar -> excluded
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

  it('excludes an unpicked done-scoring player who trails the lead', () => {
    const { players } = buildGoldenBootBoard({
      pickedPlayers: ['אמבפה'],
      pickedGoals: { אמבפה: 6 },
      espnTotals: { 'Kylian Mbappé': 6, 'Erling Haaland': 4 },
      pickedEspnNames,
      nameMap,
      teamByPlayer: { הולאנד: 'Norway' },
      doneScoringTeams: new Set(['Norway']),
    })
    // Haaland (4, Norway done playing) trails the lead (6): frozen, can't win -> hidden
    expect(players).toEqual(['אמבפה'])
  })

  it('keeps an unpicked done-scoring player who is (co-)leading', () => {
    const { players, realGoals } = buildGoldenBootBoard({
      pickedPlayers: ['אמבפה'],
      pickedGoals: { אמבפה: 4 },
      espnTotals: { 'Kylian Mbappé': 4, 'Erling Haaland': 5 },
      pickedEspnNames,
      nameMap,
      teamByPlayer: { הולאנד: 'Norway' },
      doneScoringTeams: new Set(['Norway']),
    })
    // Norway is out but Haaland leads — he can still win the Golden Boot,
    // which is exactly what decides whether any picker gets the bonus.
    expect(players).toEqual(['הולאנד', 'אמבפה'])
    expect(realGoals['הולאנד']).toBe(5)
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
