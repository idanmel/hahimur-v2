import { render, screen } from '@testing-library/react'
import ScoreFrequencyTable from './ScoreFrequencyTable'
import type { User } from '../../users/index'

function u(label: string, home: number | null, away: number | null): User {
  return { label, predictions: { M1: { home, away } }, topGoalscorer: '', groupMatches: {}, groupTables: {}, thirdPlaceQualification: { resolved: true, all: [], qualifiers: [] }, knockoutStages: { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] } }
}

test('renders nothing when no users', () => {
  const { container } = render(<ScoreFrequencyTable matchId="M1" users={[]} />)
  expect(container.firstChild).toBeNull()
})

test('shows only the unpredicted footer when all users are unpredicted', () => {
  render(<ScoreFrequencyTable matchId="M1" users={[u('מנחה', null, null)]} />)
  expect(screen.queryAllByTestId('score-freq-row')).toHaveLength(0)
  expect(screen.getByTestId('score-freq-unpredicted')).toHaveTextContent('מנחה')
})

test('shows the names of users who predicted each scoreline', () => {
  render(<ScoreFrequencyTable matchId="M1" users={[
    u('עידן', 2, 1),
    u('אורן', 2, 1),
    u('טל', 0, 0),
  ]} />)
  const rows = screen.getAllByTestId('score-freq-row')
  expect(rows[0]).toHaveTextContent('עידן')
  expect(rows[0]).toHaveTextContent('אורן')
  expect(rows[0]).not.toHaveTextContent('טל')
  expect(rows[1]).toHaveTextContent('טל')
})

test('lists unpredicted users in a footer, not in score rows', () => {
  render(<ScoreFrequencyTable matchId="M1" users={[u('עידן', 2, 1), u('מנחה', null, null)]} />)
  const footer = screen.getByTestId('score-freq-unpredicted')
  expect(footer).toHaveTextContent('מנחה')
  expect(footer).not.toHaveTextContent('עידן')
  expect(screen.getAllByTestId('score-freq-row')).toHaveLength(1)
})

// Grouping, sorting, counts, leader and per-row points are covered by the pure
// model in scoreFrequency.test.ts. These component tests only check that the
// model's output reaches the DOM.
test('renders the points the model computes for a scoreline', () => {
  render(<ScoreFrequencyTable matchId="M1" users={[u('בול', 2, 1)]} actualScore={{ home: 2, away: 1 }} />)
  expect(screen.getByTestId('score-freq-row').querySelector('.score-freq__pts')?.textContent).toBe('4')
})

test('shows no points while the match is unplayed', () => {
  const { container } = render(<ScoreFrequencyTable matchId="M1" users={[u('עידן', 2, 1)]} />)
  expect(container.querySelector('.score-freq__pts')).toBeNull()
})

test('marks the most popular scoreline as leader', () => {
  render(<ScoreFrequencyTable matchId="M1" users={[
    u('א', 2, 1),
    u('ב', 2, 1),
    u('ג', 0, 0),
  ]} />)
  const rows = screen.getAllByTestId('score-freq-row')
  // 1–2 appears twice (leader), 0–0 appears once — checks the leader class renders
  expect(rows[0]).toHaveClass('score-freq__row--leader')
  expect(rows[1]).not.toHaveClass('score-freq__row--leader')
})
