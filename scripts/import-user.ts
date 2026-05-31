import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import type { Standing, ThirdPlaceStanding, ThirdPlaceQualification, KnockoutStages, KnockoutMatch, GroupMatch } from '../src/shared/types'

const [inputPath, outputSlug] = process.argv.slice(2)

if (!inputPath || !outputSlug) {
  console.error('Usage: node --experimental-strip-types scripts/import-user.ts <input.json> <output-slug>')
  console.error('Example: node --experimental-strip-types scripts/import-user.ts exports/idan.json idan-melamed')
  process.exit(1)
}

const raw = JSON.parse(readFileSync(resolve(inputPath), 'utf8'))

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

lines.push(`export const topGoalscorer = '${raw.topGoalscorer ?? ''}'`)
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

const thirdPlaceTeams: ThirdPlaceStanding[] = raw.thirdPlaceTeams
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
