import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join, dirname } from 'node:path'
import { GROUPS } from '../src/shared/groups.ts'
import type { MatchScores } from '../src/shared/types.ts'
import { espnIdToMatchNum } from '../src/shared/koEventIds.ts'
import { isKoReversed, orientKoScore } from '../src/shared/koOrient.ts'
import {
  extractEspnKnockoutResult,
  type EspnKnockoutCompetitor,
} from '../src/shared/espnKnockout.ts'
import {
  readGroupScores,
  writeGroupScores,
  readRealGoals,
  writeRealGoals,
  readKoScores,
  writeKoScores,
} from './results-file.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export interface ApiMatch {
  status: string
  stage: string
  homeTeam: { name: string | null }
  awayTeam: { name: string | null }
  score: { fullTime: { home: number | null; away: number | null } }
}

// Allowlist of picked players: source scorer names (ESPN athlete.displayName)
// → Hebrew topGoalscorer strings (must match users/*.ts exactly). Only players
// users picked appear here; every other scorer is intentionally ignored.
export const SCORER_ALIASES: Record<string, string> = {
  'Kylian Mbappé': 'קיליאן אמבפה',
  'Harry Kane': 'הארי קיין',
  'Kai Havertz': 'קאי האברץ',
  'Ferran Torres': 'פראן טורס',
  'Lamine Yamal': 'לאמין ימאל',
  'Florian Wirtz': 'פלוריאן וירץ',
  'Vinícius Júnior': 'ויניסיוס ג׳וניור',
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

export interface EspnScoringPlay {
  scoringPlay: boolean
  ownGoal: boolean
  athletesInvolved?: { displayName: string }[]
}

export interface EspnEvent {
  id?: string // ESPN event id — how a knockout fixture joins to our matchNum
  status?: { type?: { state: string; completed: boolean } }
  competitions: {
    competitors: { homeAway: string; score?: string; team: { displayName: string } }[]
    details?: EspnScoringPlay[]
  }[]
}

// The per-event summary (…/summary?event=<id>) — the only place the 90' regulation
// score is recoverable for a knockout match (the scoreboard list returns the
// after-ET score with null linescores). competitors live under header.competitions[0].
export interface EspnSummary {
  header?: {
    competitions?: {
      competitors?: {
        homeAway: 'home' | 'away'
        winner?: boolean
        team?: { displayName?: string }
        linescores?: { displayValue: string }[]
      }[]
    }[]
  }
}

// From the (widened) scoreboard, pick out completed knockout events — those whose
// id maps to one of our baked matchNums — fetch each one's summary, recover the
// regulation score + advancer, and orient it into our bracket. Network is injected
// (like gatherScores) so this is unit-testable against captured summary fixtures.
// We only ever read COMPLETED events: drawWinner is only trustworthy once a winner
// is decided, so an in-progress/ET match must not be written. A summary fetch or
// parse failing for one match is warned and skipped — the cron retries in 5 min.
export async function extractEspnKnockoutScores(
  events: EspnEvent[],
  fetchSummary: (espnId: string) => Promise<EspnSummary>,
): Promise<{ scores: Record<string, MatchScores>; warnings: string[] }> {
  const scores: Record<string, MatchScores> = {}
  const warnings: string[] = []

  for (const e of events) {
    if (!e.status?.type?.completed || !e.id) continue
    const matchNum = espnIdToMatchNum(e.id)
    if (matchNum === undefined) continue

    let summary: EspnSummary
    try {
      summary = await fetchSummary(e.id)
    } catch (err) {
      warnings.push(`KO ${matchNum} (event ${e.id}): summary fetch failed: ${err}`)
      continue
    }

    const raw = summary.header?.competitions?.[0]?.competitors ?? []
    const competitors: EspnKnockoutCompetitor[] = raw.map(c => ({
      homeAway: c.homeAway,
      winner: !!c.winner,
      linescores: c.linescores ?? [],
    }))
    const result = extractEspnKnockoutResult(competitors)
    if (!result) {
      warnings.push(`KO ${matchNum} (event ${e.id}): no regulation score in summary yet`)
      continue
    }

    const espnHome = raw.find(c => c.homeAway === 'home')?.team?.displayName ?? null
    const espnAway = raw.find(c => c.homeAway === 'away')?.team?.displayName ?? null
    scores[String(matchNum)] = orientKoScore(result.scores, isKoReversed(matchNum, espnHome, espnAway))
  }

  return { scores, warnings }
}

// Resolve a finished ESPN event to its home/away sides plus the group pairing
// it maps to (`hit` is undefined for knockout or unrecognized matchups).
// Shared by the score and scorer extractors below.
function resolveEspnEvent(e: EspnEvent) {
  if (!e.status?.type?.completed) return null
  const comp = e.competitions[0]
  const competitors = comp?.competitors ?? []
  const homeSide = competitors.find(c => c.homeAway === 'home')
  const awaySide = competitors.find(c => c.homeAway === 'away')
  if (!homeSide || !awaySide) return null
  const home = canonical(homeSide.team.displayName)!
  const away = canonical(awaySide.team.displayName)!
  return { comp, homeSide, awaySide, home, away, hit: pairIndex.get(`${home}|${away}`) }
}

export function extractEspnGroupScores(events: EspnEvent[]): {
  scores: Record<string, { home: number; away: number }>
  unmapped: string[]
} {
  const scores: Record<string, { home: number; away: number }> = {}
  const unmapped: string[] = []

  for (const e of events) {
    const resolved = resolveEspnEvent(e)
    if (!resolved) continue
    const { homeSide, awaySide, home, away, hit } = resolved
    const homeScore = parseInt(homeSide.score ?? '')
    const awayScore = parseInt(awaySide.score ?? '')
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

// ESPN carries goalscorers in each competition's `details`, where every
// scoring play (goal, header, penalty, own goal) is flagged. Unlike
// football-data.org's free tier, these are present, so ESPN is our scorer
// source. We only count goals in matches that map to a group pairing;
// knockout matches between known teams aren't group pairings and are skipped.
export function extractEspnGroupScorers(events: EspnEvent[]): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {}
  for (const e of events) {
    const resolved = resolveEspnEvent(e)
    if (!resolved?.hit) continue
    const { comp, hit } = resolved
    for (const play of comp.details ?? []) {
      if (!play.scoringPlay || play.ownGoal) continue
      for (const athlete of play.athletesInvolved ?? []) {
        const hePlayer = SCORER_ALIASES[athlete.displayName]
        if (!hePlayer) continue
        if (!result[hePlayer]) result[hePlayer] = {}
        result[hePlayer][hit.id] = (result[hePlayer][hit.id] ?? 0) + 1
      }
    }
  }
  return result
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

// The full tournament window (group stage opener → final). One scoreboard call
// serves both paths: extractEspnGroupScores skips knockout events (two known teams
// that aren't a group pairing), and extractEspnKnockoutScores picks them up by id.
const TOURNAMENT_DATES = '20260611-20260719'

async function fetchEspnRaw(): Promise<EspnEvent[]> {
  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${TOURNAMENT_DATES}&limit=300`,
  )
  if (!res.ok) throw new Error(`ESPN returned ${res.status}: ${await res.text()}`)
  const { events } = await res.json() as { events: EspnEvent[] }
  return events
}

async function fetchEspnSummary(espnId: string): Promise<EspnSummary> {
  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${espnId}`,
  )
  if (!res.ok) throw new Error(`ESPN summary ${espnId} returned ${res.status}`)
  return await res.json() as EspnSummary
}

async function fetchFootballDataRaw(): Promise<ApiMatch[]> {
  const token = loadToken()
  if (!token) throw new Error('Missing FOOTBALL_DATA_TOKEN (env var or .env.local)')
  const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
    headers: { 'X-Auth-Token': token },
  })
  if (!res.ok) throw new Error(`football-data.org returned ${res.status}: ${await res.text()}`)
  const { matches } = await res.json() as { matches: ApiMatch[] }
  return matches
}

