import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from './sim-click'
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

describe('POST /api/sim-click', () => {
  beforeEach(() => {
    sqlMock.mockClear()
  })

  it('records a click and responds 200', async () => {
    const res = makeRes()
    await handler({ method: 'POST' } as VercelRequest, res)

    expect(sqlMock).toHaveBeenCalledOnce()
    const [strings] = sqlMock.mock.calls[0]
    expect(strings.join('')).toMatch(/INSERT INTO sim_clicks/i)
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('rejects non-POST requests without recording anything', async () => {
    const res = makeRes()
    await handler({ method: 'GET' } as VercelRequest, res)

    expect(sqlMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(405)
  })
})
