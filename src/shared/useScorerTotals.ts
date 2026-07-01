import { useEffect, useRef, useState } from 'react'
import { anyLiveNow } from './useLiveScores'
import { accumulateScorerTotals } from './scorerTotals'
import type { LiveEvent } from './espnLive'

const POLL_MS = 30_000
const FETCH_TIMEOUT_MS = 10_000

// Skip network under Vitest (no /api server in the unit suite). No effect on the
// browser build, where `process` is undefined.
const IS_TEST = typeof process !== 'undefined' && process.env?.VITEST === 'true'

// Tournament-wide goal tally keyed by raw ESPN athlete displayName (Latin).
//
// Unlike useLiveScores, this fetches on mount REGARDLESS of liveness: the race
// board must show accumulated totals between match days too, not just while a
// game is in progress. It then re-polls only while a match is live (reusing the
// same CDN-cached proxy — no new endpoint), and refreshes when the tab becomes
// visible again so a backgrounded tab catches up the instant it's reopened.
export function useScorerTotals(): Record<string, number> {
  const [totals, setTotals] = useState<Record<string, number>>({})
  const totalsRef = useRef<Record<string, number>>({})

  useEffect(() => {
    if (IS_TEST) return
    let cancelled = false
    let inFlight = false

    const poll = async () => {
      if (inFlight) return
      inFlight = true
      try {
        const res = await fetch('/api/live-scores', { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
        if (!res.ok) return
        const data = (await res.json()) as { events?: LiveEvent[] }
        if (cancelled) return
        const next = accumulateScorerTotals(data.events ?? [])
        // Only re-render when the tally actually changed.
        if (JSON.stringify(totalsRef.current) !== JSON.stringify(next)) {
          totalsRef.current = next
          setTotals(next)
        }
      } catch {
        // Network/ESPN hiccup or timeout: keep the last tally; next poll retries.
      } finally {
        inFlight = false
      }
    }

    // Always fetch once on mount, even between match days.
    void poll()
    // Re-poll on a timer, but only spend a request when something is live.
    const id = setInterval(() => { if (anyLiveNow()) void poll() }, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') void poll() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return totals
}
