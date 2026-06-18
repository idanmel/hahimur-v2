import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, afterEach } from 'vitest'
import AdminPage from './AdminPage'

// AdminPage's PageLayout renders Nav -> UserPicker, which loads the 27-user
// barrel. These tests only exercise the publish form, so stub the nav out.
vi.mock('../../Nav', () => ({ default: () => null, USER_STORAGE_EVENT: 'userStorageUpdated' }))

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

test('renders text field', () => {
  render(<AdminPage />)
  expect(screen.getByLabelText(/תוכן/i)).toBeInTheDocument()
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

test('shows success message and clears subject and text on 200', async () => {
  mockFetch(200, { ok: true })
  render(<AdminPage />)
  fireEvent.change(screen.getByLabelText(/נושא/i), { target: { value: 'כותרת' } })
  fireEvent.change(screen.getByLabelText(/תוכן/i), { target: { value: 'פסקה' } })
  fireEvent.change(screen.getByLabelText(/סיסמה/i), { target: { value: 'pass' } })
  fireEvent.submit(screen.getByRole('form'))
  await waitFor(() => expect(screen.getByText(/פורסם/i)).toBeInTheDocument())
  expect((screen.getByLabelText(/נושא/i) as HTMLInputElement).value).toBe('')
  expect((screen.getByLabelText(/תוכן/i) as HTMLTextAreaElement).value).toBe('')
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
  fireEvent.change(screen.getByLabelText(/תוכן/i), { target: { value: 'טקסט' } })
  fireEvent.change(screen.getByLabelText(/סיסמה/i), { target: { value: 'pass' } })
  fireEvent.submit(screen.getByRole('form'))
  await waitFor(() => expect(screen.getByText(/שגיאה/i)).toBeInTheDocument())
  expect((screen.getByLabelText(/נושא/i) as HTMLInputElement).value).toBe('כותרת')
  expect((screen.getByLabelText(/תוכן/i) as HTMLTextAreaElement).value).toBe('טקסט')
})

test('pre-fills subject and text from saved draft', () => {
  localStorage.setItem('admin_draft_subject', 'טיוטה')
  localStorage.setItem('admin_draft_text', 'תוכן שנשמר')
  render(<AdminPage />)
  expect((screen.getByLabelText(/נושא/i) as HTMLInputElement).value).toBe('טיוטה')
  expect((screen.getByLabelText(/תוכן/i) as HTMLTextAreaElement).value).toBe('תוכן שנשמר')
  localStorage.removeItem('admin_draft_subject')
  localStorage.removeItem('admin_draft_text')
})

test('saves draft to localStorage while typing', () => {
  render(<AdminPage />)
  fireEvent.change(screen.getByLabelText(/נושא/i), { target: { value: 'כותרת בעבודה' } })
  fireEvent.change(screen.getByLabelText(/תוכן/i), { target: { value: 'טקסט בעבודה' } })
  expect(localStorage.getItem('admin_draft_subject')).toBe('כותרת בעבודה')
  expect(localStorage.getItem('admin_draft_text')).toBe('טקסט בעבודה')
  localStorage.removeItem('admin_draft_subject')
  localStorage.removeItem('admin_draft_text')
})

test('clears draft from localStorage on successful publish', async () => {
  mockFetch(200, { ok: true })
  render(<AdminPage />)
  fireEvent.change(screen.getByLabelText(/נושא/i), { target: { value: 'כותרת' } })
  fireEvent.change(screen.getByLabelText(/תוכן/i), { target: { value: 'פסקה' } })
  fireEvent.change(screen.getByLabelText(/סיסמה/i), { target: { value: 'pass' } })
  fireEvent.submit(screen.getByRole('form'))
  await waitFor(() => expect(screen.getByText(/פורסם/i)).toBeInTheDocument())
  expect(localStorage.getItem('admin_draft_subject')).toBeNull()
  expect(localStorage.getItem('admin_draft_text')).toBeNull()
})

test('sends POST with subject, text, and password', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) })
  vi.stubGlobal('fetch', fetchMock)
  render(<AdminPage />)
  fireEvent.change(screen.getByLabelText(/נושא/i), { target: { value: 'כותרת' } })
  fireEvent.change(screen.getByLabelText(/תוכן/i), { target: { value: 'שלום עולם' } })
  fireEvent.change(screen.getByLabelText(/סיסמה/i), { target: { value: 'pass' } })
  fireEvent.submit(screen.getByRole('form'))
  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  const [url, opts] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/publish-update')
  const body = JSON.parse(opts.body)
  expect(body.subject).toBe('כותרת')
  expect(body.text).toBe('שלום עולם')
  expect(body.password).toBe('pass')
  expect(typeof body.date).toBe('string')
  expect(body.date.length).toBeGreaterThan(0)
})
