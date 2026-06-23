import { render, screen, within } from '@testing-library/react'
import { vi } from 'vitest'
import MatchPredictionsPage from './MatchPredictionsPage'

// These tests describe the page before a real result exists. Pin the
// results to empty so they don't change behavior as real scores land.
vi.mock('../../tournament-results', () => ({
  tournamentResults: { groupMatches: {}, playerMatchGoals: {} },
}))
// Global chrome is covered by Nav.test; stub it so the nav's participant
// picker doesn't pollute the page's name/prediction assertions.
vi.mock('../../Nav', () => ({ default: () => null, USER_STORAGE_EVENT: 'userStorageUpdated' }))
// Controllable "me" so tests can toggle the current user's personal group table.
const mockMe = vi.hoisted(() => ({ user: undefined as unknown }))
vi.mock('../../shared/useCurrentUser', () => ({
  useCurrentUser: () => ({ me: (mockMe.user as { label?: string })?.label ?? '', currentUser: mockMe.user, pickMe: () => {} }),
}))
import { findMatch } from './matchUtils'
import { TEAMS } from '../../shared/groups'
import type { User } from '../../users/index'
import type { PredictionsState, Standing } from '../../shared/types'

afterEach(() => { mockMe.user = undefined })

function u(label: string, predictions: PredictionsState, topGoalscorer = ''): User {
  return { label, predictions, topGoalscorer, groupMatches: {}, groupTables: {}, thirdPlaceQualification: { resolved: true, all: [], qualifiers: [] }, knockoutStages: { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] } }
}

function renderPage(matchId: string, users: User[], now?: Date) {
  const match = findMatch(matchId)
  const home = match ? TEAMS[match.homeTeam] : null
  const away = match ? TEAMS[match.awayTeam] : null
  return render(<MatchPredictionsPage match={match ?? null} home={home} away={away} users={users} now={now} />)
}

function getCounts() {
  return screen.getAllByTestId('pred-count').map(el => el.textContent)
}

// Names appear in both the score-frequency table and the match leaderboard;
// these assertions are about the frequency table, so scope queries to it.
const freq = () => within(screen.getByTestId('score-freq-table'))

// A1 kicks off '11 ביוני' 22:00 Israel time = 2026-06-11T19:00Z
test('shows live indicator while the match is being played', () => {
  renderPage('A1', [], new Date('2026-06-11T19:30:00Z'))
  expect(screen.getByTestId('live-indicator')).toBeInTheDocument()
})

test('shows no live indicator before kickoff', () => {
  renderPage('A1', [], new Date('2026-06-11T18:00:00Z'))
  expect(screen.queryByTestId('live-indicator')).not.toBeInTheDocument()
})

test('shows not found message for unknown matchId', () => {
  render(<MatchPredictionsPage match={null} home={null} away={null} users={[]} />)
  expect(screen.getByText('משחק לא נמצא')).toBeInTheDocument()
})

test('shows Hebrew message when there are no users', () => {
  renderPage('A1', [])
  expect(screen.getByText('אין תחזיות למשחק זה')).toBeInTheDocument()
})

test('shows the group standings table on the match page', () => {
  renderPage('B1', [])
  expect(screen.getByTestId('live-group-table')).toBeInTheDocument()
})

test('highlights the two playing teams in the group standings table', () => {
  renderPage('B1', [])
  const table = screen.getByTestId('live-group-table')
  expect(within(table).getByLabelText('קנדה')).toHaveClass('row-highlight')
  expect(within(table).getByLabelText('בוסניה והרצגובינה')).toHaveClass('row-highlight')
})

const standing = (team: string): Standing =>
  ({ team, played: 3, won: 2, drawn: 1, lost: 0, goalsFor: 5, goalsAgainst: 2, points: 7 })

test("shows the current user's own predicted group table below the live one", () => {
  const me = u('דני', {})
  me.groupTables = { B: ['Canada', 'Switzerland', 'Bosnia and Herzegovina', 'Qatar'].map(standing) }
  mockMe.user = me
  renderPage('B1', [])
  expect(screen.getByTestId('my-group-table')).toBeInTheDocument()
  expect(screen.getByText('טבלת הבית שלי')).toBeInTheDocument()
})

