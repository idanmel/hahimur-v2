import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { resolve } from 'path'
import { GROUPS } from '../src/shared/groups.ts'

const [inputPath, outputSlug, userName, userNumber] = process.argv.slice(2)

if (!inputPath || !outputSlug) {
  console.error('Usage: node --experimental-strip-types scripts/import-predictions.ts <input-json> <output-slug> [name] [number]')
  console.error('Example: node --experimental-strip-types scripts/import-predictions.ts raw_exports/idan-wc2026-predictions.json idan-melamed "עידן מלמד" 1')
  process.exit(1)
}

const KNOCKOUT_SECTIONS = [
  { ids: ['73','74','75','76','77','78','79','80','81','82','83','84','85','86','87','88'] },
  { ids: ['89','90','91','92','93','94','95','96'] },
  { ids: ['97','98','99','100'] },
  { ids: ['101','102'] },
  { ids: ['103'] },
  { ids: ['104'] },
]

function scoreEntry(id: string, score: { home: number; away: number; drawWinner?: string }) {
  const parts = [`home: ${score.home}, away: ${score.away}`]
  if (score.drawWinner) parts.push(`drawWinner: '${score.drawWinner}'`)
  const key = /^\d+$/.test(id) ? `'${id}'` : id
  return `  ${key}: { ${parts.join(', ')} }`
}

const raw = JSON.parse(readFileSync(resolve(inputPath), 'utf8'))
const { predictions, topGoalscorer } = raw

const lines = [
  `import type { PredictionsState } from '../shared/types'`,
  ``,
  `export const predictions: PredictionsState = {`,
]

for (const [, { matches }] of Object.entries(GROUPS)) {
  for (const { id } of matches) {
    const score = predictions[id]
    if (!score) throw new Error(`Missing prediction for match ${id}`)
    lines.push(`${scoreEntry(id, score)},`)
  }
  lines.push(``)
}

for (const { ids } of KNOCKOUT_SECTIONS) {
  for (const id of ids) {
    const score = predictions[id]
    if (!score) throw new Error(`Missing prediction for match ${id}`)
    lines.push(scoreEntry(id, score) + ',')
  }
}

lines.push(`}`)
lines.push(``)
lines.push(`export const topGoalscorer = '${topGoalscorer ?? ''}'`)
lines.push(`export const label = '${userName ?? ''}'`)
lines.push(`export const number = '${userNumber ?? ''}'`)
lines.push(``)

const outputPath = resolve(`src/users/${outputSlug}.ts`)
writeFileSync(outputPath, lines.join('\n'))
console.log(`Written: ${outputPath}`)

const usersDir = resolve('src/users')
const slugs = readdirSync(usersDir)
  .filter(f => f.endsWith('.ts') && f !== 'index.ts')
  .map(f => f.replace(/\.ts$/, ''))

const indexLines = [
  `import type { PredictionsState } from '../shared/types'`,
  ``,
  ...slugs.map(s => `import * as ${s.replace(/-/g, '_')} from './${s}'`),
  ``,
  `export interface User {`,
  `  label: string`,
  `  number: string`,
  `  predictions: PredictionsState`,
  `  topGoalscorer: string`,
  `}`,
  ``,
  `export const USERS: User[] = [`,
  ...slugs.map(s => `  ${s.replace(/-/g, '_')},`),
  `]`,
  ``,
]

const indexPath = resolve('src/users/index.ts')
writeFileSync(indexPath, indexLines.join('\n'))
console.log(`Written: ${indexPath}`)
