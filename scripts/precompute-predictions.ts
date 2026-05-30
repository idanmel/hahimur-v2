import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { GROUPS } from '../src/shared/groups.ts'
import { calculateStandings } from '../src/shared/standings.ts'
import { getThirdPlaceTeams, qualifyBestThirdPlace } from '../src/formView/thirdPlace/thirdPlace.ts'
import { buildKnockoutBracket } from '../src/formView/knockout/knockout.ts'
import type { Standing, ThirdPlaceStanding, KnockoutMatch, KnockoutStages, GroupMatch, PredictionsState } from '../src/shared/types'

const [inputPath, outputSlug, userName] = process.argv.slice(2)

if (!inputPath || !outputSlug) {
  console.error('Usage: node --experimental-strip-types scripts/precompute-predictions.ts <input.json> <output-slug> [name]')
  console.error('Example: node --experimental-strip-types scripts/precompute-predictions.ts raw_exports/idan-wc2026-predictions.json idan-melamed "עידן מלמד"')
  process.exit(1)
}

const raw = JSON.parse(readFileSync(resolve(inputPath), 'utf8'))
const predictions: PredictionsState = raw.predictions

// --- compute ---

const groupTables: Record<string, Standing[]> = {}
for (const [letter, { matches }] of Object.entries(GROUPS)) {
  const { standings } = calculateStandings(matches, predictions)
  groupTables[letter] = standings
}

const groupMatches: Record<string, GroupMatch[]> = {}
for (const [letter, { matches }] of Object.entries(GROUPS)) {
  groupMatches[letter] = matches.map(m => {
    const pred = predictions[m.id]
    const gm: GroupMatch = { ...m }
    if (pred && pred.home !== null && pred.away !== null) gm.scores = pred
    return gm
  })
}

const groupStandings = Object.entries(groupTables).map(([group, standings]) => ({ group, standings }))
const thirdPlaceTeams = getThirdPlaceTeams(groupStandings)
const thirdPlaceQualification = qualifyBestThirdPlace(thirdPlaceTeams)
const knockoutBracket = buildKnockoutBracket(predictions)

function bracketWinner(matchNum: number): string | undefined {
  const m = knockoutBracket.find(b => b.matchNum === matchNum)
  if (!m || !m.home || !m.away) return undefined
  const pred = predictions[String(matchNum)]
  if (!pred || pred.home === null || pred.away === null) return undefined
  if (pred.home > pred.away) return m.home
  if (pred.away > pred.home) return m.away
  if (pred.drawWinner === 'home') return m.home
  if (pred.drawWinner === 'away') return m.away
  return undefined
}

const predictedChampion = bracketWinner(104)
const predictedThirdPlaceWinner = bracketWinner(103)

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
  const s = predictions[String(m.matchNum)]
  const fields: string[] = [`matchNum: ${m.matchNum}`, `home: '${m.home}'`, `away: '${m.away}'`, `resolved: ${m.resolved}`]
  if (s && s.home !== null && s.away !== null) {
    let scores = `{ home: ${s.home}, away: ${s.away}`
    if (s.drawWinner) scores += `, drawWinner: '${s.drawWinner}'`
    scores += ' }'
    fields.push(`scores: ${scores}`)
  }
  if (m.matchDate) fields.push(`matchDate: '${m.matchDate}'`)
  if (m.kickoffIST) fields.push(`kickoffIST: '${m.kickoffIST}'`)
  return `  { ${fields.join(', ')} }`
}

// --- build file ---

const lines: string[] = [
  `import type { PredictionsState, Standing, ThirdPlaceStanding, ThirdPlaceQualification, KnockoutMatch, KnockoutStages, GroupMatch } from '../shared/types'`,
  ``,
  `export const predictions: PredictionsState = {`,
]

const koIds = [
  ...Array.from({ length: 16 }, (_, i) => String(73 + i)),
  ...Array.from({ length: 8 },  (_, i) => String(89 + i)),
  ...Array.from({ length: 4 },  (_, i) => String(97 + i)),
  '101', '102', '103', '104',
]

