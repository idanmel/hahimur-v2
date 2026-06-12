import { readFileSync, writeFileSync, readdirSync, copyFileSync } from 'fs'
import { resolve } from 'path'
import type { Standing, ThirdPlaceStanding, ThirdPlaceQualification, KnockoutStages, KnockoutMatch, GroupMatch } from '../src/shared/types'

const DOWNLOADS = '/mnt/c/Users/idanm/Downloads'
const RAW_EXPORTS = resolve('raw_exports')

function findNewDownloads(): string[] {
  const existing = new Set(readdirSync(RAW_EXPORTS))
  return readdirSync(DOWNLOADS)
    .filter(f => f.startsWith('wc2026-predictions-') && f.endsWith('.json') && !existing.has(f))
}

const [arg1, arg2] = process.argv.slice(2)
let inputPath: string
let outputSlug: string

if (arg1?.endsWith('.json')) {
  // explicit: import-user.ts <input.json> <output-slug>
  if (!arg2) {
    console.error('Usage: node --experimental-strip-types scripts/import-user.ts <input.json> <output-slug>')
    process.exit(1)
  }
  inputPath = arg1
  outputSlug = arg2
} else {
  // auto-detect from Downloads: import-user.ts <output-slug>
  if (!arg1) {
    console.error('Usage: node --experimental-strip-types scripts/import-user.ts [<input.json>] <output-slug>')
    process.exit(1)
  }
  outputSlug = arg1
  const newFiles = findNewDownloads()
  if (newFiles.length === 0) {
    console.error('No new wc2026-predictions-*.json files found in Downloads.')
    process.exit(1)
  }
  if (newFiles.length > 1) {
    console.error('Multiple new files found in Downloads — specify which one explicitly:')
    newFiles.forEach(f => console.error(`  ${f}`))
    process.exit(1)
  }
  const filename = newFiles[0]
  copyFileSync(`${DOWNLOADS}/${filename}`, `${RAW_EXPORTS}/${filename}`)
  console.log(`Copied: ${filename} → raw_exports/`)
  inputPath = `${RAW_EXPORTS}/${filename}`
}

const raw = JSON.parse(readFileSync(resolve(inputPath), 'utf8'))

if (!raw.topGoalscorer) {
  console.error('Error: missing or empty topGoalscorer in JSON')
  process.exit(1)
}
if (!raw.topGoalscorer.trim().includes(' ')) {
  console.error(`Error: topGoalscorer "${raw.topGoalscorer}" looks like only a last name — expected a full name (e.g. "קיליאן אמבפה")`)
  process.exit(1)
}

const usersDir = resolve('src/users')
const knownGoalscorers = new Set(
  readdirSync(usersDir)
    .filter(f => f.endsWith('.ts') && f !== 'index.ts')
    .map(f => readFileSync(resolve(usersDir, f), 'utf8').match(/export const topGoalscorer = '(.+)'/)?.[1])
    .filter(Boolean)
)
if (!knownGoalscorers.has(raw.topGoalscorer)) {
  console.warn(`Warning: topGoalscorer "${raw.topGoalscorer}" doesn't match any existing user.`)
  console.warn(`Known values: ${[...knownGoalscorers].join(', ')}`)
}

// --- serialize ---

function serializeStanding(s: Standing): string {
  return `    { team: '${s.team}', played: ${s.played}, won: ${s.won}, drawn: ${s.drawn}, lost: ${s.lost}, goalsFor: ${s.goalsFor}, goalsAgainst: ${s.goalsAgainst}, points: ${s.points} }`
}

function serializeThirdPlaceStanding(s: ThirdPlaceStanding): string {
  return `    { team: '${s.team}', played: ${s.played}, won: ${s.won}, drawn: ${s.drawn}, lost: ${s.lost}, goalsFor: ${s.goalsFor}, goalsAgainst: ${s.goalsAgainst}, points: ${s.points}, group: '${s.group}' }`
}

function serializeGroupMatch(m: GroupMatch): string {
  const fields: string[] = [`id: '${m.id}'`, `homeTeam: '${m.homeTeam}'`, `awayTeam: '${m.awayTeam}'`]
  if (m.matchDate) fields.push(`matchDate: '${m.matchDate}'`)
  if (m.kickoffIST) fields.push(`kickoffIST: '${m.kickoffIST}'`)
  if (m.scores) {
    let scores = `{ home: ${m.scores.home}, away: ${m.scores.away}`
    if (m.scores.drawWinner) scores += `, drawWinner: '${m.scores.drawWinner}'`
    scores += ' }'
    fields.push(`scores: ${scores}`)
  }
  return `    { ${fields.join(', ')} }`
}

