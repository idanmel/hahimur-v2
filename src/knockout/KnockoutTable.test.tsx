import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import KnockoutTable from './KnockoutTable'
import type { KnockoutMatch, MatchScores } from '../shared/types'
import { vi } from 'vitest'

const noop = vi.fn()
const emptyPredictions: Record<string, MatchScores> = {}

const resolvedMatch: KnockoutMatch = {
  matchNum: 89, home: 'Germany', away: 'Mexico', resolved: true,
}

const unresolvedMatch: KnockoutMatch = {
  matchNum: 90, home: 'מנצח 73', away: 'מנצח 75', resolved: false,
}

// Partially resolved set: one known team, one placeholder (match unresolved overall)
const PARTIAL_MATCHES: KnockoutMatch[] = [
  { matchNum: 73, home: 'Mexico', away: 'סגן-אלוף ב', resolved: false },
  { matchNum: 74, home: 'Germany', away: 'Haiti', resolved: true },
  { matchNum: 75, home: 'מנצח קבוצה ו', away: '?', resolved: false },
]

describe('KnockoutTable — team name display', () => {
  test('shows Hebrew name for a known team', () => {
    render(<KnockoutTable matches={PARTIAL_MATCHES} predictions={emptyPredictions} onChange={noop} alwaysShowScores />)
    expect(screen.getByText('מקסיקו')).toBeInTheDocument()
    expect(screen.queryByText('Mexico')).not.toBeInTheDocument()
  })

  test('shows flag for a known team', () => {
    render(<KnockoutTable matches={PARTIAL_MATCHES} predictions={emptyPredictions} onChange={noop} alwaysShowScores />)
    expect(document.querySelector('.fi-mx')).not.toBeNull()
  })

  test('shows placeholder box (not flag) for an unknown slot', () => {
    render(<KnockoutTable matches={PARTIAL_MATCHES} predictions={emptyPredictions} onChange={noop} alwaysShowScores />)
    expect(document.querySelectorAll('.r32-slot-flag-ph').length).toBeGreaterThan(0)
  })

  test('shows Hebrew placeholder text for unresolved slots', () => {
    render(<KnockoutTable matches={PARTIAL_MATCHES} predictions={emptyPredictions} onChange={noop} alwaysShowScores />)
    expect(screen.getByText('סגן-אלוף ב')).toBeInTheDocument()
    expect(screen.getByText('מנצח קבוצה ו')).toBeInTheDocument()
  })

  test('renders correct number of match cards', () => {
    render(<KnockoutTable matches={PARTIAL_MATCHES} predictions={emptyPredictions} onChange={noop} />)
    expect(document.querySelectorAll('.r32-card')).toHaveLength(3)
  })
})

describe('KnockoutTable — default mode (score inputs only when resolved)', () => {
  test('shows two score inputs for a resolved match', () => {
    render(<KnockoutTable matches={PARTIAL_MATCHES} predictions={emptyPredictions} onChange={noop} />)
    // Only match 74 is resolved; expect exactly 2 score inputs
    expect(document.querySelectorAll('.score-input')).toHaveLength(2)
  })

  test('shows no score inputs for unresolved matches', () => {
    const unresolved: KnockoutMatch[] = [
      { matchNum: 73, home: 'סגן-אלוף א', away: 'סגן-אלוף ב', resolved: false },
    ]
    render(<KnockoutTable matches={unresolved} predictions={emptyPredictions} onChange={noop} />)
    expect(document.querySelectorAll('.score-input')).toHaveLength(0)
  })
})

describe('KnockoutTable — alwaysShowScores (optimistic prediction)', () => {
  test('shows score inputs for all matches regardless of resolved state', () => {
    render(<KnockoutTable matches={[resolvedMatch, unresolvedMatch]} predictions={emptyPredictions} onChange={noop} alwaysShowScores />)
    // 2 matches × 2 inputs each = 4
    expect(document.querySelectorAll('.score-input')).toHaveLength(4)
  })
})

describe('KnockoutTable — onChange', () => {
  test('fires with correct matchNum key and scores when home score typed', async () => {
    const onChange = vi.fn()
    render(<KnockoutTable matches={[resolvedMatch]} predictions={emptyPredictions} onChange={onChange} />)
    const inputs = document.querySelectorAll<HTMLInputElement>('.score-input')
    await userEvent.type(inputs[0], '2')
    expect(onChange).toHaveBeenCalledWith('89', { home: 2, away: null })
  })
})
