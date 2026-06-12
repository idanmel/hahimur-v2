import { render, screen, within, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import FormPage from './FormPage'
import { GROUPS } from '../../shared/groups'

vi.mock('../../Nav', () => ({ default: () => null, USER_STORAGE_EVENT: 'userStorageUpdated' }))
vi.mock('../../formView/knockout/KnockoutTable', () => ({ default: () => null }))
vi.mock('../../formView/thirdPlace/ThirdPlaceTable', () => ({ default: () => null }))
vi.mock('../../formView/knockout/ChampionBanner', () => ({ default: () => null }))

beforeEach(() => localStorage.clear())

function setup() {
  render(<FormPage />)
  // Mexico and South Africa each appear in multiple matches; grab match A1 (first occurrence)
  const mexicoInput = screen.getAllByLabelText('מקסיקו')[0]
  const southAfricaInput = screen.getAllByLabelText('דרום אפריקה')[0]
  return { mexicoInput, southAfricaInput }
}

describe('Slice 4 — Group A (6 matches)', () => {
  test('standings update when a non-opening match score is entered', () => {
    render(<FormPage />)
    // Match A2: South Korea (home) vs Czech Republic. South Korea appears as home first in A2.
    const southKoreaInputs = screen.getAllByLabelText('דרום קוריאה')
    const czechInputs = screen.getAllByLabelText('צ׳כיה')
    fireEvent.change(southKoreaInputs[0], { target: { value: '2' } })
    fireEvent.change(czechInputs[0], { target: { value: '1' } })
    expect(within(screen.getByRole('row', { name: /דרום קוריאה/ })).getByText('3')).toBeInTheDocument()
  })
})

describe('Slice 8 — localStorage persistence', () => {
  test('predictions survive a remount (simulated refresh)', () => {
    const { unmount } = render(<FormPage />)

    const mexicoInput = screen.getAllByLabelText('מקסיקו')[0]
    fireEvent.change(mexicoInput, { target: { value: '3' } })

    unmount()
    render(<FormPage />)

    expect(screen.getAllByLabelText('מקסיקו')[0]).toHaveValue('3')
  })
})

describe('Slice 9/10 — group navigation (B–L)', () => {
  test('clicking a group button switches to that group (12 inputs, no Group A teams)', () => {
    render(<FormPage />)
    fireEvent.click(screen.getByRole('button', { name: GROUPS['B'].he }))
    expect(screen.queryAllByLabelText('מקסיקו')).toHaveLength(0)
    const groupSection = document.querySelector('section.content-section') as HTMLElement
    expect(within(groupSection).getAllByRole('textbox')).toHaveLength(12)
  })
})

// Symmetric 3-way cycle among Mexico, South Korea, Czech Republic
// SK beats Mexico (A4), CZ beats SK (A2), Mexico beats CZ (A5) — each 1-0
// All three draw vs South Africa 1-1 (A1, A3, A6)
// Result: Mexico/SK/CZ all on 4pts, GD 0, 2 goals — unresolvable
const tiedPredictions = {
  A1: { home: 1, away: 1 },
  A2: { home: 0, away: 1 },
  A3: { home: 1, away: 1 },
  A4: { home: 0, away: 1 },
  A5: { home: 0, away: 1 },
  A6: { home: 1, away: 1 },
}

describe('Tie detection', () => {
  test('group button gets group-cell--error class when teams are unresolvably tied', () => {
    localStorage.setItem('predictions', JSON.stringify(tiedPredictions))
    render(<FormPage />)
    expect(screen.getByRole('button', { name: 'א' })).toHaveClass('group-cell--error')
  })

  test('group button has no error class when there is no tie', () => {
    render(<FormPage />)
    expect(screen.getByRole('button', { name: 'א' })).not.toHaveClass('group-cell--error')
  })

  test('warning banner appears above matches listing the tied teams', () => {
    localStorage.setItem('predictions', JSON.stringify(tiedPredictions))
    render(<FormPage />)
    const banner = screen.getByRole('alert')
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveTextContent('מקסיקו')
    expect(banner).toHaveTextContent('דרום קוריאה')
    expect(banner).toHaveTextContent('צ׳כיה')
  })

  test('no warning banner when there is no tie', () => {
    render(<FormPage />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('Group completion indicator', () => {
  const completePredictionsA = {
    A1: { home: 2, away: 1 },
    A2: { home: 1, away: 0 },
    A3: { home: 3, away: 0 },
    A4: { home: 1, away: 2 },
    A5: { home: 0, away: 0 },
    A6: { home: 2, away: 2 },
  }

  test('group button gets group-cell--complete when all 6 predictions are filled with no ties', () => {
    localStorage.setItem('predictions', JSON.stringify(completePredictionsA))
    render(<FormPage />)
    expect(screen.getByRole('button', { name: 'א' })).toHaveClass('group-cell--complete')
  })

  test('group button has no complete class when predictions are partially filled', () => {
    localStorage.setItem('predictions', JSON.stringify({ A1: { home: 2, away: 1 } }))
    render(<FormPage />)
    expect(screen.getByRole('button', { name: 'א' })).not.toHaveClass('group-cell--complete')
  })

  test('group button has no complete class with no predictions', () => {
    render(<FormPage />)
    expect(screen.getByRole('button', { name: 'א' })).not.toHaveClass('group-cell--complete')
  })

  test('group with all predictions filled but a tie is NOT complete', () => {
    localStorage.setItem('predictions', JSON.stringify(tiedPredictions))
    render(<FormPage />)
    const button = screen.getByRole('button', { name: 'א' })
    expect(button).toHaveClass('group-cell--error')
    expect(button).not.toHaveClass('group-cell--complete')
  })
})

describe('Save predictions', () => {
  test('Save button downloads predictions as JSON', () => {
    localStorage.setItem('predictions', JSON.stringify({ A1: { home: 2, away: 1 } }))
    localStorage.setItem('topGoalscorer', 'Mbappé')

    render(<FormPage />)

    const mockClick = vi.fn()
    const mockAnchor = { href: '', download: '', click: mockClick }
    const original = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag, ...args) => {
      if (tag === 'a') return mockAnchor as unknown as HTMLElement
      return original(tag, ...args)
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:fake')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    fireEvent.click(screen.getByRole('button', { name: /save|שמור/i }))

    expect(mockAnchor.download).toBe('wc2026-predictions.json')
    expect(mockClick).toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})

describe('Slice 3b — group standings table', () => {
  test('entering scores updates the standings', () => {
    const { mexicoInput, southAfricaInput } = setup()
    fireEvent.change(mexicoInput, { target: { value: '2' } })
    fireEvent.change(southAfricaInput, { target: { value: '1' } })

    // After Mexico 2-1 South Africa: Mexico gets 3 pts, South Africa gets 0
    // "3" only appears in Mexico's points cell; "0" only in South Africa's points cell
    expect(within(screen.getByRole('row', { name: /מקסיקו/ })).getByText('3')).toBeInTheDocument()
    expect(within(screen.getByRole('row', { name: /דרום אפריקה/ })).getAllByText('0').length).toBeGreaterThan(0)
  })

  test('changing a score updates standings immediately', () => {
    const { mexicoInput, southAfricaInput } = setup()
    fireEvent.change(mexicoInput, { target: { value: '1' } })
    fireEvent.change(southAfricaInput, { target: { value: '0' } })

    const mexicoRow = screen.getByRole('row', { name: /מקסיקו/ })
    expect(within(mexicoRow).getByText('3')).toBeInTheDocument()

    fireEvent.change(southAfricaInput, { target: { value: '2' } })

    const southAfricaRow = screen.getByRole('row', { name: /דרום אפריקה/ })
    expect(within(southAfricaRow).getByText('3')).toBeInTheDocument()
  })
})


