import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import KnockoutTable from './KnockoutTable'
import type { KnockoutMatch, MatchScores } from '../types'
import { vi } from 'vitest'

const resolvedMatch: KnockoutMatch = {
  matchNum: 89, matchId: '89', home: 'Germany', away: 'Mexico', resolved: true,
}

const unresolvedMatch: KnockoutMatch = {
  matchNum: 90, matchId: '90', home: 'מנצח 73', away: 'מנצח 75', resolved: false,
}

const emptyPredictions: Record<string, MatchScores> = {}
const noop = vi.fn()

describe('KnockoutTable', () => {
  test('renders one card per match', () => {
    render(<KnockoutTable matches={[resolvedMatch, unresolvedMatch]} predictions={emptyPredictions} onChange={noop} />)
    expect(document.querySelectorAll('.r32-card')).toHaveLength(2)
  })

  test('shows Hebrew team name for a resolved team', () => {
    render(<KnockoutTable matches={[resolvedMatch]} predictions={emptyPredictions} onChange={noop} />)
    expect(screen.getByText('גרמניה')).toBeInTheDocument()
    expect(screen.getByText('מקסיקו')).toBeInTheDocument()
  })

  test('shows flag for a resolved team', () => {
    render(<KnockoutTable matches={[resolvedMatch]} predictions={emptyPredictions} onChange={noop} />)
    expect(document.querySelector('.fi-de')).not.toBeNull()
  })

  test('shows placeholder text for an unresolved team slot', () => {
    render(<KnockoutTable matches={[unresolvedMatch]} predictions={emptyPredictions} onChange={noop} />)
    expect(screen.getByText('מנצח 73')).toBeInTheDocument()
    expect(screen.getByText('מנצח 75')).toBeInTheDocument()
  })

  test('shows placeholder box (not flag) for an unresolved slot', () => {
    render(<KnockoutTable matches={[unresolvedMatch]} predictions={emptyPredictions} onChange={noop} />)
    expect(document.querySelectorAll('.r32-slot-flag-ph').length).toBeGreaterThan(0)
  })

  test('score inputs are always present (optimistic prediction)', () => {
    render(<KnockoutTable matches={[resolvedMatch, unresolvedMatch]} predictions={emptyPredictions} onChange={noop} />)
    // 2 matches × 2 inputs each = 4
    expect(document.querySelectorAll('.score-input')).toHaveLength(4)
  })

  test('onChange fires with correct matchId and scores when home score typed', async () => {
    const onChange = vi.fn()
    render(<KnockoutTable matches={[resolvedMatch]} predictions={emptyPredictions} onChange={onChange} />)
    const inputs = document.querySelectorAll<HTMLInputElement>('.score-input')
    await userEvent.type(inputs[0], '2')
    expect(onChange).toHaveBeenCalledWith('89', { home: 2, away: null })
  })
})
