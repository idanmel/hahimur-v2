import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, afterEach } from 'vitest'
import AdminPage from './AdminPage'

afterEach(() => vi.restoreAllMocks())

function mockFetch(status: number, body: unknown = {}) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }))
}

test('renders subject field', () => {
  render(<AdminPage />)
  expect(screen.getByLabelText(/נושא/i)).toBeInTheDocument()
})

test('renders paragraphs field', () => {
  render(<AdminPage />)
  expect(screen.getByLabelText(/פסקאות/i)).toBeInTheDocument()
})

test('renders password field', () => {
  render(<AdminPage />)
  expect(screen.getByLabelText(/סיסמה/i)).toBeInTheDocument()
})

test('renders submit button', () => {
  render(<AdminPage />)
  expect(screen.getByRole('button', { name: /פרסם/i })).toBeInTheDocument()
})

test('submit button is disabled while loading', async () => {
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
  render(<AdminPage />)
  fireEvent.change(screen.getByLabelText(/נושא/i), { target: { value: 'כותרת' } })
  fireEvent.change(screen.getByLabelText(/סיסמה/i), { target: { value: 'pass' } })
  fireEvent.submit(screen.getByRole('form'))
  expect(screen.getByRole('button', { name: /שולח/i })).toBeDisabled()
})

test('shows success message and clears subject and paragraphs on 200', async () => {
  mockFetch(200, { ok: true })
  render(<AdminPage />)
  fireEvent.change(screen.getByLabelText(/נושא/i), { target: { value: 'כותרת' } })
  fireEvent.change(screen.getByLabelText(/פסקאות/i), { target: { value: 'פסקה' } })
  fireEvent.change(screen.getByLabelText(/סיסמה/i), { target: { value: 'pass' } })
  fireEvent.submit(screen.getByRole('form'))
  await waitFor(() => expect(screen.getByText(/פורסם/i)).toBeInTheDocument())
  expect((screen.getByLabelText(/נושא/i) as HTMLInputElement).value).toBe('')
  expect((screen.getByLabelText(/פסקאות/i) as HTMLTextAreaElement).value).toBe('')
})

test('password field stays filled after successful submit', async () => {
  mockFetch(200, { ok: true })
  render(<AdminPage />)
  fireEvent.change(screen.getByLabelText(/נושא/i), { target: { value: 'כותרת' } })
  fireEvent.change(screen.getByLabelText(/סיסמה/i), { target: { value: 'mysecret' } })
  fireEvent.submit(screen.getByRole('form'))
  await waitFor(() => expect(screen.getByText(/פורסם/i)).toBeInTheDocument())
  expect((screen.getByLabelText(/סיסמה/i) as HTMLInputElement).value).toBe('mysecret')
})

test('saves password to localStorage on success', async () => {
  mockFetch(200, { ok: true })
  render(<AdminPage />)
  fireEvent.change(screen.getByLabelText(/נושא/i), { target: { value: 'כותרת' } })
  fireEvent.change(screen.getByLabelText(/סיסמה/i), { target: { value: 'mysecret' } })
  fireEvent.submit(screen.getByRole('form'))
  await waitFor(() => expect(screen.getByText(/פורסם/i)).toBeInTheDocument())
  expect(localStorage.getItem('admin_password')).toBe('mysecret')
})

test('pre-fills password from localStorage', () => {
  localStorage.setItem('admin_password', 'saved-pass')
  render(<AdminPage />)
  expect((screen.getByLabelText(/סיסמה/i) as HTMLInputElement).value).toBe('saved-pass')
})

test('shows סיסמה שגויה and clears localStorage password on 401', async () => {
  localStorage.setItem('admin_password', 'wrong')
  mockFetch(401, { error: 'Unauthorized' })
  render(<AdminPage />)
  fireEvent.change(screen.getByLabelText(/נושא/i), { target: { value: 'כותרת' } })
  fireEvent.change(screen.getByLabelText(/סיסמה/i), { target: { value: 'wrong' } })
  fireEvent.submit(screen.getByRole('form'))
  await waitFor(() => expect(screen.getByText('סיסמה שגויה')).toBeInTheDocument())
  expect(localStorage.getItem('admin_password')).toBeNull()
})

test('shows generic error message on non-401 failure', async () => {
  mockFetch(500, { error: 'Server error' })
  render(<AdminPage />)
  fireEvent.change(screen.getByLabelText(/נושא/i), { target: { value: 'כותרת' } })
  fireEvent.change(screen.getByLabelText(/סיסמה/i), { target: { value: 'pass' } })
  fireEvent.submit(screen.getByRole('form'))
  await waitFor(() => expect(screen.getByText(/שגיאה/i)).toBeInTheDocument())
})

test('form stays filled on error', async () => {
  mockFetch(500, { error: 'Server error' })
  render(<AdminPage />)
  fireEvent.change(screen.getByLabelText(/נושא/i), { target: { value: 'כותרת' } })
  fireEvent.change(screen.getByLabelText(/פסקאות/i), { target: { value: 'טקסט' } })
  fireEvent.change(screen.getByLabelText(/סיסמה/i), { target: { value: 'pass' } })
  fireEvent.submit(screen.getByRole('form'))
  await waitFor(() => expect(screen.getByText(/שגיאה/i)).toBeInTheDocument())
  expect((screen.getByLabelText(/נושא/i) as HTMLInputElement).value).toBe('כותרת')
  expect((screen.getByLabelText(/פסקאות/i) as HTMLTextAreaElement).value).toBe('טקסט')
})

test('sends POST with subject, paragraphs array, and password', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) })
  vi.stubGlobal('fetch', fetchMock)
  render(<AdminPage />)
  fireEvent.change(screen.getByLabelText(/נושא/i), { target: { value: 'כותרת' } })
  fireEvent.change(screen.getByLabelText(/פסקאות/i), { target: { value: 'פסקה א\n\nפסקה ב' } })
  fireEvent.change(screen.getByLabelText(/סיסמה/i), { target: { value: 'pass' } })
  fireEvent.submit(screen.getByRole('form'))
  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  const [url, opts] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/publish-update')
  const body = JSON.parse(opts.body)
  expect(body.subject).toBe('כותרת')
  expect(body.paragraphs).toEqual(['פסקה א', 'פסקה ב'])
  expect(body.password).toBe('pass')
  expect(typeof body.date).toBe('string')
  expect(body.date.length).toBeGreaterThan(0)
})
