import { useEffect, useRef, useState } from 'react'
import { GROUPS } from './groups'
import { isLive } from './matchOrder'
import { tournamentResults } from '../tournament-results'
import { mapLiveEvents, type LiveEvent, type LiveOverlay } from './espnLive'

const POLL_MS = 30_000
const LIVENESS_CHECK_MS = 60_000
const EMPTY: LiveOverlay = { scores: {}, goals: {} }

// Abort a single poll if it can't complete in time, so a slow/hanging request
// never ties up one of the browser's few per-host connections.
const FETCH_TIMEOUT_MS = 10_000

// Cheap structural equality so an unchanged poll (e.g. a finished match whose
// score is frozen) never produces a new object — which would otherwise re-render
// every live-connected page every 30s for no reason.
function sameOverlay(a: LiveOverlay, b: LiveOverlay): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

// Skip live polling under Vitest so the unit suite never makes real network
// calls (it has no /api server). Has no effect on the production browser build,
// where `process` is undefined.
const IS_TEST = typeof process !== 'undefined' && process.env?.VITEST === 'true'

const ALL_MATCHES = Object.values(GROUPS).flatMap(g => g.matches)

function finalMatchIds(): Set<string> {
  const ids = new Set<string>()
  for (const matches of Object.values(tournamentResults.groupMatches)) {
    for (const m of matches) {
      if (m.scores?.home != null && m.scores?.away != null) ids.add(m.id)
    }
  }
  return ids
}

// Pure gate (no React) so it can be unit-tested: is any not-yet-final match
// currently inside its kickoff window?
export function isAnyLive(
  matches: { id: string; matchDate?: string; kickoffIST?: string }[],
  finalIds: Set<string>,
  now: Date,
): boolean {
  return matches.some(m => !finalIds.has(m.id) && isLive(m, now))
}

// Polls /api/live-scores ONLY while a match is in progress (the "only during
// games" rule), and only on the client. Returns an empty overlay otherwise, or
// if the fetch fails. No commits, no redeploys: this is a pure runtime overlay.
export function useLiveScores(): LiveOverlay {
  const [overlay, setOverlay] = useState<LiveOverlay>(EMPTY)
  const overlayRef = useRef<LiveOverlay>(EMPTY)
  const [live, setLive] = useState(() => isAnyLive(ALL_MATCHES, finalMatchIds(), new Date()))

  // Re-evaluate liveness over time so polling starts/stops as matches begin and
  // end while the page stays open. Only re-render when the boolean actually
  // flips — never on every tick.
  useEffect(() => {
    const id = setInterval(() => {
      const next = isAnyLive(ALL_MATCHES, finalMatchIds(), new Date())
      setLive(prev => (prev === next ? prev : next))
    }, LIVENESS_CHECK_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!live || IS_TEST) {
      if (overlayRef.current !== EMPTY) {
        overlayRef.current = EMPTY
        setOverlay(EMPTY)
      }
      return
    }
    let cancelled = false
    // Never let two polls overlap: a new tick is skipped while one is still in
    // flight, so a slow request can't snowball into a pile of open connections.
    let inFlight = false

    const poll = async () => {
      if (inFlight) return
      inFlight = true
      try {
        const res = await fetch('/api/live-scores', { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
        if (!res.ok) return
        const data = (await res.json()) as { events?: LiveEvent[] }
        if (cancelled) return
        const next = mapLiveEvents(data.events ?? [])
        // Only re-render when the live picture actually changed.
        if (!sameOverlay(overlayRef.current, next)) {
          overlayRef.current = next
          setOverlay(next)
        }
      } catch {
        // Network/ESPN hiccup or timeout: keep the last overlay; next poll retries.
      } finally {
        inFlight = false
      }
    }

    void poll()
    const id = setInterval(() => void poll(), POLL_MS)

    // People don't watch the app — they open it right after a goal. On a cold
    // open the mount poll above already fetches immediately; this covers the
    // other case: returning to a tab that was backgrounded (where the browser
    // throttles/pauses the interval), so the score refreshes the instant the
    // tab becomes visible instead of waiting up to POLL_MS.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void poll()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [live])

  return live ? overlay : EMPTY
}
