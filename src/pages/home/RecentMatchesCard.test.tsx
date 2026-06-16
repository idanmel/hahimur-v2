import { render, screen } from '@testing-library/react'
import RecentMatchesCard from './RecentMatchesCard'
import { makeUser } from '../../leaderboard/testFixtures'
import type { GroupMatch } from '../../shared/types'

const NOW = new Date('2026-06-20T12:00:00Z') // both matches played

// A1: 11 Jun 22:00 IST, A2: 12 Jun 05:00 IST — A2 is the more recent.
const MATCHES: GroupMatch[] = [
  { id: 'A1', homeTeam: 'Mexico', awayTeam: 'South Africa', matchDate: '11 ביוני', kickoffIST: '22:00', scores: { home: 2, away: 1 } },
  { id: 'A2', homeTeam: 'South Korea', awayTeam: 'Czech Republic', matchDate: '12 ביוני', kickoffIST: '05:00', scores: { home: 0, away: 0 } },
]

const users = [
  makeUser({ predictions: { A1: { home: 2, away: 1 }, A2: { home: 1, away: 0 } } }),
]

test('shows the real score of a played match', () => {
  render(<RecentMatchesCard users={users} now={NOW} matches={MATCHES} />)
  const results = screen.getAllByTestId('match-result').map(e => e.textContent)
  expect(results).toContain('1–2') // A1: away–home, matching the prediction display order
})

test('shows the date and time of each played match, like the next-match card', () => {
  render(<RecentMatchesCard users={users} now={NOW} matches={[MATCHES[0]]} />)
  expect(screen.getByText(/11 ביוני/)).toBeInTheDocument()
  expect(screen.getByText(/22:00/)).toBeInTheDocument()
})

test('lists the most recent result first', () => {
  render(<RecentMatchesCard users={users} now={NOW} matches={MATCHES} />)
  const cards = screen.getAllByTestId('next-match')
  expect(cards[0]).toHaveTextContent('דרום קוריאה') // A2, the later kickoff
})

test('shows צליפה when the selected user nailed the exact score', () => {
  const me = makeUser({ label: 'עידן', predictions: { A1: { home: 2, away: 1 } } })
  render(<RecentMatchesCard users={users} now={NOW} matches={[MATCHES[0]]} currentUser={me} />)
  expect(screen.getByTestId('your-outcome')).toHaveTextContent('צליפה')
})

test('shows פספוס when the selected user got the match wrong', () => {
  const me = makeUser({ label: 'עידן', predictions: { A1: { home: 0, away: 3 } } })
  render(<RecentMatchesCard users={users} now={NOW} matches={[MATCHES[0]]} currentUser={me} />)
  expect(screen.getByTestId('your-outcome')).toHaveTextContent('פספוס')
})

test('shows no outcome line when there is no selected user', () => {
  render(<RecentMatchesCard users={users} now={NOW} matches={[MATCHES[0]]} />)
  expect(screen.queryByTestId('your-outcome')).not.toBeInTheDocument()
})

test('renders nothing before any match has been played', () => {
  const { container } = render(<RecentMatchesCard users={users} now={new Date('2026-06-10T00:00:00Z')} matches={MATCHES} />)
  expect(container).toBeEmptyDOMElement()
})
