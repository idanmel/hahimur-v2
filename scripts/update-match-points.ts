import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tournamentResults } from '../src/tournament-results.ts'
import { USERS } from '../src/users/index.ts'
import { singleMatchPoints } from '../src/leaderboard/points.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const USERS_DIR = join(__dirname, '../src/users')

function parseDateKey(date: string): number {
  const [day, month] = date.split(' ')
  const monthNum: Record<string, number> = { 'ביוני': 6, 'ביולי': 7 }
  return (monthNum[month] ?? 0) * 100 + parseInt(day)
}

const playedMatches = Object.values(tournamentResults.groupMatches)
  .flat()
  .filter(m => m.scores?.home != null)
  .sort((a, b) => parseDateKey(a.matchDate ?? '') - parseDateKey(b.matchDate ?? ''))

if (playedMatches.length === 0) {
  console.log('No matches played yet.')
  process.exit(0)
}

const userFiles = readdirSync(USERS_DIR)
  .filter(f => f.endsWith('.ts') && f !== 'index.ts')

for (const fileName of userFiles) {
  const filePath = join(USERS_DIR, fileName)
  const fileContent = readFileSync(filePath, 'utf-8')

  const labelMatch = fileContent.match(/export const label = '([^']+)'/)
  if (!labelMatch) continue
  const label = labelMatch[1]

  const user = USERS.find(u => u.label === label)
  if (!user) continue

  const points = playedMatches.map(resultMatch => {
    const groupId = resultMatch.id[0]
    const userMatch = user.groupMatches[groupId]?.find(m => m.id === resultMatch.id)
    if (!userMatch?.scores || !resultMatch.scores) return { matchId: resultMatch.id, points: 0 }
    return {
      matchId: resultMatch.id,
      points: singleMatchPoints(resultMatch.id, userMatch.scores, resultMatch.scores),
    }
  })

  const lines = points.map(p => `  { matchId: '${p.matchId}', points: ${p.points} },`).join('\n')
  const newExport = `\nexport const matchPoints: Array<{ matchId: string; points: number }> = [\n${lines}\n]\n`

  const updated = fileContent.replace(/\nexport const matchPoints[\s\S]*$/, '') + newExport
  writeFileSync(filePath, updated, 'utf-8')

  const total = points.reduce((s, p) => s + p.points, 0)
  console.log(`${label}: ${points.length} matches, ${total} pts`)
}
