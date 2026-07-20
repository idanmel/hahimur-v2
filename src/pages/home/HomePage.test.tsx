import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach } from 'vitest'
import HomePage from './HomePage'

afterEach(() => {
  localStorage.clear()
})

test('home page shows the tournament wrap card now that the tournament is over', () => {
  render(<HomePage />)
  expect(screen.getByTestId('tournament-wrap')).toBeInTheDocument()
  expect(screen.getByText('אלופת העולם 2026')).toBeInTheDocument()
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

test('remembers the picked name across reloads', () => {
  const first = render(<HomePage />)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'עידן מלמד' } })
  first.unmount()

  render(<HomePage />) // a fresh mount stands in for a page reload
  // Identified now, so the picker has collapsed to the greeting — the name persists there.
  expect(screen.getByRole('button', { name: /עידן מלמד/ })).toBeInTheDocument()
})

test('home page shows title', () => {
  render(<HomePage />)
  expect(screen.getByText('ההימור 2026')).toBeInTheDocument()
})

test('home page shows welcome message', () => {
  render(<HomePage />)
  expect(screen.getByText('ברוכים הבאים להימור המסורתי שלנו!')).toBeInTheDocument()
})
