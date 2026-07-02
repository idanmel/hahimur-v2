import { afterEach, expect, test, vi } from 'vitest'
import { reportUsage } from './reportUsage'

declare global {
  interface Window { happyDOM: { setURL(url: string): void } }
}

afterEach(() => vi.unstubAllGlobals())

test('POSTs the feature and who to /api/click from a real host', () => {
  window.happyDOM.setURL('https://hahimur.vercel.app/')
  const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}'))
  vi.stubGlobal('fetch', fetchMock)

  reportUsage('date-view', 'idan')

  expect(fetchMock).toHaveBeenCalledWith('/api/click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feature: 'date-view', who: 'idan' }),
  })
})

test('defaults who to empty string when the viewer is anonymous', () => {
  window.happyDOM.setURL('https://hahimur.vercel.app/')
  const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}'))
  vi.stubGlobal('fetch', fetchMock)

  reportUsage('all-tzelifot')

  expect(fetchMock).toHaveBeenCalledWith('/api/click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feature: 'all-tzelifot', who: '' }),
  })
})

test('does not POST from localhost', () => {
  window.happyDOM.setURL('http://localhost:5173/')
  const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}'))
  vi.stubGlobal('fetch', fetchMock)

  reportUsage('all-tzelifot', 'idan')

  expect(fetchMock).not.toHaveBeenCalled()
})

test('swallows a failed report instead of throwing', () => {
  window.happyDOM.setURL('https://hahimur.vercel.app/')
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

  expect(() => reportUsage('all-tzelifot', 'idan')).not.toThrow()
})
