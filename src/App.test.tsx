import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import App from './App'

vi.mock('./users/index', () => ({
  get USERS() { return [] },
  get USERS_SORTED() { return [] },
}))

// Global chrome is covered by Nav.test; stub it so page assertions aren't
// polluted by the nav's participant picker.
vi.mock('./Nav', () => ({ default: () => null, USER_STORAGE_EVENT: 'userStorageUpdated' }))

test('renders MatchPredictionsPage at /matches/A1', () => {
  vi.stubGlobal('location', { pathname: '/matches/a1' })
  render(<App />)
  expect(screen.getByText('אין תחזיות למשחק זה')).toBeInTheDocument()
})

test('renders MatchPredictionsPage at /matches/b1 with correct teams', () => {
  vi.stubGlobal('location', { pathname: '/matches/b1', search: '' })
  render(<App />)
  expect(screen.getAllByText('קנדה').length).toBeGreaterThan(0)
})

test('renders the read-only bracket page at /bracket', () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response())))
  vi.stubGlobal('location', { hostname: 'example.com', pathname: '/bracket', search: '' })
  render(<App />)
  expect(screen.getByText('שלב ה-32')).toBeInTheDocument()
})

test('routes every round-of-32 numeric id to the knockout match page', () => {
  for (let num = 73; num <= 88; num++) {
    vi.stubGlobal('location', { pathname: `/matches/${num}`, search: '' })
    const { unmount } = render(<App />)
    expect(screen.getByTestId('knockout-match-page')).toBeInTheDocument()
    unmount()
  }
})
