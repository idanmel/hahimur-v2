import { render, screen } from '@testing-library/react'
import FormsPage from './FormsPage'

// --- Slice 1: /forms route renders a heading ---

test('forms page shows הטפסים heading', () => {
  render(<FormsPage />)
  expect(screen.getByRole('heading', { name: 'הטפסים' })).toBeInTheDocument()
})

// --- Slice 2: shows user name and read-only predictions view ---

test('shows user name טל ליכטר', () => {
  render(<FormsPage />)
  expect(screen.getByText('טל ליכטר')).toBeInTheDocument()
})

test('shows group navigation tabs', () => {
  render(<FormsPage />)
  expect(screen.getByRole('button', { name: 'א' })).toBeInTheDocument()
})

// --- Slice 3: hardcoded prediction scores for טל ליכטר ---

test('shows hardcoded score for Mexico vs South Africa (A1 home = 2)', () => {
  render(<FormsPage />)
  const homeScores = screen.getAllByTestId('score-home')
  expect(homeScores[0]).toHaveTextContent('2')
})

// --- Slice 4: hardcoded KO scores for טל ליכטר ---

test('shows hardcoded KO scores (more than just the 12 group-A scores)', () => {
  render(<FormsPage />)
  const allScoreEls = document.querySelectorAll('.match-score-static')
  const nonEmpty = Array.from(allScoreEls).filter(el => el.textContent !== '–')
  expect(nonEmpty.length).toBeGreaterThan(12)
})
