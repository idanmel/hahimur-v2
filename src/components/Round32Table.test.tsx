import { render, screen } from '@testing-library/react'
import Round32Table from './Round32Table'
import type { R32Match } from '../types'

// Partially resolved: Group A done (Mexico is known), Group B not filled yet
const PARTIAL_MATCHES: R32Match[] = [
  { matchNum: 73, home: 'Mexico', away: 'סגן-אלוף ב', resolved: false },
  { matchNum: 74, home: 'Germany', away: 'Haiti', resolved: true },
  { matchNum: 75, home: 'מנצח קבוצה ו', away: '?', resolved: false },
]

describe('Round32Table — team name display', () => {
  test('shows Hebrew name for a known team even when match.resolved is false', () => {
    render(<Round32Table matches={PARTIAL_MATCHES} />)
    expect(screen.getByText('מקסיקו')).toBeInTheDocument()
    expect(screen.queryByText('Mexico')).not.toBeInTheDocument()
  })

  test('shows flag for a known team even when match.resolved is false', () => {
    render(<Round32Table matches={PARTIAL_MATCHES} />)
    const flagEl = document.querySelector('.fi-mx')
    expect(flagEl).not.toBeNull()
  })

  test('shows placeholder box (not flag) for an unknown slot', () => {
    render(<Round32Table matches={PARTIAL_MATCHES} />)
    expect(document.querySelectorAll('.r32-slot-flag-ph').length).toBeGreaterThan(0)
  })

  test('shows Hebrew placeholder text for unresolved slots', () => {
    render(<Round32Table matches={PARTIAL_MATCHES} />)
    expect(screen.getByText('סגן-אלוף ב')).toBeInTheDocument()
    expect(screen.getByText('מנצח קבוצה ו')).toBeInTheDocument()
  })

  test('shows Hebrew names for both teams in a fully resolved match', () => {
    render(<Round32Table matches={PARTIAL_MATCHES} />)
    expect(screen.getByText('גרמניה')).toBeInTheDocument()
    expect(screen.getByText('האיטי')).toBeInTheDocument()
  })

  test('renders correct number of match cards', () => {
    render(<Round32Table matches={PARTIAL_MATCHES} />)
    expect(document.querySelectorAll('.r32-card')).toHaveLength(3)
  })
})
