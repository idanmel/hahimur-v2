import { render, screen } from '@testing-library/react'
import PredictionSummary from './PredictionSummary'
import type { User } from '../../users/index'

function u(label: string, home: number | null, away: number | null): User {
  return { label, predictions: { M1: { home, away } }, topGoalscorer: '', groupMatches: {}, groupTables: {}, thirdPlaceQualification: { resolved: true, all: [], qualifiers: [] }, knockoutStages: { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] } }
}

function renderSummary(users: User[]) {
  render(<PredictionSummary matchId="M1" homeLabel="ביתי" awayLabel="אורח" users={users} />)
}

function getCounts() {
  return screen.getAllByTestId('pred-count').map(el => Number(el.textContent))
}

test('shows team labels', () => {
  renderSummary([])
  expect(screen.getByText('ביתי')).toBeInTheDocument()
  expect(screen.getByText('אורח')).toBeInTheDocument()
})

test('shows zeros when no users', () => {
  renderSummary([])
  expect(getCounts()).toEqual([0, 0, 0])
})

test('counts home win correctly', () => {
  renderSummary([u('א', 2, 1)])
  const [away, draw, home] = getCounts()
  expect(home).toBe(1)
  expect(draw).toBe(0)
  expect(away).toBe(0)
})

test('counts away win correctly', () => {
  renderSummary([u('א', 0, 3)])
  const [away, draw, home] = getCounts()
  expect(away).toBe(1)
  expect(home).toBe(0)
  expect(draw).toBe(0)
})

test('counts draw correctly', () => {
  renderSummary([u('א', 1, 1)])
  const [away, draw, home] = getCounts()
  expect(draw).toBe(1)
  expect(home).toBe(0)
  expect(away).toBe(0)
})

test('excludes unpredicted entries', () => {
  renderSummary([u('א', null, null), u('ב', 2, 0)])
  const [away, draw, home] = getCounts()
  expect(home).toBe(1)
  expect(draw).toBe(0)
  expect(away).toBe(0)
})
