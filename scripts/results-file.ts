import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import type { MatchScores } from '../src/shared/types.ts'

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

export function parseRealGoals(content: string): Record<string, Record<string, number>> {
  const block = content.match(/const realGoals: Record<string, Record<string, number>> = \{([^]*?)\n\}/)
  const goals: Record<string, Record<string, number>> = {}
  for (const entry of (block?.[1] ?? '').matchAll(/'([^']+)': \{([^}]*)\}/g)) {
    const byMatch: Record<string, number> = {}
    for (const m of entry[2].matchAll(/(\w+): (\d+)/g)) byMatch[m[1]] = parseInt(m[2])
    goals[entry[1]] = byMatch
  }
  return goals
}

export function renderRealGoals(content: string, goals: Record<string, Record<string, number>>): string {
  const lines = Object.entries(goals)
    .map(([player, byMatch]) => {
      const entries = Object.entries(byMatch).map(([id, g]) => `${id}: ${g}`).join(', ')
      return `  '${player}': { ${entries} },`
    })
    .join('\n')
  return content.replace(
    /const realGoals: Record<string, Record<string, number>> = \{[^]*?\n\}/,
    lines
      ? `const realGoals: Record<string, Record<string, number>> = {\n${lines}\n}`
      : `const realGoals: Record<string, Record<string, number>> = {\n}`
  )
}

export function readRealGoals(): Record<string, Record<string, number>> {
  return parseRealGoals(readFileSync(RESULTS_PATH, 'utf-8'))
}

export function writeRealGoals(goals: Record<string, Record<string, number>>): void {
  const content = readFileSync(RESULTS_PATH, 'utf-8')
  writeFileSync(RESULTS_PATH, renderRealGoals(content, goals), 'utf-8')
}

// Knockout scores are the regulation (90') score, keyed by matchNum. drawWinner
// names the advancer when regulation ended level (ET/penalties decide who goes
// through) — the results-side mirror of a prediction's drawWinner.
export function parseKoScores(content: string): Record<string, MatchScores> {
  const block = content.match(/const koScores: Record<string, MatchScores> = \{([^]*?)\n\}/)
  const scores: Record<string, MatchScores> = {}
  for (const m of (block?.[1] ?? '').matchAll(
    /(\d+): \{ home: (\d+), away: (\d+)(?:, drawWinner: '(home|away)')? \}/g,
  )) {
    scores[m[1]] = { home: parseInt(m[2]), away: parseInt(m[3]) }
    if (m[4]) scores[m[1]].drawWinner = m[4] as 'home' | 'away'
  }
  return scores
}

export function renderKoScores(content: string, scores: Record<string, MatchScores>): string {
  const lines = Object.entries(scores)
    .map(([id, s]) => {
      const adv = s.drawWinner ? `, drawWinner: '${s.drawWinner}'` : ''
      return `  ${id}: { home: ${s.home}, away: ${s.away}${adv} },`
    })
    .join('\n')
  return content.replace(
    /const koScores: Record<string, MatchScores> = \{[^]*?\n\}/,
    lines
      ? `const koScores: Record<string, MatchScores> = {\n${lines}\n}`
      : `const koScores: Record<string, MatchScores> = {\n}`,
  )
}

export function readKoScores(): Record<string, MatchScores> {
  return parseKoScores(readFileSync(RESULTS_PATH, 'utf-8'))
}

export function writeKoScores(scores: Record<string, MatchScores>): void {
  const content = readFileSync(RESULTS_PATH, 'utf-8')
  writeFileSync(RESULTS_PATH, renderKoScores(content, scores), 'utf-8')
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