function serializeKOMatch(m: KnockoutMatch): string {
  const fields: string[] = [`matchNum: ${m.matchNum}`, `home: '${m.home}'`, `away: '${m.away}'`, `resolved: ${m.resolved}`]
  if (m.scores && m.scores.home !== null && m.scores.away !== null) {
    let scores = `{ home: ${m.scores.home}, away: ${m.scores.away}`
    if (m.scores.drawWinner) scores += `, drawWinner: '${m.scores.drawWinner}'`
    scores += ' }'
    fields.push(`scores: ${scores}`)
  }
  if (m.matchDate) fields.push(`matchDate: '${m.matchDate}'`)
  if (m.kickoffIST) fields.push(`kickoffIST: '${m.kickoffIST}'`)
  return `  { ${fields.join(', ')} }`
}

// --- build file ---

const lines: string[] = [
  `import type { Standing, ThirdPlaceStanding, ThirdPlaceQualification, KnockoutStages, GroupMatch } from '../shared/types'`,
  ``,
]

lines.push(`export const topGoalscorer = '${raw.topGoalscorer}'`)
lines.push(`export const label = '${raw.label ?? ''}'`)
lines.push(``)

const groupMatches: Record<string, GroupMatch[]> = raw.groupMatches
lines.push(`export const groupMatches: Record<string, GroupMatch[]> = {`)
for (const [letter, matches] of Object.entries(groupMatches)) {
  lines.push(`  ${letter}: [`)
  for (const m of matches as GroupMatch[]) lines.push(`${serializeGroupMatch(m)},`)
  lines.push(`  ],`)
}
lines.push(`}`, ``)

const groupTables: Record<string, Standing[]> = raw.groupTables
lines.push(`export const groupTables: Record<string, Standing[]> = {`)
for (const [letter, standings] of Object.entries(groupTables)) {
  lines.push(`  ${letter}: [`)
  for (const s of standings as Standing[]) lines.push(`${serializeStanding(s)},`)
  lines.push(`  ],`)
}
lines.push(`}`, ``)

const thirdPlaceTeams: ThirdPlaceStanding[] = raw.thirdPlaceTeams ?? raw.thirdPlaceQualification?.all ?? []
lines.push(`export const thirdPlaceTeams: ThirdPlaceStanding[] = [`)
for (const s of thirdPlaceTeams) lines.push(`${serializeThirdPlaceStanding(s)},`)
lines.push(`]`, ``)

const thirdPlaceQualification: ThirdPlaceQualification = raw.thirdPlaceQualification
lines.push(`export const thirdPlaceQualification: ThirdPlaceQualification = {`)
lines.push(`  resolved: ${thirdPlaceQualification.resolved},`, `  all: [`)
for (const s of thirdPlaceQualification.all) lines.push(`${serializeThirdPlaceStanding(s)},`)
lines.push(`  ],`)
if (thirdPlaceQualification.resolved) {
  lines.push(`  qualifiers: [`)
  for (const s of thirdPlaceQualification.qualifiers) lines.push(`${serializeThirdPlaceStanding(s)},`)
  lines.push(`  ],`)
} else {
  lines.push(`  tied: [`)
  for (const s of thirdPlaceQualification.tied) lines.push(`${serializeThirdPlaceStanding(s)},`)
  lines.push(`  ],`)
}
lines.push(`}`, ``)

const knockoutStages: KnockoutStages = raw.knockoutStages
lines.push(`export const knockoutStages: KnockoutStages = {`)
for (const key of ['r32', 'r16', 'qf', 'sf', 'thirdPlace', 'final'] as const) {
  lines.push(`  ${key}: [`)
  for (const m of knockoutStages[key]) lines.push(`    ${serializeKOMatch(m)},`)
  lines.push(`  ],`)
}
lines.push(`}`, ``)

if (raw.predictedChampion) lines.push(`export const predictedChampion = '${raw.predictedChampion}'`)
if (raw.predictedThirdPlaceWinner) lines.push(`export const predictedThirdPlaceWinner = '${raw.predictedThirdPlaceWinner}'`)
if (raw.predictedR16Teams?.length) lines.push(`export const predictedR16Teams = [${raw.predictedR16Teams.map((t: string) => `'${t}'`).join(', ')}]`)
if (raw.predictedQFTeams?.length) lines.push(`export const predictedQFTeams = [${raw.predictedQFTeams.map((t: string) => `'${t}'`).join(', ')}]`)
if (raw.predictedSFTeams?.length) lines.push(`export const predictedSFTeams = [${raw.predictedSFTeams.map((t: string) => `'${t}'`).join(', ')}]`)
if (raw.predictedFinalTeams?.length) lines.push(`export const predictedFinalTeams = [${raw.predictedFinalTeams.map((t: string) => `'${t}'`).join(', ')}]`)
lines.push(``)

const outputPath = resolve(`src/users/${outputSlug}.ts`)
writeFileSync(outputPath, lines.join('\n'))
console.log(`Written: ${outputPath}`)
