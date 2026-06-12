import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join, dirname } from 'node:path'
import { GROUPS } from '../src/shared/groups.ts'
import { readGroupScores, writeGroupScores } from './results-file.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export interface ApiMatch {
  status: string
  stage: string
  homeTeam: { name: string | null }
  awayTeam: { name: string | null }
  score: { fullTime: { home: number | null; away: number | null } }
}

// football-data.org names → the names used in shared/groups.ts
const NAME_ALIASES: Record<string, string> = {
  'Korea Republic': 'South Korea',
  'Czechia': 'Czech Republic',
  'Türkiye': 'Turkey',
  'USA': 'United States',
  'IR Iran': 'Iran',
  "Côte d'Ivoire": 'Ivory Coast',
  'Cape Verde Islands': 'Cape Verde',
  'Congo DR': 'DR Congo',
  'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
}

function canonical(name: string | null): string | null {
  return name == null ? null : NAME_ALIASES[name] ?? name
}

const pairIndex = new Map<string, { id: string; reversed: boolean }>()
const knownTeams = new Set<string>()
for (const group of Object.values(GROUPS)) {
  for (const m of group.matches) {
    pairIndex.set(`${m.homeTeam}|${m.awayTeam}`, { id: m.id, reversed: false })
    pairIndex.set(`${m.awayTeam}|${m.homeTeam}`, { id: m.id, reversed: true })
    knownTeams.add(m.homeTeam)
    knownTeams.add(m.awayTeam)
  }
}

export function extractGroupScores(apiMatches: ApiMatch[]): {
  scores: Record<string, { home: number; away: number }>
  unmapped: string[]
} {
  const scores: Record<string, { home: number; away: number }> = {}
  const unmapped: string[] = []

  for (const m of apiMatches) {
    if (m.status !== 'FINISHED' || m.stage !== 'GROUP_STAGE') continue
    const home = canonical(m.homeTeam.name)
    const away = canonical(m.awayTeam.name)
    const hit = home && away ? pairIndex.get(`${home}|${away}`) : undefined
    const ft = m.score.fullTime
    if (!hit || ft.home == null || ft.away == null) {
      unmapped.push(`${m.homeTeam.name} vs ${m.awayTeam.name}`)
      continue
    }
    scores[hit.id] = hit.reversed
      ? { home: ft.away, away: ft.home }
      : { home: ft.home, away: ft.away }
  }

  return { scores, unmapped }
}

export interface EspnEvent {
  status: { type: { state: string; completed: boolean } }
  competitions: {
    competitors: { homeAway: string; score?: string; team: { displayName: string } }[]
  }[]
}

export function extractEspnGroupScores(events: EspnEvent[]): {
  scores: Record<string, { home: number; away: number }>
  unmapped: string[]
} {
  const scores: Record<string, { home: number; away: number }> = {}
  const unmapped: string[] = []

  for (const e of events) {
    if (!e.status.type.completed) continue
    const competitors = e.competitions[0]?.competitors ?? []
    const homeSide = competitors.find(c => c.homeAway === 'home')
    const awaySide = competitors.find(c => c.homeAway === 'away')
    if (!homeSide || !awaySide) continue
    const home = canonical(homeSide.team.displayName)!
    const away = canonical(awaySide.team.displayName)!
    const homeScore = parseInt(homeSide.score ?? '')
    const awayScore = parseInt(awaySide.score ?? '')
    const hit = pairIndex.get(`${home}|${away}`)
    if (!hit || isNaN(homeScore) || isNaN(awayScore)) {
      // Two known teams that aren't a group pairing is a knockout match,
      // not a mapping failure — the date window can't exclude those because
      // the knockout stage starts on the last group matchday.
      if (hit || !knownTeams.has(home) || !knownTeams.has(away)) {
        unmapped.push(`${homeSide.team.displayName} vs ${awaySide.team.displayName}`)
      }
      continue
    }
    scores[hit.id] = hit.reversed
      ? { home: awayScore, away: homeScore }
      : { home: homeScore, away: awayScore }
  }

  return { scores, unmapped }
}

type ScoreMap = Record<string, { home: number; away: number }>

export function mergeScores(primary: ScoreMap, backup: ScoreMap): {
  scores: ScoreMap
  conflicts: string[]
} {
  const scores: ScoreMap = { ...backup, ...primary }
  const conflicts: string[] = []
  for (const [id, p] of Object.entries(primary)) {
    const b = backup[id]
    if (b && (b.home !== p.home || b.away !== p.away)) {
      conflicts.push(`${id}: primary says ${p.home}-${p.away}, backup says ${b.home}-${b.away}`)
    }
  }
  return { scores, conflicts }
}

