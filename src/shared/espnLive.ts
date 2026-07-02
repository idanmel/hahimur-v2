import type { MatchScores } from './types'
import { GROUPS } from './groups'
import { espnIdToMatchNum } from './koEventIds'
import { isKoReversed, orientKoScore } from './koOrient'
import { SCORER_ALIASES } from './scorers'

// Re-exported for back-compat: the KO orientation helpers now live in koOrient.ts
// (shared with the cron), but useLiveScores still imports them from here.
export { isKoReversed, orientKoScore }

// A slimmed ESPN scoreboard event, as returned by /api/live-scores. Kept
// minimal and source-agnostic so the endpoint stays a dumb proxy and all the
// mapping logic lives here (where the app's tests already run).
export interface LiveEvent {
  id?: string | null // ESPN event id — how knockout fixtures join to our matchNum
  state: string // 'pre' | 'in' | 'post'
  completed: boolean
  home: string | null
  away: string | null
  homeScore: number | null
  awayScore: number | null
  scorers: string[] // one entry per (non-own) goal, ESPN athlete displayName
  clock?: string | null // ESPN displayClock, e.g. "67'" — only set while in progress
}

export interface LiveOverlay {
  scores: Record<string, { home: number; away: number }>
  // player (Hebrew) -> match id -> goals in that match
  goals: Record<string, Record<string, number>>
  // match id -> live status, present ONLY while a match is in progress (ESPN
  // state 'in', not completed). Its absence is how the UI tells "finished" from
  // "still being played" without leaning on a wall-clock window. `home`/`away`
  // carry the current score (fixture orientation) so the home feed can show it
  // without entering the match page; absent until ESPN reports a score.
  live?: Record<string, { clock: string | null; home?: number; away?: number }>
  // knockout matchNum -> frozen regulation (90') score + advancer, recovered from
  // the per-event summary's period linescores (see espnKnockout.ts). This is the
  // ONLY thing a KO prediction is scored against, so it must not follow the
  // running scoreboard score once a match passes 90' into extra time / penalties.
  // Display still shows the running score (via `live`); scoring reads this.
  koReg?: Record<string, MatchScores>
}

// ESPN/source team names -> the names used in shared/groups.ts. Intentionally a
// local copy (not shared with scripts/fetch-scores.ts) so the live overlay never
// touches Idan's cron pipeline.
const NAME_ALIASES: Record<string, string> = {
  'Korea Republic': 'South Korea',
  Czechia: 'Czech Republic',
  Türkiye: 'Turkey',
  USA: 'United States',
  'IR Iran': 'Iran',
  "Côte d'Ivoire": 'Ivory Coast',
  'Cape Verde Islands': 'Cape Verde',
  'Congo DR': 'DR Congo',
  'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
}

// Allowlist of picked players: ESPN athlete displayName -> canonical Hebrew
// name, derived from the PICKED_SCORERS registry. Only picked players appear;
// every other scorer is intentionally ignored.
export { SCORER_ALIASES }

function canonical(name: string | null): string | null {
  return name == null ? null : NAME_ALIASES[name] ?? name
}

const pairIndex = new Map<string, { id: string; reversed: boolean }>()
for (const group of Object.values(GROUPS)) {
  for (const m of group.matches) {
    pairIndex.set(`${m.homeTeam}|${m.awayTeam}`, { id: m.id, reversed: false })
    pairIndex.set(`${m.awayTeam}|${m.homeTeam}`, { id: m.id, reversed: true })
  }
}

// Resolve an event to one of our match ids. Group fixtures join by team pairing;
// knockout fixtures (not in GROUPS) join by ESPN event id, then orient by name.
function resolveMatch(
  e: LiveEvent,
  home: string | null,
  away: string | null,
): { id: string; reversed: boolean } | null {
  if (home && away) {
    const hit = pairIndex.get(`${home}|${away}`)
    if (hit) return hit
  }
  const matchNum = espnIdToMatchNum(e.id ?? undefined)
  if (matchNum !== undefined) {
    return { id: String(matchNum), reversed: isKoReversed(matchNum, home, away) }
  }
  return null
}

// Maps slim ESPN events to a {scores, goals} overlay, keyed by our match ids.
// Includes in-progress ('in') and completed events; skips pre-match and any
// pairing that isn't a known group fixture (e.g. knockout matches).
export function mapLiveEvents(events: LiveEvent[]): LiveOverlay {
  const scores: LiveOverlay['scores'] = {}
  const goals: LiveOverlay['goals'] = {}
  const live: NonNullable<LiveOverlay['live']> = {}

  for (const e of events) {
    if (!e.completed && e.state !== 'in') continue
    const home = canonical(e.home)
    const away = canonical(e.away)
    const hit = resolveMatch(e, home, away)
    if (!hit) continue

    const oriented =
      e.homeScore != null && e.awayScore != null
        ? hit.reversed
          ? { home: e.awayScore, away: e.homeScore }
          : { home: e.homeScore, away: e.awayScore }
        : null
    if (oriented) scores[hit.id] = oriented

    // Only an in-progress match (not a completed one) gets a live entry — this
    // is what stops the "חי" badge from lingering after the final whistle. We
    // attach the live score (when known) so the home feed can show it too.
    if (e.state === 'in' && !e.completed) {
      live[hit.id] = oriented
        ? { clock: e.clock ?? null, home: oriented.home, away: oriented.away }
        : { clock: e.clock ?? null }
    }

    for (const name of e.scorers) {
      const hePlayer = SCORER_ALIASES[name]
      if (!hePlayer) continue
      const byMatch = goals[hePlayer] ?? (goals[hePlayer] = {})
      byMatch[hit.id] = (byMatch[hit.id] ?? 0) + 1
    }
  }

  return { scores, goals, live }
}
