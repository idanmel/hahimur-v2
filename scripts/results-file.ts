import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export const RESULTS_PATH = join(__dirname, '../src/tournament-results.ts')

export function readGroupScores(): Record<string, { home: number; away: number }> {
  const content = readFileSync(RESULTS_PATH, 'utf-8')
  const block = content.match(/const groupScores: Record<string, MatchScores> = \{([^]*?)\n\}/)
  const scores: Record<string, { home: number; away: number }> = {}
  for (const m of (block?.[1] ?? '').matchAll(/(\w+): \{ home: (\d+), away: (\d+) \}/g)) {
    scores[m[1]] = { home: parseInt(m[2]), away: parseInt(m[3]) }
  }
  return scores
}

export function writeGroupScores(scores: Record<string, { home: number; away: number }>): void {
  const lines = Object.entries(scores)
    .map(([id, s]) => `  ${id}: { home: ${s.home}, away: ${s.away} },`)
    .join('\n')
  const content = readFileSync(RESULTS_PATH, 'utf-8')
  const updated = content.replace(
    /const groupScores: Record<string, MatchScores> = \{[^]*?\n\}/,
    lines
      ? `const groupScores: Record<string, MatchScores> = {\n${lines}\n}`
      : `const groupScores: Record<string, MatchScores> = {\n}`
  )
  writeFileSync(RESULTS_PATH, updated, 'utf-8')
}
