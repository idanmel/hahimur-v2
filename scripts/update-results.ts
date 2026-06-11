import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { tournamentResults } from '../src/tournament-results.ts'
import { writeGroupScores } from './results-file.ts'

function parseDateKey(date: string): number {
  const [day, month] = date.split(' ')
  const monthNum: Record<string, number> = { 'ביוני': 6, 'ביולי': 7 }
  return (monthNum[month] ?? 0) * 100 + parseInt(day)
}

const unplayed = Object.values(tournamentResults.groupMatches)
  .flat()
  .filter(m => m.scores?.home == null)
  .sort((a, b) => parseDateKey(a.matchDate ?? '') - parseDateKey(b.matchDate ?? ''))

if (unplayed.length === 0) {
  console.log('All group matches have been played.')
  process.exit(0)
}

const currentScores: Record<string, { home: number; away: number }> = {}
for (const matches of Object.values(tournamentResults.groupMatches)) {
  for (const m of matches) {
    if (m.scores?.home != null) {
      currentScores[m.id] = { home: m.scores.home as number, away: m.scores.away as number }
    }
  }
}

const rl = createInterface({ input: stdin, output: stdout })

for (let i = 0; i < unplayed.length; i++) {
  const match = unplayed[i]
  console.log(`\n${match.homeTeam} vs ${match.awayTeam} (Group ${match.id[0]}, ${match.matchDate})`)

  const homeStr = await rl.question(`  ${match.homeTeam}: `)
  const awayStr = await rl.question(`  ${match.awayTeam}: `)

  const home = parseInt(homeStr.trim())
  const away = parseInt(awayStr.trim())

  if (isNaN(home) || isNaN(away)) {
    console.log('  Invalid input, stopping.')
    break
  }

  currentScores[match.id] = { home, away }
  writeGroupScores(currentScores)
  console.log('  ✓ Saved')

  if (i < unplayed.length - 1) {
    const cont = await rl.question('  Continue? (y/n): ')
    if (cont.trim().toLowerCase() !== 'y') break
  }
}

rl.close()
