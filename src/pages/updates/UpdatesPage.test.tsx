import { render, screen, waitFor } from '@testing-library/react'
import { vi, afterEach } from 'vitest'
import UpdatesPage from './UpdatesPage'

afterEach(() => vi.restoreAllMocks())

function mockFetch(data: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve(data) }))
}

test('renders update subject fetched from /updates.json', async () => {
  mockFetch([{ id: 1, date: '7 ביוני 2026', subject: 'כותרת בדיקה', paragraphs: [] }])
  render(<UpdatesPage />)
  await waitFor(() => expect(screen.getByText('כותרת בדיקה')).toBeInTheDocument())
})

test('fetches from /updates.json', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) })
  vi.stubGlobal('fetch', fetchMock)
  render(<UpdatesPage />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/updates.json'))
})

test('filters out entries with draft: true', async () => {
  mockFetch([
    { id: 1, date: '7 ביוני 2026', subject: 'גלוי', paragraphs: [] },
    { id: 2, date: '8 ביוני 2026', subject: 'טיוטה נסתרת', paragraphs: [], draft: true },
  ])
  render(<UpdatesPage />)
  await waitFor(() => expect(screen.getByText('גלוי')).toBeInTheDocument())
  expect(screen.queryByText('טיוטה נסתרת')).not.toBeInTheDocument()
})
