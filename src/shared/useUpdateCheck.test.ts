// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { vi, beforeEach, afterEach, describe, test, expect } from 'vitest'
import { useUpdateCheck } from './useUpdateCheck'

const htmlWith = (src: string) =>
  `<html><head></head><body><script type="module" crossorigin src="${src}"></script></body></html>`

const CURRENT_HASH = '/assets/index-abc123.js'
const NEW_HASH = '/assets/index-xyz999.js'

describe('useUpdateCheck', () => {
  beforeEach(() => {
    const script = document.createElement('script')
    script.type = 'module'
    script.setAttribute('crossorigin', '')
    script.src = CURRENT_HASH
    document.body.appendChild(script)
    vi.useFakeTimers()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  test('returns updateAvailable false on mount', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      text: () => Promise.resolve(htmlWith(CURRENT_HASH)),
    } as Response)

    const { result } = renderHook(() => useUpdateCheck(5000))

    expect(result.current.updateAvailable).toBe(false)
  })

  test('returns updateAvailable false when fetched hash matches current', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      text: () => Promise.resolve(htmlWith(CURRENT_HASH)),
    } as Response)

    const { result } = renderHook(() => useUpdateCheck(5000))

    await act(async () => { vi.advanceTimersByTime(5000) })

    expect(result.current.updateAvailable).toBe(false)
  })

  test('sets updateAvailable true when fetched hash differs from current', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      text: () => Promise.resolve(htmlWith(NEW_HASH)),
    } as Response)

    const { result } = renderHook(() => useUpdateCheck(5000))

    await act(async () => { vi.advanceTimersByTime(5000) })

    expect(result.current.updateAvailable).toBe(true)
  })

  test('polls fetch on each interval tick', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      text: () => Promise.resolve(htmlWith(CURRENT_HASH)),
    } as Response)

    renderHook(() => useUpdateCheck(5000))

    await act(async () => { vi.advanceTimersByTime(15000) })

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  test('does not check for updates when no hashed script is in the DOM', async () => {
    document.body.innerHTML = ''
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      text: () => Promise.resolve(htmlWith(NEW_HASH)),
    } as Response)

    renderHook(() => useUpdateCheck(5000))

    await act(async () => { vi.advanceTimersByTime(5000) })

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
