import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResultsPage from './ResultsPage'

// --- Slice 1: /results route renders a heading ---

test('results page shows תוצאות heading', () => {
  render(<ResultsPage results={{ predictions: {}, topGoalscorer: '' }} />)
  expect(screen.getByRole('heading', { name: 'תוצאות' })).toBeInTheDocument()
})

test('results page does not show the prediction form title', () => {
  render(<ResultsPage results={{ predictions: {}, topGoalscorer: '' }} />)
  expect(screen.queryByText('ההימור 2026')).not.toBeInTheDocument()
})

// --- Slice 3: Match scores shown read-only, no inputs ---

test('results page has no input elements', () => {
  render(<ResultsPage results={{ predictions: {}, topGoalscorer: '' }} />)
  expect(document.querySelectorAll('input')).toHaveLength(0)
})

// --- Slice 4: Group selector navigation ---

test('clicking group ב shows group B label', async () => {
  const user = userEvent.setup()
  render(<ResultsPage results={{ predictions: {}, topGoalscorer: '' }} />)
  await user.click(screen.getByRole('button', { name: 'ב' }))
  expect(screen.getByRole('button', { name: 'ב' })).toHaveClass('group-cell--active')
})

// --- Slice 5: Champion banner ---

test('champion banner not shown when final has no result', () => {
  render(<ResultsPage results={{ predictions: {}, topGoalscorer: '' }} />)
  expect(screen.queryByText('אלופת העולם 2026')).not.toBeInTheDocument()
})
