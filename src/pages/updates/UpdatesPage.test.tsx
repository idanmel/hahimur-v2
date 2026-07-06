import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, afterEach } from 'vitest'
import UpdatesPage from './UpdatesPage'

afterEach(() => vi.restoreAllMocks())

function mockFetch(data: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve(data) }))
}

test('renders update subject fetched from /updates.json', async () => {
  mockFetch([{ id: 1, date: '7 ביוני 2026', subject: 'כותרת בדיקה', text: '' }])
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
    { id: 1, date: '7 ביוני 2026', subject: 'גלוי', text: '' },
    { id: 2, date: '8 ביוני 2026', subject: 'טיוטה נסתרת', text: '', draft: true },
  ])
  render(<UpdatesPage />)
  await waitFor(() => expect(screen.getByText('גלוי')).toBeInTheDocument())
  expect(screen.queryByText('טיוטה נסתרת')).not.toBeInTheDocument()
})

test('newest update is expanded, older updates are collapsed', async () => {
  mockFetch([
    { id: 2, date: '8 ביוני 2026', subject: 'החדש', text: 'גוף העדכון החדש' },
    { id: 1, date: '7 ביוני 2026', subject: 'הישן', text: 'גוף העדכון הישן' },
  ])
  render(<UpdatesPage />)
  await waitFor(() => expect(screen.getByText('גוף העדכון החדש')).toBeInTheDocument())
  // older update's title shows, but its body is hidden
  expect(screen.getByText('הישן')).toBeInTheDocument()
  expect(screen.queryByText('גוף העדכון הישן')).not.toBeInTheDocument()
})

test('clicking a collapsed update reveals its body', async () => {
  mockFetch([
    { id: 2, date: '8 ביוני 2026', subject: 'החדש', text: 'גוף העדכון החדש' },
    { id: 1, date: '7 ביוני 2026', subject: 'הישן', text: 'גוף העדכון הישן' },
  ])
  render(<UpdatesPage />)
  await waitFor(() => expect(screen.getByText('הישן')).toBeInTheDocument())
  await userEvent.click(screen.getByText('הישן'))
  expect(screen.getByText('גוף העדכון הישן')).toBeInTheDocument()
})
