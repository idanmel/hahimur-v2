import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import ResultsPage from './ResultsPage'

// Skip the 27 prediction files that load transitively via useCurrentUser.
vi.mock('../../users/index', () => ({ get USERS() { return [] }, get USERS_SORTED() { return [] } }))

test('the bracket section offers a by-date view of the knockout matches', async () => {
  render(<ResultsPage users={[]} />)

  // Two לפי תאריך toggles exist: the group stage's and the bracket's (last in DOM).
  const toggles = screen.getAllByRole('button', { name: 'לפי תאריך' })
  await userEvent.click(toggles[toggles.length - 1])

  // The tree gives way to the chronological list: date bands + round names.
  expect(document.querySelector('.bk-list')).not.toBeNull()
  expect(document.querySelector('.bk-board')).toBeNull()
  expect(document.querySelectorAll('.bk-date-band').length).toBeGreaterThan(0)
  expect(document.querySelector('.bk-meta-round')).not.toBeNull()
})

test('the bracket toggle switches back to the tree', async () => {
  render(<ResultsPage users={[]} />)

  const byDate = screen.getAllByRole('button', { name: 'לפי תאריך' })
  await userEvent.click(byDate[byDate.length - 1])
  await userEvent.click(screen.getByRole('button', { name: 'עץ הבראקט' }))

  expect(document.querySelector('.bk-board')).not.toBeNull()
  expect(document.querySelector('.bk-list')).toBeNull()
})
