import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HomeFeed from './HomeFeed'
import { makeUser } from '../../leaderboard/testFixtures'
import type { GroupMatch } from '../../shared/types'

const NOW = new Date('2026-06-13T12:00:00Z') // A1 played; B1 still upcoming

const MATCHES: GroupMatch[] = [
  { id: 'A1', homeTeam: 'Mexico', awayTeam: 'South Africa', matchDate: '11 ביוני', kickoffIST: '22:00', scores: { home: 2, away: 1 } },
  { id: 'B1', homeTeam: 'Canada', awayTeam: 'Bosnia and Herzegovina', matchDate: '20 ביוני', kickoffIST: '22:00' },
]

const users = [makeUser({ predictions: { A1: { home: 2, away: 1 } } })]

const render_ = () => render(<HomeFeed users={users} now={NOW} matches={MATCHES} />)

test('opens on the results tab', () => {
  render_()
  expect(screen.getByRole('tab', { name: 'תוצאות אחרונות' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByTestId('match-result')).toBeInTheDocument()
})

test('does not show upcoming fixtures while on the results tab', () => {
  render_()
  expect(screen.queryByText(/לעמוד המשחק/)).toBeInTheDocument() // result card link exists
  expect(screen.queryByText('20 ביוני')).not.toBeInTheDocument() // B1 kickoff date hidden
})

test('switches to upcoming fixtures when the other tab is tapped', async () => {
  render_()
  await userEvent.click(screen.getByRole('tab', { name: 'המשחקים הבאים' }))
  expect(screen.getByRole('tab', { name: 'המשחקים הבאים' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByText('20 ביוני')).toBeInTheDocument()
  expect(screen.queryByTestId('match-result')).not.toBeInTheDocument()
})

test('shows an empty message when the results tab has nothing yet', () => {
  render(<HomeFeed users={users} now={new Date('2026-06-10T00:00:00Z')} matches={MATCHES} />)
  expect(screen.getByText('עוד לא נגמרו משחקים')).toBeInTheDocument()
})
