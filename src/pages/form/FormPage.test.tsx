import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, afterEach } from 'vitest'
import FormPage from './FormPage'
import { GROUPS } from '../../shared/groups'

beforeEach(() => localStorage.clear())
afterEach(() => vi.useRealTimers())

function setup() {
  const user = userEvent.setup()
  render(<FormPage />)
  // Mexico and South Africa each appear in multiple matches; grab match A1 (first occurrence)
  const mexicoInput = screen.getAllByLabelText('מקסיקו')[0]
  const southAfricaInput = screen.getAllByLabelText('דרום אפריקה')[0]
  return { user, mexicoInput, southAfricaInput }
}

test('predictions page shows title', () => {
  render(<FormPage />)
  expect(screen.getByText('ההימור 2026')).toBeInTheDocument()
})

describe('Slice 4 — Group A (6 matches)', () => {
  test('all 6 Group A matches are visible by default', () => {
    render(<FormPage />)
    const groupSection = document.querySelector('section.content-section') as HTMLElement
    expect(within(groupSection).getAllByRole('textbox')).toHaveLength(12)
  })

  test('standings update when a non-opening match score is entered', async () => {
    const user = userEvent.setup()
    render(<FormPage />)
    // Match A2: South Korea (home) vs Czech Republic. South Korea appears as home first in A2.
    const southKoreaInputs = screen.getAllByLabelText('דרום קוריאה')
    const czechInputs = screen.getAllByLabelText('צ׳כיה')
    await user.type(southKoreaInputs[0], '2')
    await user.type(czechInputs[0], '1')
    expect(within(screen.getByRole('row', { name: /דרום קוריאה/ })).getByText('3')).toBeInTheDocument()
  })
})

describe('Slice 8 — localStorage persistence', () => {
  test('predictions survive a remount (simulated refresh)', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<FormPage />)

    const mexicoInput = screen.getAllByLabelText('מקסיקו')[0]
    await user.type(mexicoInput, '3')

    unmount()
    render(<FormPage />)

    expect(screen.getAllByLabelText('מקסיקו')[0]).toHaveValue('3')
  })
})

describe('Slice 9/10 — group navigation (B–L)', () => {
  const remaining = Object.entries(GROUPS)
    .filter(([k]) => k !== 'A')
    .map(([k, v]) => [k, v.he] as [string, string])

  test.each(remaining)('group %s button is enabled', (_letter, hebrew) => {
    render(<FormPage />)
    expect(screen.getByRole('button', { name: hebrew })).not.toBeDisabled()
  })

  test.each(remaining)('group %s shows 6 matches (12 inputs) when selected', async (_letter, hebrew) => {
    const user = userEvent.setup()
    render(<FormPage />)
    await user.click(screen.getByRole('button', { name: hebrew }))
    // Group A's Mexico must be gone — confirming we really switched groups
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
  test('Save button downloads predictions as JSON', async () => {
    const user = userEvent.setup()
    localStorage.setItem('predictions', JSON.stringify({ A1: { home: 2, away: 1 } }))
    localStorage.setItem('topGoalscorer', 'Mbappé')

    render(<FormPage />)

    const mockClick = vi.fn()
    const mockAnchor = { href: '', download: '', click: mockClick }
    const original = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag, ...args) => {
      if (tag === 'a') return mockAnchor as any
      return original(tag as any, ...args)
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:fake')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    await user.click(screen.getByRole('button', { name: /save|שמור/i }))

    expect(mockAnchor.download).toBe('wc2026-predictions.json')
    expect(mockClick).toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})

describe('Slice 3b — group standings table', () => {
  test('standings table shows all 4 Group A teams', () => {
    render(<FormPage />)
    const table = screen.getAllByRole('table')[0]
    expect(within(table).getByText('מקסיקו')).toBeInTheDocument()
    expect(within(table).getByText('דרום אפריקה')).toBeInTheDocument()
    expect(within(table).getByText('דרום קוריאה')).toBeInTheDocument()
    expect(within(table).getByText('צ׳כיה')).toBeInTheDocument()
  })

  test('entering scores updates the standings', async () => {
    const { user, mexicoInput, southAfricaInput } = setup()
    await user.type(mexicoInput, '2')
    await user.type(southAfricaInput, '1')

    // After Mexico 2-1 South Africa: Mexico gets 3 pts, South Africa gets 0
    // "3" only appears in Mexico's points cell; "0" only in South Africa's points cell
    expect(within(screen.getByRole('row', { name: /מקסיקו/ })).getByText('3')).toBeInTheDocument()
    expect(within(screen.getByRole('row', { name: /דרום אפריקה/ })).getAllByText('0').length).toBeGreaterThan(0)
  })

  test('changing a score updates standings immediately', async () => {
    const { user, mexicoInput, southAfricaInput } = setup()
    await user.type(mexicoInput, '1')
    await user.type(southAfricaInput, '0')

    const mexicoRow = screen.getByRole('row', { name: /מקסיקו/ })
    expect(within(mexicoRow).getByText('3')).toBeInTheDocument()

    await user.clear(southAfricaInput)
    await user.type(southAfricaInput, '2')

    const southAfricaRow = screen.getByRole('row', { name: /דרום אפריקה/ })
    expect(within(southAfricaRow).getByText('3')).toBeInTheDocument()
  })
})

describe('Knockout stages', () => {
  test('R16, QF, SF, 3P, and Final section headings are visible', () => {
    render(<FormPage />)
    expect(screen.getByText('שמינית גמר')).toBeInTheDocument()
    expect(screen.getByText('רבע גמר')).toBeInTheDocument()
    expect(screen.getByText('חצי גמר')).toBeInTheDocument()
    expect(screen.getByText('מקום שלישי')).toBeInTheDocument()
    expect(screen.getByText('גמר')).toBeInTheDocument()
  })
})

describe('Deadline lock', () => {
  test('group score inputs are editable before the deadline', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-06T23:59:59'))
    render(<FormPage />)
    const groupSection = document.querySelector('section.content-section') as HTMLElement
    expect(within(groupSection).getAllByRole('textbox').length).toBeGreaterThan(0)
  })

  test('group score inputs are hidden and save button is disabled after the deadline', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-07T00:00:01'))
    render(<FormPage />)
    const groupSection = document.querySelector('section.content-section') as HTMLElement
    expect(within(groupSection).queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.getByRole('button', { name: /שמור/i })).toBeDisabled()
  })

  test('goalscorer input is disabled after the deadline', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-07T00:00:01'))
    render(<FormPage />)
    expect(screen.getByPlaceholderText('שם השחקן...')).toBeDisabled()
  })
})
