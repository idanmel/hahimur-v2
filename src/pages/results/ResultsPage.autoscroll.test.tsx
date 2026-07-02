import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import ResultsPage from './ResultsPage'

// Skip the 27 prediction files that load transitively via useCurrentUser.
vi.mock('../../users/index', () => ({ get USERS() { return [] }, get USERS_SORTED() { return [] } }))

// Pin the "next unplayed match" to a real group fixture so the autoscroll target
// exists regardless of how far the live tournament has progressed (once every group
// match has a score there is no next unplayed match, and nothing to scroll to).
vi.mock('../../shared/matchesByDate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/matchesByDate')>()
  return { ...actual, nextUnplayedMatchId: () => 'A1', nextUnplayedKOMatchId: () => '73' }
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('switching the group stage to by-date scrolls the next unplayed match into view', async () => {
  const scrollSpy = vi
    .spyOn(Element.prototype, 'scrollIntoView')
    .mockImplementation(() => {})
  render(<ResultsPage users={[]} />)

  // open the group-stage accordion, then switch to the chronological view
  await userEvent.click(screen.getByRole('button', { name: 'שלב הבתים' }))
  await userEvent.click(screen.getByRole('button', { name: 'לפי תאריך — שלב הבתים' }))

  expect(scrollSpy).toHaveBeenCalled()
})

test('switching the bracket to by-date scrolls the next unplayed KO match into view', async () => {
  const scrollSpy = vi
    .spyOn(Element.prototype, 'scrollIntoView')
    .mockImplementation(() => {})
  render(<ResultsPage users={[]} />)

  // the bracket section is open by default — just flip it to the chronological view
  await userEvent.click(screen.getByRole('button', { name: 'לפי תאריך — בראקט' }))

  expect(scrollSpy).toHaveBeenCalled()
})
