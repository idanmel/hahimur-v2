/**
 * Live results: pulls real WC2026 scores from the public, no-key, public-domain
 * openfootball dataset (raw JSON on GitHub, served via CDN — very reliable),
 * and maps each played GROUP match to our fixture id by team pair.
 *
 * Knockout matches are skipped here (openfootball uses placeholders like "W73"
 * until resolved); add them manually in played-results.ts when they're played —
 * those manual entries always override the live data.
 */
import { GROUP_MATCHES, TEAMS } from './src/shared/groups'
import { PLAYED as MANUAL } from './played-results'
import type { PredictionsState, MatchScores } from './src/shared/types'

const SOURCE_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'

// openfootball team name -> our team name (only the two that differ)
const ALIAS: Record<string, string> = {
  'USA': 'United States',
  'Bosnia & Herzegovina': 'Bosnia and Herzegovina',
}
const norm = (n: string) => ALIAS[n] ?? n
const VALID = new Set(Object.keys(TEAMS))

interface RawMatch { team1: string; team2: string; group?: string; date?: string; time?: string; score?: { ft?: number[] } }

/** Parse openfootball date "2026-06-11" + time "13:00 UTC-6" into a sortable epoch (ms). */
function kickoffMs(date?: string, time?: string): number {
  if (!date) return Number.POSITIVE_INFINITY
  const [y, mo, d] = date.split('-').map(Number)
  let hh = 0, mm = 0, offset = 0
  if (time) {
    const [hm, tz] = time.split(/\s+/)
    const [h, m] = (hm ?? '').split(':').map(Number)
    hh = h || 0; mm = m || 0
    const off = /UTC([+-]\d{1,2})/.exec(tz ?? '')
    if (off) offset = Number(off[1])
  }
  // local = UTC + offset  =>  UTC = local - offset
  return Date.UTC(y, (mo || 1) - 1, d || 1, hh - offset, mm)
}

/** A played fixture with the moment it kicked off, for chronological ordering. */
export interface PlayedFixture { id: string; kickoff: number; home: string; away: string; scores: MatchScores }

export interface LiveResult {
  played: PredictionsState
  /** played fixtures in chronological order (earliest first) */
  order: PlayedFixture[]
  count: number
  source: string
  fetchedAt: Date
}

export async function fetchLivePlayed(): Promise<LiveResult> {
  const res = await fetch(SOURCE_URL, { headers: { 'cache-control': 'no-cache' } })
  if (!res.ok) throw new Error(`fetch failed: HTTP ${res.status}`)
  const data = (await res.json()) as { matches: RawMatch[] }

  const played: PredictionsState = {}
  const kickoff: Record<string, number> = {}
  const fixById: Record<string, { home: string; away: string }> = {}
  for (const m of data.matches ?? []) {
    const ft = m.score?.ft
    if (!Array.isArray(ft) || ft.length < 2) continue
    if (typeof m.group !== 'string' || !m.group.startsWith('Group ')) continue
    const g = m.group.slice('Group '.length).trim()
    const t1 = norm(m.team1), t2 = norm(m.team2)
    if (!VALID.has(t1) || !VALID.has(t2)) continue
    const fx = (GROUP_MATCHES[g] ?? []).find(x =>
      (x.homeTeam === t1 && x.awayTeam === t2) || (x.homeTeam === t2 && x.awayTeam === t1))
    if (!fx) continue
    const scores: MatchScores = fx.homeTeam === t1
      ? { home: ft[0], away: ft[1] }
      : { home: ft[1], away: ft[0] }
    played[fx.id] = scores
    kickoff[fx.id] = kickoffMs(m.date, m.time)
    fixById[fx.id] = { home: fx.homeTeam, away: fx.awayTeam }
  }

  // manual overrides (corrections / knockout) always win
  Object.assign(played, MANUAL)

  // chronological timeline: known kickoff first (by date), unknown (manual) last by id
  const order: PlayedFixture[] = Object.keys(played).map(id => {
    const fx = fixById[id] ?? lookupFixture(id)
    return { id, kickoff: kickoff[id] ?? Number.POSITIVE_INFINITY, home: fx.home, away: fx.away, scores: played[id] }
  }).sort((a, b) => (a.kickoff - b.kickoff) || a.id.localeCompare(b.id))

  return { played, order, count: Object.keys(played).length, source: 'openfootball', fetchedAt: new Date() }
}

/** Resolve home/away team names for any fixture id (group matches only here). */
function lookupFixture(id: string): { home: string; away: string } {
  for (const list of Object.values(GROUP_MATCHES)) {
    const m = list.find(x => x.id === id)
    if (m) return { home: m.homeTeam, away: m.awayTeam }
  }
  return { home: id, away: '' }
}
