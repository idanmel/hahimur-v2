import { vi, afterEach, beforeEach } from 'vitest'
import handler from '../../../api/publish-update'

afterEach(() => vi.restoreAllMocks())

const ADMIN_PASSWORD = 'test-password'

beforeEach(() => {
  vi.stubEnv('ADMIN_PASSWORD', ADMIN_PASSWORD)
  vi.stubEnv('GITHUB_TOKEN', 'fake-token')
})

function makeReq(overrides: Partial<{ method: string; body: unknown }> = {}) {
  return { method: 'POST', body: {}, ...overrides } as unknown as import('@vercel/node').VercelRequest
}

function makeRes() {
  const res = {
    _status: 0,
    _json: undefined as unknown,
    status(code: number) { this._status = code; return this },
    json(data: unknown) { this._json = data; return this },
  }
  return res
}

test('returns 405 for GET request', async () => {
  const req = makeReq({ method: 'GET' })
  const res = makeRes()
  await handler(req, res as never)
  expect(res._status).toBe(405)
})

test('returns 405 for non-POST request', async () => {
  const req = makeReq({ method: 'DELETE' })
  const res = makeRes()
  await handler(req, res as never)
  expect(res._status).toBe(405)
})

test('returns 401 for wrong password', async () => {
  const req = makeReq({ body: { password: 'wrong', subject: 'test', text: '', date: 'today' } })
  const res = makeRes()
  await handler(req, res as never)
  expect(res._status).toBe(401)
})

test('returns 401 for empty password', async () => {
  const req = makeReq({ body: { password: '', subject: 'test', text: '', date: 'today' } })
  const res = makeRes()
  await handler(req, res as never)
  expect(res._status).toBe(401)
})

test('commits to GitHub and returns 200 for correct password', async () => {
  const existingUpdates = [{ id: 1, date: 'old', subject: 'old', text: '' }]
  const encoded = Buffer.from(JSON.stringify(existingUpdates), 'utf-8').toString('base64')
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ content: encoded, sha: 'abc123' }) })
    .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ commit: { sha: 'def456' } }) })
  vi.stubGlobal('fetch', fetchMock)

  const req = makeReq({ body: { password: ADMIN_PASSWORD, subject: 'חדש', text: 'פסקה', date: '8 ביוני 2026' } })
  const res = makeRes()
  await handler(req, res as never)

  expect(res._status).toBe(200)
  expect(fetchMock).toHaveBeenCalledTimes(2)
  const putCall = fetchMock.mock.calls[1]
  expect(putCall[1].method).toBe('PUT')
  const putBody = JSON.parse(putCall[1].body)
  const committed: typeof existingUpdates = JSON.parse(Buffer.from(putBody.content, 'base64').toString('utf-8'))
  expect(committed[0].subject).toBe('חדש')
  expect(committed[0].id).toBe(2)
})

test('returns 401 when ADMIN_PASSWORD env var is not set', async () => {
  vi.stubEnv('ADMIN_PASSWORD', '')
  const req = makeReq({ body: { password: '', subject: 'test', text: '', date: 'today' } })
  const res = makeRes()
  await handler(req, res as never)
  expect(res._status).toBe(401)
})
