import { GROUPS } from './groups'

// A slimmed ESPN scoreboard event, as returned by /api/live-scores. Kept
// minimal and source-agnostic so the endpoint stays a dumb proxy and all the
// mapping logic lives here (where the app's tests already run).
export interface LiveEvent {
  state: string // 'pre' | 'in' | 'post'
  completed: boolean
  home: string | null
  away: string | null
  homeScore: number | null
  awayScore: number | null
  scorers: string[] // one entry per (non-own) goal, ESPN athlete displayName
}

export interface LiveOverlay {
  scores: Record<string, { home: number; away: number }>
  // player (Hebrew) -> match id -> goals in that match
  goals: Record<string, Record<string, number>>
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

// Allowlist of picked players: ESPN athlete displayName -> Hebrew topGoalscorer
// string (must match users/*.ts exactly). Only players users picked appear here.
const SCORER_ALIASES: Record<string, string> = {
  'Kylian Mbappé': 'קיליאן אמבפה',
  'Harry Kane': 'הארי קיין',
  'Kai Havertz': 'קאי האברץ',
  'Ferran Torres': 'פראן טורס',
  'Lamin Yamal': 'לאמין ימאל',
  'Florian Wirtz': 'פלוריאן וירץ',
  'Vinícius Júnior': 'ויניסיוס ג׳וניור',
}

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

// Maps slim ESPN events to a {scores, goals} overlay, keyed by our match ids.
// Includes in-progress ('in') and completed events; skips pre-match and any
// pairing that isn't a known group fixture (e.g. knockout matches).
export function mapLiveEvents(events: LiveEvent[]): LiveOverlay {
  const scores: LiveOverlay['scores'] = {}
  const goals: LiveOverlay['goals'] = {}

  for (const e of events) {
    if (!e.completed && e.state !== 'in') continue
    const home = canonical(e.home)
    const away = canonical(e.away)
    if (!home || !away) continue
    const hit = pairIndex.get(`${home}|${away}`)
    if (!hit) continue

    if (e.homeScore != null && e.awayScore != null) {
      scores[hit.id] = hit.reversed
        ? { home: e.awayScore, away: e.homeScore }
        : { home: e.homeScore, away: e.awayScore }
    }

    for (const name of e.scorers) {
      const hePlayer = SCORER_ALIASES[name]
      if (!hePlayer) continue
      const byMatch = goals[hePlayer] ?? (goals[hePlayer] = {})
      byMatch[hit.id] = (byMatch[hit.id] ?? 0) + 1
    }
  }

  return { scores, goals }
}
