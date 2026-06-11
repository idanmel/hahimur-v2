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

test('shows points per scoreline once a real score exists', () => {
  render(<ScoreFrequencyTable matchId="M1" users={[
    u('בול', 2, 1),
    u('כיוון', 1, 0),
    u('פספוס', 0, 3),
  ]} actualScore={{ home: 2, away: 1 }} />)
  const rows = screen.getAllByTestId('score-freq-row')
  const ptsOf = (row: HTMLElement) => row.querySelector('.score-freq__pts')?.textContent
  const rowFor = (label: string) => rows.find(r => r.querySelector('.score-freq__score')?.textContent === label)!
  expect(ptsOf(rowFor('1–2'))).toBe('4')
  expect(ptsOf(rowFor('0–1'))).toBe('2')
  expect(ptsOf(rowFor('3–0'))).toBe('0')
})

test('shows no points while the match is unplayed', () => {
  const { container } = render(<ScoreFrequencyTable matchId="M1" users={[u('עידן', 2, 1)]} />)
  expect(container.querySelector('.score-freq__pts')).toBeNull()
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

test('marks the most popular scoreline as leader', () => {
  render(<ScoreFrequencyTable matchId="M1" users={[
    u('א', 2, 1),
    u('ב', 2, 1),
    u('ג', 0, 0),
  ]} />)
  const rows = screen.getAllByTestId('score-freq-row')
  // 1–2 appears twice (leader), 0–0 appears once
  expect(rows[0]).toHaveClass('score-freq__row--leader')
  expect(rows[1]).not.toHaveClass('score-freq__row--leader')
})
