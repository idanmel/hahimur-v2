import { render, screen } from '@testing-library/react'
import StandingsTable from './StandingsTable'
import { TEAMS } from '../../shared/groups'
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

describe('StandingsTable — highlightTeams', () => {
  test('marks a highlighted team row with row-highlight', () => {
    render(<StandingsTable standings={standings} highlightTeams={['Mexico']} />)
    expect(screen.getByLabelText(TEAMS['Mexico'].he)).toHaveClass('row-highlight')
  })

  test('leaves non-highlighted rows without row-highlight', () => {
    render(<StandingsTable standings={standings} highlightTeams={['Mexico']} />)
    expect(screen.getByLabelText(TEAMS['Czech Republic'].he)).not.toHaveClass('row-highlight')
  })
})
