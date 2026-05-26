import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import MatchPredictionsPage from './MatchPredictionsPage'

type MockUser = { label: string; predictions: Record<string, { home: number | null; away: number | null }>; topGoalscorer: string }
let mockUsers: MockUser[] = []

vi.mock('../../users/index', () => ({
  get USERS() { return mockUsers },
}))

function getCounts() {
  return screen.getAllByTestId('pred-count').map(el => el.textContent)
}

test('shows not found message for unknown matchId', () => {
  mockUsers = []
  render(<MatchPredictionsPage matchId="DOESNOTEXIST" />)
  expect(screen.getByText('משחק לא נמצא')).toBeInTheDocument()
})

test('shows Hebrew message when there are no users', () => {
  mockUsers = []
  render(<MatchPredictionsPage matchId="A1" />)
  expect(screen.getByText('אין תחזיות למשחק זה')).toBeInTheDocument()
})

test('shows correct teams when matchId is B1', () => {
  mockUsers = []
  render(<MatchPredictionsPage matchId="B1" />)
  expect(screen.getAllByText('קנדה').length).toBeGreaterThan(0)
  expect(screen.getAllByText('בוסניה והרצגובינה').length).toBeGreaterThan(0)
})

test('shows score from B1 prediction when matchId is B1', () => {
  mockUsers = [
    { label: 'שחקן א', predictions: { B1: { home: 2, away: 1 } }, topGoalscorer: '' },
  ]
  render(<MatchPredictionsPage matchId="B1" />)
  const row = screen.getByText('שחקן א').closest('.prediction-row')!
  expect(row).toHaveTextContent('2')
  expect(row).toHaveTextContent('1')
})

