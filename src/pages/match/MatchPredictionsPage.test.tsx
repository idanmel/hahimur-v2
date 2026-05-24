import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import MatchPredictionsPage from './MatchPredictionsPage'

type MockUser = { label: string; predictions: Record<string, { home: number | null; away: number | null }>; topGoalscorer: string }
let mockUsers: MockUser[] = []

vi.mock('../../users/index', () => ({
  get USERS() { return mockUsers },
}))

test('shows Hebrew message when there are no users', () => {
  mockUsers = []
  render(<MatchPredictionsPage />)
  expect(screen.getByText('אין תחזיות למשחק זה')).toBeInTheDocument()
})

test('shows user name when one user has a prediction for A1', () => {
  mockUsers = [
    { label: 'שחקן א', predictions: { A1: { home: 2, away: 1 } }, topGoalscorer: '' },
  ]
  render(<MatchPredictionsPage />)
  expect(screen.getByText(/שחקן א/)).toBeInTheDocument()
  expect(screen.queryByText('אין תחזיות למשחק זה')).not.toBeInTheDocument()
})

test('shows user with – for a partially unpredicted A1 match', () => {
  mockUsers = [
    { label: 'שחקן א', predictions: { A1: { home: 2, away: null } }, topGoalscorer: '' },
  ]
  render(<MatchPredictionsPage />)
  expect(screen.getByText(/שחקן א/)).toBeInTheDocument()
  expect(screen.queryByText('אין תחזיות למשחק זה')).not.toBeInTheDocument()
})

test('shows user with – scores when A1 prediction is null', () => {
  mockUsers = [
    { label: 'שחקן א', predictions: { A1: { home: null, away: null } }, topGoalscorer: '' },
  ]
  render(<MatchPredictionsPage />)
  expect(screen.getByText(/שחקן א/)).toBeInTheDocument()
  expect(screen.queryByText('אין תחזיות למשחק זה')).not.toBeInTheDocument()
})

test('shows all user names when multiple users have predictions for A1', () => {
  mockUsers = [
    { label: 'שחקן א', predictions: { A1: { home: 2, away: 1 } }, topGoalscorer: '' },
    { label: 'שחקן ב', predictions: { A1: { home: 0, away: 0 } }, topGoalscorer: '' },
    { label: 'שחקן ג', predictions: { A1: { home: 3, away: 2 } }, topGoalscorer: '' },
  ]
  render(<MatchPredictionsPage />)
  expect(screen.getByText(/שחקן א/)).toBeInTheDocument()
  expect(screen.getByText(/שחקן ב/)).toBeInTheDocument()
  expect(screen.getByText(/שחקן ג/)).toBeInTheDocument()
})