// Test hook: pretend a match finished, e.g. "A1=9-9" (used by the
// workflow's fake_finished input to rehearse the update path).
export function parseFakeFinished(spec: string): { id: string; home: number; away: number } | null {
  const m = spec.match(/^(\w+)=(\d+)-(\d+)$/)
  if (!m) return null
  const known = Object.values(GROUPS).some(g => g.matches.some(match => match.id === m[1]))
  if (!known) return null
  return { id: m[1], home: parseInt(m[2]), away: parseInt(m[3]) }
}

function loadToken(): string | undefined {
  if (process.env.FOOTBALL_DATA_TOKEN) return process.env.FOOTBALL_DATA_TOKEN
  const envPath = join(__dirname, '../.env.local')
  if (existsSync(envPath)) {
    const match = readFileSync(envPath, 'utf-8').match(/^FOOTBALL_DATA_TOKEN=(.+)$/m)
    if (match) return match[1].trim()
  }
  return undefined
}

// The knockout stage starts on the last group matchday (June 28), so this
// window admits one round-of-32 match; extractEspnGroupScores skips it.
const GROUP_STAGE_DATES = '20260611-20260628'

async function fetchEspnScores(): Promise<{ scores: ScoreMap; unmapped: string[] }> {
  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${GROUP_STAGE_DATES}&limit=200`,
  )
  if (!res.ok) throw new Error(`ESPN returned ${res.status}: ${await res.text()}`)
  const { events } = await res.json() as { events: EspnEvent[] }
  console.log(`Fetched ${events.length} matches from ESPN`)
  return extractEspnGroupScores(events)
}

async function fetchFootballDataScores(): Promise<{ scores: ScoreMap; unmapped: string[] }> {
  const token = loadToken()
  if (!token) throw new Error('Missing FOOTBALL_DATA_TOKEN (env var or .env.local)')

  const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
    headers: { 'X-Auth-Token': token },
  })
  if (!res.ok) throw new Error(`football-data.org returned ${res.status}: ${await res.text()}`)
  const { matches } = await res.json() as { matches: ApiMatch[] }
  console.log(`Fetched ${matches.length} matches from football-data.org`)
  return extractGroupScores(matches)
}

function warnUnmapped(source: string, unmapped: string[]): void {
  if (unmapped.length === 0) return
  console.warn(`${source}: could not map ${unmapped.length} finished group matches:`)
  for (const u of unmapped) console.warn(`  ${u}`)
}

type Extracted = { scores: ScoreMap; unmapped: string[] }

// A single source failing (ESPN is unofficial, football-data needs a token)
// only loses us its scores for this run; the cron retries in 5 minutes.
export async function gatherScores(
  fetchEspn: () => Promise<Extracted>,
  fetchFootballData: () => Promise<Extracted>,
): Promise<{ scores: ScoreMap; conflicts: string[] } | null> {
  const [espn, footballData] = await Promise.allSettled([fetchEspn(), fetchFootballData()])
  if (espn.status === 'rejected') console.warn(`ESPN fetch failed: ${espn.reason}`)
  else warnUnmapped('ESPN', espn.value.unmapped)
  if (footballData.status === 'rejected') console.warn(`football-data.org fetch failed: ${footballData.reason}`)
  else warnUnmapped('football-data.org', footballData.value.unmapped)

  if (espn.status === 'rejected' && footballData.status === 'rejected') return null
  return mergeScores(
    espn.status === 'fulfilled' ? espn.value.scores : {},
    footballData.status === 'fulfilled' ? footballData.value.scores : {},
  )
}

async function main(): Promise<void> {
  const gathered = await gatherScores(fetchEspnScores, fetchFootballDataScores)
  if (!gathered) {
    console.error('Both score sources failed.')
    process.exit(1)
  }

  const { scores: fetched, conflicts } = gathered
  for (const c of conflicts) {
    console.warn(`Sources disagree (using ESPN): ${c}`)
  }

  if (process.env.FAKE_FINISHED) {
    const fake = parseFakeFinished(process.env.FAKE_FINISHED)
    if (!fake) {
      console.error(`Bad FAKE_FINISHED value "${process.env.FAKE_FINISHED}", expected e.g. A1=9-9`)
      process.exit(1)
    }
    fetched[fake.id] = { home: fake.home, away: fake.away }
    console.log(`Injected fake finished score ${fake.id}: ${fake.home}-${fake.away}`)
  }

  const merged = readGroupScores()

  const changed: string[] = []
  for (const [id, score] of Object.entries(fetched)) {
    const existing = merged[id]
    if (!existing || existing.home !== score.home || existing.away !== score.away) {
      changed.push(`${id}: ${existing ? `${existing.home}-${existing.away} → ` : ''}${score.home}-${score.away}`)
    }
    merged[id] = score
  }

  if (changed.length === 0) {
    console.log('No score changes.')
    return
  }

  writeGroupScores(merged)
  console.log(`Updated ${changed.length} scores:`)
  for (const c of changed) console.log(`  ${c}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
