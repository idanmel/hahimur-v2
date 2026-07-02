import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from './click'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const sqlMock = vi.fn().mockResolvedValue([])
vi.mock('@neondatabase/serverless', () => ({
  neon: () => sqlMock,
}))

const makeRes = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  }
  res.status.mockReturnValue(res)
  return res as unknown as VercelResponse & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> }
}

describe('POST /api/click', () => {
  beforeEach(() => {
    sqlMock.mockClear()
  })

  it('records a click with feature and who, and responds 200', async () => {
    const res = makeRes()
    await handler({ method: 'POST', body: { feature: 'all-tzelifot', who: 'idan' } } as VercelRequest, res)

    expect(sqlMock).toHaveBeenCalledOnce()
    const [strings, feature, who] = sqlMock.mock.calls[0]
    expect(strings.join('')).toMatch(/INSERT INTO clicks/i)
    expect(feature).toBe('all-tzelifot')
    expect(who).toBe('idan')
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('stores null for who when the viewer is anonymous', async () => {
    const res = makeRes()
    await handler({ method: 'POST', body: { feature: 'date-view' } } as VercelRequest, res)

    expect(sqlMock).toHaveBeenCalledOnce()
    const [, feature, who] = sqlMock.mock.calls[0]
    expect(feature).toBe('date-view')
    expect(who).toBeNull()
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('rejects a missing feature without recording anything', async () => {
    const res = makeRes()
    await handler({ method: 'POST', body: {} } as VercelRequest, res)

    expect(sqlMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('rejects non-POST requests without recording anything', async () => {
    const res = makeRes()
    await handler({ method: 'GET' } as VercelRequest, res)

    expect(sqlMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(405)
  })
})
