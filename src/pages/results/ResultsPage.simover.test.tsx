import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import ResultsPage from './ResultsPage'

// Skip the 27 prediction files that load transitively via useCurrentUser.
vi.mock('../../users/index', () => ({ get USERS() { return [] }, get USERS_SORTED() { return [] } }))

// The tournament is over: every match is locked to its real score, so the
// simulator actions ("הכל צליפות" paints unplayed matches, "איפוס" reverts
// edits) have nothing left to act on and are retired from the page.
test('the simulator action buttons are gone now that the tournament is over', () => {
  render(<ResultsPage users={[]} />)

  expect(screen.queryByRole('button', { name: 'הכל צליפות' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'איפוס' })).toBeNull()
})
