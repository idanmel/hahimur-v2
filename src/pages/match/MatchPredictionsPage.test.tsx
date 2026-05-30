import { render, screen } from '@testing-library/react'
import MatchPredictionsPage from './MatchPredictionsPage'
import { findMatch } from './matchUtils'
import { TEAMS } from '../../shared/groups'
import type { User } from '../../users/index'
import type { PredictionsState } from '../../shared/types'

function u(label: string, predictions: PredictionsState, topGoalscorer = ''): User {
  return { label, predictions, topGoalscorer, groupMatches: {}, groupTables: {}, thirdPlaceQualification: { resolved: true, all: [], qualifiers: [] }, knockoutStages: { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] } }
}

function renderPage(matchId: string, users: User[]) {
  const match = findMatch(matchId)
  const home = match ? TEAMS[match.homeTeam] : null
  const away = match ? TEAMS[match.awayTeam] : null
  return render(<MatchPredictionsPage match={match ?? null} home={home} away={away} users={users} />)
}

function getCounts() {
  return screen.getAllByTestId('pred-count').map(el => el.textContent)
}

test('shows not found message for unknown matchId', () => {
  render(<MatchPredictionsPage match={null} home={null} away={null} users={[]} />)
  expect(screen.getByText('משחק לא נמצא')).toBeInTheDocument()
})

test('shows Hebrew message when there are no users', () => {
  renderPage('A1', [])
  expect(screen.getByText('אין תחזיות למשחק זה')).toBeInTheDocument()
})

test('shows correct teams when matchId is B1', () => {
  renderPage('B1', [])
  expect(screen.getAllByText('קנדה').length).toBeGreaterThan(0)
  expect(screen.getAllByText('בוסניה והרצגובינה').length).toBeGreaterThan(0)
})

test('shows score from B1 prediction when matchId is B1', () => {
  renderPage('B1', [u('שחקן א', { B1: { home: 2, away: 1 } })])
  const row = screen.getByText('שחקן א').closest('.prediction-row')!
  expect(row).toHaveTextContent('2')
  expect(row).toHaveTextContent('1')
})

test('shows summary table even when no one predicted the game', () => {
  renderPage('A1', [])
  expect(getCounts()).toEqual(['0', '0', '0'])
})

test('shows user name when one user has a prediction for A1', () => {
  renderPage('A1', [u('שחקן א', { A1: { home: 2, away: 1 } })])
  expect(screen.getByText(/שחקן א/)).toBeInTheDocument()
  expect(screen.queryByText('אין תחזיות למשחק זה')).not.toBeInTheDocument()
})

test('shows user with – for a partially unpredicted A1 match', () => {
  renderPage('A1', [u('שחקן א', { A1: { home: 2, away: null } })])
  expect(screen.getByText(/שחקן א/)).toBeInTheDocument()
  expect(screen.queryByText('אין תחזיות למשחק זה')).not.toBeInTheDocument()
})

test('shows user with – scores when A1 prediction is null', () => {
  renderPage('A1', [u('שחקן א', { A1: { home: null, away: null } })])
  expect(screen.getByText(/שחקן א/)).toBeInTheDocument()
  expect(screen.queryByText('אין תחזיות למשחק זה')).not.toBeInTheDocument()
})

test('shows all user names when multiple users have predictions for A1', () => {
  renderPage('A1', [
    u('שחקן א', { A1: { home: 2, away: 1 } }),
    u('שחקן ב', { A1: { home: 0, away: 0 } }),
    u('שחקן ג', { A1: { home: 3, away: 2 } }),
  ])
  expect(screen.getByText(/שחקן א/)).toBeInTheDocument()
  expect(screen.getByText(/שחקן ב/)).toBeInTheDocument()
  expect(screen.getByText(/שחקן ג/)).toBeInTheDocument()
})

test('shows summary counts: 2 home wins, 1 draw, 0 away wins', () => {
  renderPage('A1', [
    u('שחקן א', { A1: { home: 2, away: 1 } }),
    u('שחקן ב', { A1: { home: 0, away: 0 } }),
    u('שחקן ג', { A1: { home: 3, away: 2 } }),
  ])
  expect(getCounts()).toEqual(['0', '1', '2'])
})