test('shows no personal group table when the viewer has not identified themselves', () => {
  renderPage('B1', [])
  expect(screen.queryByTestId('my-group-table')).not.toBeInTheDocument()
})

test('shows correct teams when matchId is B1', () => {
  renderPage('B1', [])
  expect(screen.getAllByText('קנדה').length).toBeGreaterThan(0)
  expect(screen.getAllByText('בוסניה והרצגובינה').length).toBeGreaterThan(0)
})

test('shows score from B1 prediction when matchId is B1', () => {
  renderPage('B1', [u('שחקן א', { B1: { home: 2, away: 1 } })])
  const row = freq().getByText('שחקן א').closest('[data-testid="score-freq-row"]')!
  expect(row).toHaveTextContent('1–2')
})

test('shows user name when one user has a prediction for A1', () => {
  renderPage('A1', [u('שחקן א', { A1: { home: 2, away: 1 } })])
  expect(freq().getByText(/שחקן א/)).toBeInTheDocument()
  expect(screen.queryByText('אין תחזיות למשחק זה')).not.toBeInTheDocument()
})

test('shows user with – for a partially unpredicted A1 match', () => {
  renderPage('A1', [u('שחקן א', { A1: { home: 2, away: null } })])
  expect(freq().getByText(/שחקן א/)).toBeInTheDocument()
  expect(screen.queryByText('אין תחזיות למשחק זה')).not.toBeInTheDocument()
})

test('shows user with – scores when A1 prediction is null', () => {
  renderPage('A1', [u('שחקן א', { A1: { home: null, away: null } })])
  expect(freq().getByText(/שחקן א/)).toBeInTheDocument()
  expect(screen.queryByText('אין תחזיות למשחק זה')).not.toBeInTheDocument()
})

test('shows all user names when multiple users have predictions for A1', () => {
  renderPage('A1', [
    u('שחקן א', { A1: { home: 2, away: 1 } }),
    u('שחקן ב', { A1: { home: 0, away: 0 } }),
    u('שחקן ג', { A1: { home: 3, away: 2 } }),
  ])
  expect(freq().getByText(/שחקן א/)).toBeInTheDocument()
  expect(freq().getByText(/שחקן ב/)).toBeInTheDocument()
  expect(freq().getByText(/שחקן ג/)).toBeInTheDocument()
})

test('shows summary counts: 2 home wins, 1 draw, 0 away wins', () => {
  renderPage('A1', [
    u('שחקן א', { A1: { home: 2, away: 1 } }),
    u('שחקן ב', { A1: { home: 0, away: 0 } }),
    u('שחקן ג', { A1: { home: 3, away: 2 } }),
  ])
  expect(getCounts()).toEqual(['0', '1', '2'])
})

test('sorts predictions: home wins, draws, away wins, unpredicted last', () => {
  renderPage('A1', [
    u('מנחה', { A1: { home: null, away: null } }),
    u('אורן', { A1: { home: 0, away: 2 } }),
    u('טל',   { A1: { home: 1, away: 1 } }),
    u('עידן', { A1: { home: 2, away: 0 } }),
  ])
  const names = freq().getAllByText(/עידן|טל|אורן|מנחה/).map(el => el.textContent)
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

test('sorts home wins by home goals asc, then draws, then away wins', () => {
  renderPage('A1', [
    u('רון', { A1: { home: 2, away: 0 } }),
    u('אבי', { A1: { home: 3, away: 1 } }),
    u('תמר', { A1: { home: 1, away: 1 } }),
    u('דן',  { A1: { home: 0, away: 1 } }),
  ])
  const names = freq().getAllByText(/אבי|רון|תמר|דן/).map(el => el.textContent)
  expect(names).toEqual(['רון', 'אבי', 'תמר', 'דן'])
})