test('shows summary table even when no one predicted the game', () => {
  mockUsers = []
  render(<MatchPredictionsPage />)
  expect(getCounts()).toEqual(['0', '0', '0'])
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

test('shows summary counts: 2 home wins, 1 draw, 0 away wins', () => {
  mockUsers = [
    { label: 'שחקן א', predictions: { A1: { home: 2, away: 1 } }, topGoalscorer: '' },
    { label: 'שחקן ב', predictions: { A1: { home: 0, away: 0 } }, topGoalscorer: '' },
    { label: 'שחקן ג', predictions: { A1: { home: 3, away: 2 } }, topGoalscorer: '' },
  ]
  render(<MatchPredictionsPage />)
  expect(getCounts()).toEqual(['0', '1', '2'])
})

test('shows summary counts: 0 home wins, 0 draws, 1 away win', () => {
  mockUsers = [
    { label: 'שחקן א', predictions: { A1: { home: 0, away: 2 } }, topGoalscorer: '' },
  ]
  render(<MatchPredictionsPage />)
  expect(getCounts()).toEqual(['1', '0', '0'])
})

test('always shows draw count as 0 when no one predicted a draw', () => {
  mockUsers = [
    { label: 'שחקן א', predictions: { A1: { home: 2, away: 1 } }, topGoalscorer: '' },
    { label: 'שחקן ב', predictions: { A1: { home: 1, away: 0 } }, topGoalscorer: '' },
  ]
  render(<MatchPredictionsPage />)
  const counts = getCounts()
  expect(counts).toHaveLength(3)
  expect(counts[1]).toBe('0')
})

test('excludes unpredicted entries from summary counts', () => {
  mockUsers = [
    { label: 'שחקן א', predictions: { A1: { home: null, away: null } }, topGoalscorer: '' },
    { label: 'שחקן ב', predictions: { A1: { home: 1, away: 0 } }, topGoalscorer: '' },
  ]
  render(<MatchPredictionsPage />)
  expect(getCounts()).toEqual(['0', '0', '1'])
})

test('sorts predictions: home wins, draws, away wins, unpredicted last', () => {
  mockUsers = [
    { label: 'מנחה', predictions: { A1: { home: null, away: null } }, topGoalscorer: '' },
    { label: 'אורן', predictions: { A1: { home: 0, away: 2 } }, topGoalscorer: '' },
    { label: 'טל', predictions: { A1: { home: 1, away: 1 } }, topGoalscorer: '' },
    { label: 'עידן', predictions: { A1: { home: 2, away: 0 } }, topGoalscorer: '' },
  ]
  render(<MatchPredictionsPage />)
  const names = screen.getAllByText(/עידן|טל|אורן|מנחה/).map(el => el.textContent)
  expect(names).toEqual(['עידן', 'טל', 'אורן', 'מנחה'])
})

test('shows a score frequency table above the predictions list', () => {
  mockUsers = [
    { label: 'א', predictions: { A1: { home: 2, away: 1 } }, topGoalscorer: '' },
    { label: 'ב', predictions: { A1: { home: 2, away: 1 } }, topGoalscorer: '' },
    { label: 'ג', predictions: { A1: { home: 1, away: 0 } }, topGoalscorer: '' },
  ]
  render(<MatchPredictionsPage />)
  expect(screen.getByTestId('score-freq-table')).toBeInTheDocument()
})

test('score frequency table shows one row per unique scoreline', () => {
  mockUsers = [
    { label: 'א', predictions: { A1: { home: 2, away: 1 } }, topGoalscorer: '' },
    { label: 'ב', predictions: { A1: { home: 2, away: 1 } }, topGoalscorer: '' },
    { label: 'ג', predictions: { A1: { home: 1, away: 0 } }, topGoalscorer: '' },
  ]
  render(<MatchPredictionsPage />)
  expect(screen.getAllByTestId('score-freq-row')).toHaveLength(2)
})

test('score frequency table shows count and percentage per scoreline', () => {
  mockUsers = [
    { label: 'א', predictions: { A1: { home: 2, away: 1 } }, topGoalscorer: '' },
    { label: 'ב', predictions: { A1: { home: 2, away: 1 } }, topGoalscorer: '' },
    { label: 'ג', predictions: { A1: { home: 1, away: 0 } }, topGoalscorer: '' },
  ]
  render(<MatchPredictionsPage />)
  const table = screen.getByTestId('score-freq-table')
  expect(table).toHaveTextContent('2')
  expect(table).toHaveTextContent('67%')
  expect(table).toHaveTextContent('33%')
})

test('score frequency table is sorted: home wins, then draws', () => {
  mockUsers = [
    { label: 'א', predictions: { A1: { home: 0, away: 0 } }, topGoalscorer: '' },
    { label: 'ב', predictions: { A1: { home: 2, away: 1 } }, topGoalscorer: '' },
    { label: 'ג', predictions: { A1: { home: 2, away: 1 } }, topGoalscorer: '' },
  ]
  render(<MatchPredictionsPage />)
  const rows = screen.getAllByTestId('score-freq-row')
  expect(rows[0]).toHaveTextContent('1–2')
  expect(rows[1]).toHaveTextContent('0–0')
})

test('score frequency table excludes unpredicted entries', () => {
  mockUsers = [
    { label: 'א', predictions: { A1: { home: null, away: null } }, topGoalscorer: '' },
    { label: 'ב', predictions: { A1: { home: 2, away: 1 } }, topGoalscorer: '' },
  ]
  render(<MatchPredictionsPage />)
  expect(screen.getAllByTestId('score-freq-row')).toHaveLength(1)
})

test('score frequency table appears above the individual predictions list', () => {
  mockUsers = [
    { label: 'שחקן א', predictions: { A1: { home: 2, away: 1 } }, topGoalscorer: '' },
  ]
  render(<MatchPredictionsPage />)
  const table = screen.getByTestId('score-freq-table')
  const name = screen.getByText('שחקן א')
  expect(table.compareDocumentPosition(name)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
})

test('sorts home wins by home goals asc, then draws, then away wins', () => {
  mockUsers = [
    { label: 'רון', predictions: { A1: { home: 2, away: 0 } }, topGoalscorer: '' },
    { label: 'אבי', predictions: { A1: { home: 3, away: 1 } }, topGoalscorer: '' },
    { label: 'תמר', predictions: { A1: { home: 1, away: 1 } }, topGoalscorer: '' },
    { label: 'דן', predictions: { A1: { home: 0, away: 1 } }, topGoalscorer: '' },
  ]
  render(<MatchPredictionsPage />)
  const names = screen.getAllByText(/אבי|רון|תמר|דן/).map(el => el.textContent)
  expect(names).toEqual(['רון', 'אבי', 'תמר', 'דן'])
})