test('shows summary counts: 0 home wins, 0 draws, 1 away win', () => {
  renderPage('A1', [u('שחקן א', { A1: { home: 0, away: 2 } })])
  expect(getCounts()).toEqual(['1', '0', '0'])
})

test('always shows draw count as 0 when no one predicted a draw', () => {
  renderPage('A1', [
    u('שחקן א', { A1: { home: 2, away: 1 } }),
    u('שחקן ב', { A1: { home: 1, away: 0 } }),
  ])
  const counts = getCounts()
  expect(counts).toHaveLength(3)
  expect(counts[1]).toBe('0')
})

test('excludes unpredicted entries from summary counts', () => {
  renderPage('A1', [
    u('שחקן א', { A1: { home: null, away: null } }),
    u('שחקן ב', { A1: { home: 1, away: 0 } }),
  ])
  expect(getCounts()).toEqual(['0', '0', '1'])
})

test('sorts predictions: home wins, draws, away wins, unpredicted last', () => {
  renderPage('A1', [
    u('מנחה', { A1: { home: null, away: null } }),
    u('אורן', { A1: { home: 0, away: 2 } }),
    u('טל',   { A1: { home: 1, away: 1 } }),
    u('עידן', { A1: { home: 2, away: 0 } }),
  ])
  const names = screen.getAllByText(/עידן|טל|אורן|מנחה/).map(el => el.textContent)
  expect(names).toEqual(['עידן', 'טל', 'אורן', 'מנחה'])
})

test('shows a score frequency table above the predictions list', () => {
  renderPage('A1', [
    u('א', { A1: { home: 2, away: 1 } }),
    u('ב', { A1: { home: 2, away: 1 } }),
    u('ג', { A1: { home: 1, away: 0 } }),
  ])
  expect(screen.getByTestId('score-freq-table')).toBeInTheDocument()
})

test('score frequency table shows one row per unique scoreline', () => {
  renderPage('A1', [
    u('א', { A1: { home: 2, away: 1 } }),
    u('ב', { A1: { home: 2, away: 1 } }),
    u('ג', { A1: { home: 1, away: 0 } }),
  ])
  expect(screen.getAllByTestId('score-freq-row')).toHaveLength(2)
})

test('score frequency table shows count and percentage per scoreline', () => {
  renderPage('A1', [
    u('א', { A1: { home: 2, away: 1 } }),
    u('ב', { A1: { home: 2, away: 1 } }),
    u('ג', { A1: { home: 1, away: 0 } }),
  ])
  const table = screen.getByTestId('score-freq-table')
  expect(table).toHaveTextContent('2')
  expect(table).toHaveTextContent('67%')
  expect(table).toHaveTextContent('33%')
})

test('score frequency table is sorted: home wins, then draws', () => {
  renderPage('A1', [
    u('א', { A1: { home: 0, away: 0 } }),
    u('ב', { A1: { home: 2, away: 1 } }),
    u('ג', { A1: { home: 2, away: 1 } }),
  ])
  const rows = screen.getAllByTestId('score-freq-row')
  expect(rows[0]).toHaveTextContent('1–2')
  expect(rows[1]).toHaveTextContent('0–0')
})

test('score frequency table excludes unpredicted entries', () => {
  renderPage('A1', [
    u('א', { A1: { home: null, away: null } }),
    u('ב', { A1: { home: 2, away: 1 } }),
  ])
  expect(screen.getAllByTestId('score-freq-row')).toHaveLength(1)
})

test('score frequency table appears above the individual predictions list', () => {
  renderPage('A1', [u('שחקן א', { A1: { home: 2, away: 1 } })])
  const table = screen.getByTestId('score-freq-table')
  const name = screen.getByText('שחקן א')
  expect(table.compareDocumentPosition(name)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
})

test('sorts home wins by home goals asc, then draws, then away wins', () => {
  renderPage('A1', [
    u('רון', { A1: { home: 2, away: 0 } }),
    u('אבי', { A1: { home: 3, away: 1 } }),
    u('תמר', { A1: { home: 1, away: 1 } }),
    u('דן',  { A1: { home: 0, away: 1 } }),
  ])
  const names = screen.getAllByText(/אבי|רון|תמר|דן/).map(el => el.textContent)
  expect(names).toEqual(['רון', 'אבי', 'תמר', 'דן'])
})