async function fetchFootballDataScores(): Promise<{ scores: ScoreMap; unmapped: string[] }> {
  const matches = await fetchFootballDataRaw()
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
  let espnEvents: EspnEvent[] | null = null

  const gathered = await gatherScores(async () => {
    espnEvents = await fetchEspnRaw()
    console.log(`Fetched ${espnEvents.length} matches from ESPN`)
    return extractEspnGroupScores(espnEvents)
  }, fetchFootballDataScores)
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

  if (changed.length > 0) {
    writeGroupScores(merged)
    console.log(`Updated ${changed.length} scores:`)
    for (const c of changed) console.log(`  ${c}`)
  }

  if (espnEvents) {
    const freshScorers = extractEspnGroupScorers(espnEvents)
    if (Object.keys(freshScorers).length > 0) {
      const existingGoals = readRealGoals()
      const mergedGoals: Record<string, Record<string, number>> = { ...existingGoals }
      for (const [player, byMatch] of Object.entries(freshScorers)) {
        mergedGoals[player] = { ...(mergedGoals[player] ?? {}), ...byMatch }
      }
      if (JSON.stringify(mergedGoals) !== JSON.stringify(existingGoals)) {
        writeRealGoals(mergedGoals)
        console.log('Updated scorer goals')
      }
    }
  }

  // Knockout: completed KO events carry a regulation score + advancer in their
  // per-event summary. Mirror the group diff-and-write, but compare drawWinner too.
  let koChanged: string[] = []
  if (espnEvents) {
    const { scores: koFetched, warnings } = await extractEspnKnockoutScores(espnEvents, fetchEspnSummary)
    for (const w of warnings) console.warn(w)

    const koMerged = readKoScores()
    for (const [num, score] of Object.entries(koFetched)) {
      const existing = koMerged[num]
      if (
        !existing ||
        existing.home !== score.home ||
        existing.away !== score.away ||
        existing.drawWinner !== score.drawWinner
      ) {
        const adv = score.drawWinner ? ` (${score.drawWinner} advances)` : ''
        const was = existing ? `${existing.home}-${existing.away} → ` : ''
        koChanged.push(`KO ${num}: ${was}${score.home}-${score.away}${adv}`)
      }
      koMerged[num] = score
    }

    if (koChanged.length > 0) {
      writeKoScores(koMerged)
      console.log(`Updated ${koChanged.length} knockout scores:`)
      for (const c of koChanged) console.log(`  ${c}`)
    }
  }

  if (changed.length === 0 && koChanged.length === 0) {
    console.log('No score changes.')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
