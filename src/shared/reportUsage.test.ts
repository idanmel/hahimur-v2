import { afterEach, expect, test, vi } from 'vitest'
import { reportUsage } from './reportUsage'

declare global {
  interface Window { happyDOM: { setURL(url: string): void } }
}

afterEach(() => vi.unstubAllGlobals())

test('POSTs to the endpoint from a real host', () => {
  window.happyDOM.setURL('https://hahimur.vercel.app/')
  const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}'))
  vi.stubGlobal('fetch', fetchMock)

  reportUsage('/api/date-view-click')

  expect(fetchMock).toHaveBeenCalledWith('/api/date-view-click', { method: 'POST' })
})

test('does not POST from localhost', () => {
  window.happyDOM.setURL('http://localhost:5173/')
  const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}'))
  vi.stubGlobal('fetch', fetchMock)

  reportUsage('/api/sim-click')

  expect(fetchMock).not.toHaveBeenCalled()
})

test('swallows a failed report instead of throwing', () => {
  window.happyDOM.setURL('https://hahimur.vercel.app/')
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

  expect(() => reportUsage('/api/sim-click')).not.toThrow()
})
