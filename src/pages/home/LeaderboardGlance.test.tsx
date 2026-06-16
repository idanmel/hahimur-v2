import { render, screen } from '@testing-library/react'
import LeaderboardGlance from './LeaderboardGlance'
import { EMPTY_RESULTS, makeUser } from '../../leaderboard/testFixtures'
import type { GroupMatch, TournamentResults } from '../../shared/types'

const grpMatch = (id: string, home: number, away: number): GroupMatch =>
  ({ id, homeTeam: 'H', awayTeam: 'A', scores: { home, away } })

// Two finished matches in group A: 2-1 and 1-1.
const results: TournamentResults = {
  ...EMPTY_RESULTS,
  groupMatches: { A: [grpMatch('m1', 2, 1), grpMatch('m2', 1, 1)] },
}

const users = [
  // רינה: missed both → 0 pts
  makeUser({ label: 'רינה', groupMatches: { A: [grpMatch('m1', 0, 1), grpMatch('m2', 2, 0)] } }),
  // דנה: two tzelifot → 8 pts
  makeUser({ label: 'דנה', groupMatches: { A: [grpMatch('m1', 2, 1), grpMatch('m2', 1, 1)] } }),
  // גדי: one pgiya → 2 pts
  makeUser({ label: 'גדי', groupMatches: { A: [grpMatch('m1', 1, 0)] } }),
  // יוסי: one tzelifa → 4 pts
  makeUser({ label: 'יוסי', groupMatches: { A: [grpMatch('m1', 2, 1)] } }),
]

test('shows the top three users in order with their points', () => {
  render(<LeaderboardGlance users={users} results={results} />)
  const rows = screen.getAllByTestId('top-three-row')
  expect(rows.map(r => r.textContent)).toEqual([
    expect.stringContaining('דנה'),
    expect.stringContaining('יוסי'),
    expect.stringContaining('גדי'),
  ])
  expect(rows[0]).toHaveTextContent('8')
  expect(rows[1]).toHaveTextContent('4')
  expect(rows[2]).toHaveTextContent('2')
})

test('shows only three rows even when there are more users', () => {
  render(<LeaderboardGlance users={users} results={results} />)
  expect(screen.getAllByTestId('top-three-row')).toHaveLength(3)
  expect(screen.queryByText('רינה')).not.toBeInTheDocument()
})

test('tied users share the same medal and rank-3 ties are all shown', () => {
  // שרה ties יוסי at 4 pts (one tzelifa each) → both silver; גדי drops to 4th and is excluded.
  const withTie = [
    ...users,
    makeUser({ label: 'שרה', groupMatches: { A: [grpMatch('m2', 1, 1)] } }),
  ]
  render(<LeaderboardGlance users={withTie} results={results} />)
  const rows = screen.getAllByTestId('top-three-row')
  expect(rows.map(r => r.textContent)).toEqual([
    expect.stringContaining('דנה'),
    expect.stringContaining('🥈'),
    expect.stringContaining('🥈'),
  ])
  expect(rows).toHaveLength(3)
  expect(screen.queryByText('גדי')).not.toBeInTheDocument()
})

test('a tie for third place shows more than three rows', () => {
  // רינה gets a pgiya to tie גדי at 2 pts → both bronze, four rows total.
  const tiedThird = [
    makeUser({ label: 'רינה', groupMatches: { A: [grpMatch('m1', 3, 2)] } }),
    ...users.slice(1),
  ]
  render(<LeaderboardGlance users={tiedThird} results={results} />)
  const rows = screen.getAllByTestId('top-three-row')
  expect(rows).toHaveLength(4)
  expect(rows[2]).toHaveTextContent('🥉')
  expect(rows[3]).toHaveTextContent('🥉')
})

test("appends the current user's own row when they're outside the top three", () => {
  // רינה is rank 4 (0 pts) — below the podium.
  const me = users[0]
  render(<LeaderboardGlance users={users} results={results} currentUser={me} />)
  expect(screen.getAllByTestId('top-three-row')).toHaveLength(3)
  const youRow = screen.getByTestId('top-three-you')
  expect(youRow).toHaveTextContent('רינה')
  expect(youRow).toHaveTextContent('4') // rank
  expect(youRow).toHaveTextContent('0') // points
})

test('does not append a row when the current user is already in the top three', () => {
  // דנה is rank 1.
  render(<LeaderboardGlance users={users} results={results} currentUser={users[1]} />)
  expect(screen.queryByTestId('top-three-you')).not.toBeInTheDocument()
})

test('shows no current-user row when nobody is selected', () => {
  render(<LeaderboardGlance users={users} results={results} />)
  expect(screen.queryByTestId('top-three-you')).not.toBeInTheDocument()
})

test('links to the results page', () => {
  render(<LeaderboardGlance users={users} results={results} />)
  expect(screen.getByRole('link', { name: /לכל התוצאות/ })).toHaveAttribute('href', '/results')
})
