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
for (const group of Object.values(GROUPS)) {
  for (const m of group.matches) {
    pairIndex.set(`${m.homeTeam}|${m.awayTeam}`, { id: m.id, reversed: false })
    pairIndex.set(`${m.awayTeam}|${m.homeTeam}`, { id: m.id, reversed: true })
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

function loadToken(): string | undefined {
  if (process.env.FOOTBALL_DATA_TOKEN) return process.env.FOOTBALL_DATA_TOKEN
  const envPath = join(__dirname, '../.env.local')
  if (existsSync(envPath)) {
    const match = readFileSync(envPath, 'utf-8').match(/^FOOTBALL_DATA_TOKEN=(.+)$/m)
    if (match) return match[1].trim()
  }
  return undefined
}

async function main(): Promise<void> {
  const token = loadToken()
  if (!token) {
    console.error('Missing FOOTBALL_DATA_TOKEN (env var or .env.local)')
    process.exit(1)
  }

  const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
    headers: { 'X-Auth-Token': token },
  })
  if (!res.ok) {
    console.error(`football-data.org returned ${res.status}: ${await res.text()}`)
    process.exit(1)
  }
  const { matches } = await res.json() as { matches: ApiMatch[] }
  console.log(`Fetched ${matches.length} matches from football-data.org`)

  const { scores: fetched, unmapped } = extractGroupScores(matches)

  const merged = readGroupScores()

  const changed: string[] = []
  for (const [id, score] of Object.entries(fetched)) {
    const existing = merged[id]
    if (!existing || existing.home !== score.home || existing.away !== score.away) {
      changed.push(`${id}: ${existing ? `${existing.home}-${existing.away} → ` : ''}${score.home}-${score.away}`)
    }
    merged[id] = score
  }

  if (unmapped.length > 0) {
    console.warn(`Could not map ${unmapped.length} finished group matches:`)
    for (const u of unmapped) console.warn(`  ${u}`)
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
