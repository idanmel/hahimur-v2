import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import App from './App'

vi.mock('./users/index', () => ({
  get USERS() { return [] },
}))

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
