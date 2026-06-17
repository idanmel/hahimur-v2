import { render, screen } from '@testing-library/react'
import GroupStatsPage from './GroupStatsPage'
import { vi } from 'vitest'

vi.mock('../../../users/index', () => ({ get USERS() { return [] } }))
// Global chrome is covered by Nav.test; stub it out of page-level assertions.
vi.mock('../../../Nav', () => ({ default: () => null, USER_STORAGE_EVENT: 'userStorageUpdated' }))

test('renders group A heading', () => {
  render(<GroupStatsPage groupLetter="A" />)
  expect(screen.getByRole('heading', { name: /קבוצה א/i })).toBeInTheDocument()
})

test('shows standings section', () => {
  render(<GroupStatsPage groupLetter="A" />)
  expect(screen.getByText(/טבלת הבית/)).toBeInTheDocument()
})

test('shows predictions section', () => {
  render(<GroupStatsPage groupLetter="A" />)
  expect(screen.getByText('תחזיות הקבוצה')).toBeInTheDocument()
})

test('shows matches section', () => {
  render(<GroupStatsPage groupLetter="A" />)
  expect(screen.getByText('תוצאות הבית')).toBeInTheDocument()
})

test('shows group A teams', () => {
  render(<GroupStatsPage groupLetter="A" />)
  expect(screen.getAllByText('מקסיקו').length).toBeGreaterThan(0)
})
