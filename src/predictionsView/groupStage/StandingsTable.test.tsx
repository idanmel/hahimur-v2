import { render, screen } from '@testing-library/react'
import StandingsTable from './StandingsTable'
import type { Standing } from '../../shared/types'

const makeStanding = (team: string, points = 0): Standing => ({
  team, points, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0,
})

const standings: Standing[] = [
  makeStanding('Mexico', 4),
  makeStanding('South Korea', 4),
  makeStanding('Czech Republic', 1),
  makeStanding('South Africa', 1),
]

describe('StandingsTable — no row coloring for ties', () => {
  test('tied rows do not get a special class', () => {
    render(<StandingsTable standings={standings} />)
    screen.getAllByRole('row').forEach(row => {
      expect(row).not.toHaveClass('row-tied')
    })
  })
})
