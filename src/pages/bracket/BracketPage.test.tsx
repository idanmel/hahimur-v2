import { render, screen } from '@testing-library/react'
import { vi, beforeEach, afterEach, test, expect } from 'vitest'
import BracketPage from './BracketPage'
import { USERS_SORTED } from '../../users/index'

// The bracket page is read-only chrome around the derived knockout data; stub
// the global nav so page assertions aren't polluted by its participant picker.
vi.mock('../../Nav', () => ({ default: () => null, USER_STORAGE_EVENT: 'userStorageUpdated' }))

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubGlobal('location', { hostname: 'example.com', pathname: '/bracket' })
  // reportUsage fires on load; stub fetch so it doesn't hit the network.
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response())))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('renders every knockout round heading', () => {
  render(<BracketPage users={USERS_SORTED} />)
  for (const heading of ['שלב ה-32', 'שמינית גמר', 'רבע גמר', 'חצי גמר', 'מקום שלישי', 'גמר']) {
    expect(screen.getByText(heading)).toBeInTheDocument()
  }
})

test('renders a real round-of-32 team from the derived results', () => {
  render(<BracketPage users={USERS_SORTED} />)
  // The group stage is finished, so R32 carries real teams. "ברזיל" (Brazil) is one.
  expect(screen.getAllByText('ברזיל').length).toBeGreaterThan(0)
})

test('each match card links to its match page', () => {
  render(<BracketPage users={USERS_SORTED} />)
  // R32 matches are numbered 73–88; every match in the board should be a link to /matches/<num>.
  const link = document.querySelector('a[href="/matches/73"]')
  expect(link).not.toBeNull()
})

test('renders the points table with its scope bar and participants', () => {
  render(<BracketPage users={USERS_SORTED} />)
  // The scope bar's "הכל" mode button anchors the leaderboard section.
  expect(screen.getByRole('button', { name: 'הכל' })).toBeInTheDocument()
  // Participants appear in the table, scored against the real committed results.
  expect(screen.getAllByText('עידן מלמד').length).toBeGreaterThan(0)
})

test('reports a bracket-view usage signal on load', () => {
  const fetchSpy = vi.fn(() => Promise.resolve(new Response()))
  vi.stubGlobal('fetch', fetchSpy)
  render(<BracketPage users={USERS_SORTED} />)
  expect(fetchSpy).toHaveBeenCalledWith('/api/click', expect.objectContaining({
    method: 'POST',
    body: expect.stringContaining('bracket-view'),
  }))
})