for (const [, { matches }] of Object.entries(GROUPS)) {
  for (const { id } of matches) {
    const s = predictions[id]
    if (!s) throw new Error(`Missing prediction for group match ${id}`)
    lines.push(`  ${id}: { home: ${s.home}, away: ${s.away} },`)
  }
  lines.push(``)
}
for (const id of koIds) {
  const s = predictions[id]
  if (!s) throw new Error(`Missing prediction for knockout match ${id}`)
  const parts = [`home: ${s.home}, away: ${s.away}`]
  if (s.drawWinner) parts.push(`drawWinner: '${s.drawWinner}'`)
  lines.push(`  '${id}': { ${parts.join(', ')} },`)
}
lines.push(`}`, ``)

lines.push(`export const topGoalscorer = '${raw.topGoalscorer ?? ''}'`)
lines.push(`export const label = '${userName ?? ''}'`)
lines.push(``)

lines.push(`export const groupMatches: Record<string, GroupMatch[]> = {`)
for (const [letter, matches] of Object.entries(groupMatches)) {
  lines.push(`  ${letter}: [`)
  for (const m of matches) lines.push(`${serializeGroupMatch(m)},`)
  lines.push(`  ],`)
}
lines.push(`}`, ``)

lines.push(`export const groupTables: Record<string, Standing[]> = {`)
for (const [letter, standings] of Object.entries(groupTables)) {
  lines.push(`  ${letter}: [`)
  for (const s of standings) lines.push(`${serializeStanding(s)},`)
  lines.push(`  ],`)
}
lines.push(`}`, ``)

lines.push(`export const thirdPlaceTeams: ThirdPlaceStanding[] = [`)
for (const s of thirdPlaceTeams) lines.push(`${serializeThirdPlaceStanding(s)},`)
lines.push(`]`, ``)

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

const knockoutStages: KnockoutStages = {
  r32:        knockoutBracket.filter(m => m.matchNum >= 73  && m.matchNum <= 88),
  r16:        knockoutBracket.filter(m => m.matchNum >= 89  && m.matchNum <= 96),
  qf:         knockoutBracket.filter(m => m.matchNum >= 97  && m.matchNum <= 100),
  sf:         knockoutBracket.filter(m => m.matchNum >= 101 && m.matchNum <= 102),
  thirdPlace: knockoutBracket.filter(m => m.matchNum === 103),
  final:      knockoutBracket.filter(m => m.matchNum === 104),
}

function serializeKOStage(matches: KnockoutMatch[]): string[] {
  return matches.map(m => `    ${serializeKOMatch(m)},`)
}

lines.push(`export const knockoutStages: KnockoutStages = {`)
lines.push(`  r32: [`)
lines.push(...serializeKOStage(knockoutStages.r32))
lines.push(`  ],`)
lines.push(`  r16: [`)
lines.push(...serializeKOStage(knockoutStages.r16))
lines.push(`  ],`)
lines.push(`  qf: [`)
lines.push(...serializeKOStage(knockoutStages.qf))
lines.push(`  ],`)
lines.push(`  sf: [`)
lines.push(...serializeKOStage(knockoutStages.sf))
lines.push(`  ],`)
lines.push(`  thirdPlace: [`)
lines.push(...serializeKOStage(knockoutStages.thirdPlace))
lines.push(`  ],`)
lines.push(`  final: [`)
lines.push(...serializeKOStage(knockoutStages.final))
lines.push(`  ],`)
lines.push(`}`, ``)

if (predictedChampion !== undefined) lines.push(`export const predictedChampion = '${predictedChampion}'`)
if (predictedThirdPlaceWinner !== undefined) lines.push(`export const predictedThirdPlaceWinner = '${predictedThirdPlaceWinner}'`)
if (predictedChampion !== undefined || predictedThirdPlaceWinner !== undefined) lines.push(``)

const outputPath = resolve(`src/users/${outputSlug}.ts`)
writeFileSync(outputPath, lines.join('\n'))
console.log(`Written: ${outputPath}`)
