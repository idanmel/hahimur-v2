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

test('renders nothing when all users are unpredicted', () => {
  const { container } = render(<ScoreFrequencyTable matchId="M1" users={[u('א', null, null)]} />)
  expect(container.firstChild).toBeNull()
})

test('renders one row per unique scoreline', () => {
  render(<ScoreFrequencyTable matchId="M1" users={[
    u('א', 2, 1),
    u('ב', 2, 1),
    u('ג', 0, 0),
  ]} />)
  expect(screen.getAllByTestId('score-freq-row')).toHaveLength(2)
})

test('shows count and percentage for a scoreline', () => {
  render(<ScoreFrequencyTable matchId="M1" users={[
    u('א', 2, 1),
    u('ב', 2, 1),
    u('ג', 0, 0),
  ]} />)
  const rows = screen.getAllByTestId('score-freq-row')
  expect(rows[0]).toHaveTextContent('2')
  expect(rows[0]).toHaveTextContent('67%')
})

test('sorts home wins before draws', () => {
  render(<ScoreFrequencyTable matchId="M1" users={[
    u('א', 0, 0),
    u('ב', 2, 1),
  ]} />)
  const rows = screen.getAllByTestId('score-freq-row')
  expect(rows[0]).toHaveTextContent('1–2')
  expect(rows[1]).toHaveTextContent('0–0')
})

test('marks first row as leader', () => {
  render(<ScoreFrequencyTable matchId="M1" users={[u('א', 2, 1), u('ב', 0, 0)]} />)
  const rows = screen.getAllByTestId('score-freq-row')
  expect(rows[0]).toHaveClass('score-freq__row--leader')
  expect(rows[1]).not.toHaveClass('score-freq__row--leader')
})
