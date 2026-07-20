import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import TournamentWrapCard from './TournamentWrapCard'
import { USERS } from '../../users/index'
import { tournamentResults } from '../../tournament-results'

// The wrap card renders straight off the baked final results — these
// assertions pin the real 2026 outcome, not fixtures.
test('the wrap card crowns the world champion, without a final-score line', () => {
  render(<TournamentWrapCard users={USERS} results={tournamentResults} />)

  expect(screen.getByText('ספרד')).toBeInTheDocument()
  expect(screen.getByText('אלופת העולם 2026')).toBeInTheDocument()
  // the champion stands alone — no "גמר: 0–0 מול ארגנטינה" line
  expect(screen.queryByText(/גמר:/)).toBeNull()
  expect(screen.queryByText(/ארגנטינה/)).toBeNull()
})

test('the wrap card names the golden boot winner and the pool champion', () => {
  render(<TournamentWrapCard users={USERS} results={tournamentResults} />)

  expect(screen.getByText(/קיליאן אמבפה/)).toBeInTheDocument()
  expect(screen.getByText(/10 שערים/)).toBeInTheDocument()
  expect(screen.getByText(/יונתן קרני/)).toBeInTheDocument()
  expect(screen.getByText(/612/)).toBeInTheDocument()
})

test('the wrap card links to the full results page', () => {
  render(<TournamentWrapCard users={USERS} results={tournamentResults} />)

  expect(screen.getByRole('link', { name: /לכל התוצאות/ })).toHaveAttribute('href', '/results')
})
