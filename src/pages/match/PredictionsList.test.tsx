import { render, screen } from '@testing-library/react'
import PredictionsList from './PredictionsList'
import type { User } from '../../users/index'

function u(label: string, home: number | null, away: number | null): User {
  return { label, predictions: { M1: { home, away } }, topGoalscorer: '', groupMatches: {}, groupTables: {}, thirdPlaceQualification: { resolved: true, all: [], qualifiers: [] }, knockoutStages: { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] } }
}

test('shows empty message when no users', () => {
  render(<PredictionsList matchId="M1" users={[]} />)
  expect(screen.getByText('אין תחזיות למשחק זה')).toBeInTheDocument()
})

test('shows user name and score', () => {
  render(<PredictionsList matchId="M1" users={[u('עידן', 2, 1)]} />)
  expect(screen.getByText('עידן')).toBeInTheDocument()
  const row = screen.getByText('עידן').closest('.prediction-row')!
  expect(row).toHaveTextContent('2')
  expect(row).toHaveTextContent('1')
})

test('shows dashes for unpredicted user', () => {
  render(<PredictionsList matchId="M1" users={[u('עידן', null, null)]} />)
  const row = screen.getByText('עידן').closest('.prediction-row')!
  expect(row.querySelectorAll('.prediction-row__digit')[0].textContent).toBe('–')
  expect(row.querySelectorAll('.prediction-row__digit')[1].textContent).toBe('–')
})

test('adds unpredicted class for null scores', () => {
  render(<PredictionsList matchId="M1" users={[u('עידן', null, null)]} />)
  expect(screen.getByText('עידן').closest('.prediction-row')).toHaveClass('prediction-row--unpredicted')
})

test('sorts home wins before draws before away wins, unpredicted last', () => {
  render(<PredictionsList matchId="M1" users={[
    u('מנחה', null, null),
    u('אורן', 0, 2),
    u('טל', 1, 1),
    u('עידן', 2, 0),
  ]} />)
  const names = screen.getAllByText(/עידן|טל|אורן|מנחה/).map(el => el.textContent)
  expect(names).toEqual(['עידן', 'טל', 'אורן', 'מנחה'])
})

test('shows points when actualScore is provided', () => {
  render(<PredictionsList matchId="M1" users={[u('עידן', 2, 1)]} actualScore={{ home: 2, away: 1 }} />)
  const row = screen.getByText('עידן').closest('.prediction-row')!
  expect(row.querySelector('.prediction-row__pts')?.textContent).toBe('4')
})

test('shows no points when actualScore is null', () => {
  render(<PredictionsList matchId="M1" users={[u('עידן', 2, 1)]} actualScore={null} />)
  const row = screen.getByText('עידן').closest('.prediction-row')!
  expect(row.querySelector('.prediction-row__pts')).toBeNull()
})
