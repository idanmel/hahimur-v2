import { render, screen, fireEvent } from '@testing-library/react'
import { vi, afterEach } from 'vitest'
import HomePage from './HomePage'

afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
})

test('home page shows the upcoming match cards during the group stage', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-12T00:00:00Z'))
  render(<HomePage />)
  expect(screen.getAllByTestId('next-match').length).toBeGreaterThanOrEqual(1)
})

test('home page shows the top three card', () => {
  render(<HomePage />)
  expect(screen.getByTestId('top-three')).toBeInTheDocument()
  // Exact row count depends on live standings (ties expand the list),
  // which LeaderboardGlance.test.tsx covers with fixtures.
  expect(screen.getAllByTestId('top-three-row').length).toBeGreaterThanOrEqual(3)
})

test('home page shows the global name picker with no one selected by default', () => {
  render(<HomePage />)
  expect(screen.getByRole('combobox')).toHaveValue('')
})

test('picking a name shows that user\'s own prediction on an upcoming match', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-12T00:00:00Z')) // group stage
  render(<HomePage />)
  expect(screen.queryByTestId('your-prediction')).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'עידן מלמד' } })
  fireEvent.click(screen.getByRole('tab', { name: 'המשחקים הבאים' })) // upcoming fixtures
  expect(screen.getAllByTestId('your-prediction').length).toBeGreaterThanOrEqual(1)
})

test('remembers the picked name across reloads', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-12T00:00:00Z')) // group stage
  const first = render(<HomePage />)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'עידן מלמד' } })
  first.unmount()

  render(<HomePage />) // a fresh mount stands in for a page reload
  // Identified now, so the picker has collapsed to the greeting — the name persists there.
  expect(screen.getByRole('button', { name: /עידן מלמד/ })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('tab', { name: 'המשחקים הבאים' })) // upcoming fixtures
  expect(screen.getAllByTestId('your-prediction').length).toBeGreaterThanOrEqual(1)
})

test('home page shows title', () => {
  render(<HomePage />)
  expect(screen.getByText('ההימור 2026')).toBeInTheDocument()
})

test('home page shows welcome message', () => {
  render(<HomePage />)
  expect(screen.getByText('ברוכים הבאים להימור המסורתי שלנו!')).toBeInTheDocument()
})
