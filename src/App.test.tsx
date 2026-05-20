import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { GROUPS } from './lib/groups'

beforeEach(() => localStorage.clear())

function setup() {
  const user = userEvent.setup()
  render(<App />)
  // Mexico and South Africa each appear in multiple matches; grab match A1 (first occurrence)
  const mexicoInput = screen.getAllByLabelText('מקסיקו')[0]
  const southAfricaInput = screen.getAllByLabelText('דרום אפריקה')[0]
  return { user, mexicoInput, southAfricaInput }
}

test('predictions page shows title', () => {
  render(<App />)
  expect(screen.getByText('ההימור 2026')).toBeInTheDocument()
})

describe('Slice 2 — one match, fillable', () => {
  test('user enters valid scores for both teams', async () => {
    const { user, mexicoInput, southAfricaInput } = setup()
    await user.type(mexicoInput, '2')
    await user.type(southAfricaInput, '1')
    expect(mexicoInput).toHaveValue('2')
    expect(southAfricaInput).toHaveValue('1')
  })

  test('valid input: zero is accepted', async () => {
    const { user, mexicoInput } = setup()
    await user.type(mexicoInput, '0')
    expect(mexicoInput).toHaveValue('0')
  })

  test('non-digit characters are blocked: minus sign is ignored', async () => {
    const { user, mexicoInput } = setup()
    await user.type(mexicoInput, '-1')
    expect(mexicoInput).toHaveValue('1')
  })

  test('non-digit characters are blocked: decimal point is ignored', async () => {
    const { user, mexicoInput } = setup()
    await user.type(mexicoInput, '1.5')
    expect(mexicoInput).toHaveValue('15')
  })

  test('non-digit characters are blocked: letters are ignored', async () => {
    const { user, mexicoInput } = setup()
    await user.type(mexicoInput, 'abc')
    expect(mexicoInput).toHaveValue('')
  })

  test('non-digit characters are blocked: letter after digit is ignored', async () => {
    const { user, mexicoInput } = setup()
    await user.type(mexicoInput, '1a')
    expect(mexicoInput).toHaveValue('1')
  })

  test('non-digit characters are blocked: space is ignored', async () => {
    const { user, mexicoInput } = setup()
    await user.type(mexicoInput, ' ')
    expect(mexicoInput).toHaveValue('')
  })

  test('non-digit characters are blocked: special character is ignored', async () => {
    const { user, mexicoInput } = setup()
    await user.type(mexicoInput, '!')
    expect(mexicoInput).toHaveValue('')
  })

  test('leading zeros are stripped: 0123 becomes 123', async () => {
    const { user, mexicoInput } = setup()
    await user.type(mexicoInput, '0123')
    expect(mexicoInput).toHaveValue('123')
  })
})


describe('Slice 4 — Group A (6 matches)', () => {
  test('all 6 Group A matches are visible by default', () => {
    render(<App />)
    expect(screen.getAllByRole('textbox')).toHaveLength(12)
  })

  test('standings update when a non-opening match score is entered', async () => {
    const user = userEvent.setup()
    render(<App />)
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
    const { unmount } = render(<App />)

    const mexicoInput = screen.getAllByLabelText('מקסיקו')[0]
    await user.type(mexicoInput, '3')

    unmount()
    render(<App />)

    expect(screen.getAllByLabelText('מקסיקו')[0]).toHaveValue('3')
  })
})

describe('Slice 9/10 — group navigation (B–L)', () => {
  const remaining = Object.entries(GROUPS)
    .filter(([k]) => k !== 'A')
    .map(([k, v]) => [k, v.he] as [string, string])

  test.each(remaining)('group %s button is enabled', (_letter, hebrew) => {
    render(<App />)
    expect(screen.getByRole('button', { name: hebrew })).not.toBeDisabled()
  })

  test.each(remaining)('group %s shows 6 matches (12 inputs) when selected', async (_letter, hebrew) => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: hebrew }))
    // Group A's Mexico must be gone — confirming we really switched groups
    expect(screen.queryAllByLabelText('מקסיקו')).toHaveLength(0)
    expect(screen.getAllByRole('textbox')).toHaveLength(12)
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
    render(<App />)
    expect(screen.getByRole('button', { name: 'א' })).toHaveClass('group-cell--error')
  })

  test('group button has no error class when there is no tie', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'א' })).not.toHaveClass('group-cell--error')
  })

  test('warning banner appears above matches listing the tied teams', () => {
    localStorage.setItem('predictions', JSON.stringify(tiedPredictions))
    render(<App />)
    const banner = screen.getByRole('alert')
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveTextContent('מקסיקו')
    expect(banner).toHaveTextContent('דרום קוריאה')
    expect(banner).toHaveTextContent('צ׳כיה')
  })

  test('no warning banner when there is no tie', () => {
    render(<App />)
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
    render(<App />)
    expect(screen.getByRole('button', { name: 'א' })).toHaveClass('group-cell--complete')
  })

  test('group button has no complete class when predictions are partially filled', () => {
    localStorage.setItem('predictions', JSON.stringify({ A1: { home: 2, away: 1 } }))
    render(<App />)
    expect(screen.getByRole('button', { name: 'א' })).not.toHaveClass('group-cell--complete')
  })

  test('group button has no complete class with no predictions', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'א' })).not.toHaveClass('group-cell--complete')
  })

  test('group with all predictions filled but a tie is NOT complete', () => {
    localStorage.setItem('predictions', JSON.stringify(tiedPredictions))
    render(<App />)
    const button = screen.getByRole('button', { name: 'א' })
    expect(button).toHaveClass('group-cell--error')
    expect(button).not.toHaveClass('group-cell--complete')
  })
})

describe('Slice 3b — group standings table', () => {
  test('standings table shows all 4 Group A teams', () => {
    render(<App />)
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
