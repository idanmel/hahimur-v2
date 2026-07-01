import type { LiveEvent } from './espnLive'

// Sum every scorer occurrence across all events into a tournament goal tally,
// keyed by the raw ESPN athlete displayName (Latin script). The /api/live-scores
// proxy already strips own goals and penalty-shootout kicks (see slimEvent in
// api/live-scores.ts), so a plain occurrence count here is the correct
// standard-FIFA total for EVERY player — picked or not, group stage or knockout.
//
// This is deliberately source-agnostic and unpicked-aware: it does not filter to
// the picked allowlist, so the race board can surface real leaders (e.g. Messi)
// that no participant chose. Mapping ESPN names to Hebrew and merging with the
// picked roster happens downstream.
export function accumulateScorerTotals(events: LiveEvent[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const e of events) {
    for (const name of e.scorers) {
      if (!name) continue
      totals[name] = (totals[name] ?? 0) + 1
    }
  }
  return totals
}
