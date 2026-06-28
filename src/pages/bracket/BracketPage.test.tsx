import { render, screen } from '@testing-library/react'
import { vi, beforeEach, afterEach, test, expect } from 'vitest'
import BracketPage from './BracketPage'

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
  render(<BracketPage />)
  for (const heading of ['שלב ה-32', 'שמינית גמר', 'רבע גמר', 'חצי גמר', 'מקום שלישי', 'גמר']) {
    expect(screen.getByText(heading)).toBeInTheDocument()
  }
})

test('renders a real round-of-32 team from the derived results', () => {
  render(<BracketPage />)
  // The group stage is finished, so R32 carries real teams. "ברזיל" (Brazil) is one.
  expect(screen.getAllByText('ברזיל').length).toBeGreaterThan(0)
})

test('reports a bracket-view usage signal on load', () => {
  const fetchSpy = vi.fn(() => Promise.resolve(new Response()))
  vi.stubGlobal('fetch', fetchSpy)
  render(<BracketPage />)
  expect(fetchSpy).toHaveBeenCalledWith('/api/click', expect.objectContaining({
    method: 'POST',
    body: expect.stringContaining('bracket-view'),
  }))
})
