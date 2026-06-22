import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import KnockoutMatchPage from './KnockoutMatchPage'

// Nav renders a participant picker we don't care about here.
vi.mock('../../Nav', () => ({ default: () => null, USER_STORAGE_EVENT: 'userStorageUpdated' }))

// Groups A and B aren't complete yet, so match 73's two slots are both
// unresolved: we show the descriptors ("סגנית א" / "סגנית ב") rather than
// team names, with no flags. The round and kickoff are fixed regardless.
test('shows descriptors for both unresolved slots of match 73', () => {
  render(<KnockoutMatchPage matchNum={73} />)
  expect(screen.getByText('סגנית א')).toBeInTheDocument()
  expect(screen.getByText('סגנית ב')).toBeInTheDocument()
  expect(screen.getByText(/שלב ה-32/)).toBeInTheDocument()
  expect(screen.getByText('28 ביוני')).toBeInTheDocument()
  expect(document.querySelector('.fi')).toBeNull()
})
