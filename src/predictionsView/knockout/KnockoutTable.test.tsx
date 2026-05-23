import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import KnockoutTable from './KnockoutTable'
import type { KnockoutMatch, MatchScores } from '../../shared/types'
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
    render(<KnockoutTable matches={PARTIAL_MATCHES} predictions={emptyPredictions} onChange={noop} />)
    expect(screen.getByText('מקסיקו')).toBeInTheDocument()
    expect(screen.queryByText('Mexico')).not.toBeInTheDocument()
  })

  test('shows flag for a known team', () => {
    render(<KnockoutTable matches={PARTIAL_MATCHES} predictions={emptyPredictions} onChange={noop} />)
    expect(document.querySelector('.fi-mx')).not.toBeNull()
  })

  test('shows placeholder box (not flag) for an unknown slot', () => {
    render(<KnockoutTable matches={PARTIAL_MATCHES} predictions={emptyPredictions} onChange={noop} />)
    expect(document.querySelectorAll('.ko-slot-flag-ph').length).toBeGreaterThan(0)
  })

  test('shows Hebrew placeholder text for unresolved slots', () => {
    render(<KnockoutTable matches={PARTIAL_MATCHES} predictions={emptyPredictions} onChange={noop} />)
    expect(screen.getByText('סגן-אלוף ב')).toBeInTheDocument()
    expect(screen.getByText('מנצח קבוצה ו')).toBeInTheDocument()
  })

  test('renders correct number of match cards', () => {
    render(<KnockoutTable matches={PARTIAL_MATCHES} predictions={emptyPredictions} onChange={noop} />)
    expect(document.querySelectorAll('.ko-card')).toHaveLength(3)
  })
})

describe('KnockoutTable — score inputs enabled/disabled by resolved state', () => {
  test('score inputs are enabled for resolved matches', () => {
    render(<KnockoutTable matches={[resolvedMatch]} predictions={emptyPredictions} onChange={noop} />)
    const inputs = document.querySelectorAll<HTMLInputElement>('.score-input')
    expect(inputs).toHaveLength(2)
    inputs.forEach(input => expect(input.disabled).toBe(false))
  })

  test('score inputs are disabled for unresolved matches', () => {
    render(<KnockoutTable matches={[unresolvedMatch]} predictions={emptyPredictions} onChange={noop} />)
    const inputs = document.querySelectorAll<HTMLInputElement>('.score-input')
    expect(inputs).toHaveLength(2)
    inputs.forEach(input => expect(input.disabled).toBe(true))
  })

  test('shows inputs for all matches — enabled for resolved, disabled for unresolved', () => {
    render(<KnockoutTable matches={[resolvedMatch, unresolvedMatch]} predictions={emptyPredictions} onChange={noop} />)
    // 2 matches × 2 inputs = 4 total
    expect(document.querySelectorAll('.score-input')).toHaveLength(4)
  })
})

describe('KnockoutTable — unresolved match scores are null', () => {
  test('shows empty inputs for unresolved match even when predictions exist', () => {
    const predictions: Record<string, MatchScores> = { '90': { home: 3, away: 1 } }
    render(<KnockoutTable matches={[unresolvedMatch]} predictions={predictions} onChange={noop} />)
    const inputs = document.querySelectorAll<HTMLInputElement>('.score-input')
    expect(inputs[0].value).toBe('')
    expect(inputs[1].value).toBe('')
  })
})

