import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import ChampionHero from './ChampionHero'
import { USERS } from '../../users/index'
import { tournamentResults } from '../../tournament-results'

// The hero renders straight off the baked final results — these assertions
// pin the real 2026 outcome: Karni's win is the centerpiece of the home page.
test('the hero crowns the pool champion by name and total', () => {
  render(<ChampionHero users={USERS} results={tournamentResults} />)

  expect(screen.getByRole('heading', { name: 'יונתן קרני' })).toBeInTheDocument()
  expect(screen.getByText(/612/)).toBeInTheDocument()
  expect(screen.getByText(/זוכה ההימור/)).toBeInTheDocument()
})

test('the hero shows the winning margin over the runner-up', () => {
  render(<ChampionHero users={USERS} results={tournamentResults} />)

  // 612 − 521 = a 91-point landslide
  expect(screen.getByText(/91 נקודות מעל המקום השני/)).toBeInTheDocument()
})

test('the hero links to the full results page', () => {
  render(<ChampionHero users={USERS} results={tournamentResults} />)

  expect(screen.getByRole('link', { name: /לטבלה המלאה/ })).toHaveAttribute('href', '/results')
})