describe('KnockoutTable — draw winner selection', () => {
  test('no draw badge when prediction is decisive (2-1)', () => {
    const predictions: Record<string, MatchScores> = { '89': { home: 2, away: 1 } }
    render(<KnockoutTable matches={[resolvedMatch]} predictions={predictions} onChange={noop} />)
    expect(document.querySelector('.ko-draw-badge')).toBeNull()
  })

  test('no draw badge when scores are incomplete', () => {
    const predictions: Record<string, MatchScores> = { '89': { home: 1, away: null } }
    render(<KnockoutTable matches={[resolvedMatch]} predictions={predictions} onChange={noop} />)
    expect(document.querySelector('.ko-draw-badge')).toBeNull()
  })

  test('draw badge appears when both scores are equal', () => {
    const predictions: Record<string, MatchScores> = { '89': { home: 1, away: 1 } }
    render(<KnockoutTable matches={[resolvedMatch]} predictions={predictions} onChange={noop} />)
    expect(document.querySelector('.ko-draw-badge')).not.toBeNull()
    expect(document.querySelector('.ko-draw-badge')!.textContent).toBe('בחר מנצחת')
  })

  test('clicking home team area calls onChange with drawWinner home', async () => {
    const onChange = vi.fn()
    const predictions: Record<string, MatchScores> = { '89': { home: 1, away: 1 } }
    render(<KnockoutTable matches={[resolvedMatch]} predictions={predictions} onChange={onChange} />)
    const areas = document.querySelectorAll<HTMLElement>('.ko-team-click--selectable')
    await userEvent.click(areas[0])
    expect(onChange).toHaveBeenCalledWith('89', { home: 1, away: 1, drawWinner: 'home' })
  })

  test('clicking away team area calls onChange with drawWinner away', async () => {
    const onChange = vi.fn()
    const predictions: Record<string, MatchScores> = { '89': { home: 1, away: 1 } }
    render(<KnockoutTable matches={[resolvedMatch]} predictions={predictions} onChange={onChange} />)
    const areas = document.querySelectorAll<HTMLElement>('.ko-team-click--selectable')
    await userEvent.click(areas[1])
    expect(onChange).toHaveBeenCalledWith('89', { home: 1, away: 1, drawWinner: 'away' })
  })
})

describe('KnockoutTable — draw winner selection state', () => {
  test('home team area has selected class when drawWinner is home', () => {
    const predictions: Record<string, MatchScores> = { '89': { home: 1, away: 1, drawWinner: 'home' } }
    render(<KnockoutTable matches={[resolvedMatch]} predictions={predictions} onChange={noop} />)
    const areas = document.querySelectorAll<HTMLElement>('.ko-team-click--selectable')
    expect(areas[0].classList.contains('ko-team-click--selected')).toBe(true)
    expect(areas[1].classList.contains('ko-team-click--selected')).toBe(false)
  })

  test('away team area has selected class when drawWinner is away', () => {
    const predictions: Record<string, MatchScores> = { '89': { home: 1, away: 1, drawWinner: 'away' } }
    render(<KnockoutTable matches={[resolvedMatch]} predictions={predictions} onChange={noop} />)
    const areas = document.querySelectorAll<HTMLElement>('.ko-team-click--selectable')
    expect(areas[0].classList.contains('ko-team-click--selected')).toBe(false)
    expect(areas[1].classList.contains('ko-team-click--selected')).toBe(true)
  })

  test('neither team area has selected class when drawWinner is unset', () => {
    const predictions: Record<string, MatchScores> = { '89': { home: 1, away: 1 } }
    render(<KnockoutTable matches={[resolvedMatch]} predictions={predictions} onChange={noop} />)
    const areas = document.querySelectorAll<HTMLElement>('.ko-team-click--selectable')
    expect(areas[0].classList.contains('ko-team-click--selected')).toBe(false)
    expect(areas[1].classList.contains('ko-team-click--selected')).toBe(false)
  })

  test('badge disappears when drawWinner is set', () => {
    const predictions: Record<string, MatchScores> = { '89': { home: 1, away: 1, drawWinner: 'home' } }
    render(<KnockoutTable matches={[resolvedMatch]} predictions={predictions} onChange={noop} />)
    expect(document.querySelector('.ko-draw-badge')).toBeNull()
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

  test('score change on draw-with-drawWinner match omits drawWinner from onChange payload', async () => {
    const onChange = vi.fn()
    const predictions: Record<string, MatchScores> = { '89': { home: null, away: 1, drawWinner: 'home' } }
    render(<KnockoutTable matches={[resolvedMatch]} predictions={predictions} onChange={onChange} />)
    const inputs = document.querySelectorAll<HTMLInputElement>('.score-input')
    await userEvent.type(inputs[0], '2')
    expect(onChange).toHaveBeenCalledWith('89', { home: 2, away: 1 })
  })

  test('does not fire onChange when typing into a disabled (unresolved) input', async () => {
    const onChange = vi.fn()
    render(<KnockoutTable matches={[unresolvedMatch]} predictions={emptyPredictions} onChange={onChange} />)
    const inputs = document.querySelectorAll<HTMLInputElement>('.score-input')
    await userEvent.type(inputs[0], '2')
    expect(onChange).not.toHaveBeenCalled()
  })
})
