import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { GROUPS } from '../src/shared/groups.ts'
import { RESULTS_PATH, readGroupScores, parseRealGoals, renderRealGoals } from './results-file.ts'

// Every distinct topGoalscorer pick, mapped to the team whose matches
// we need to ask about. Guarded by a test against src/users.
export const TRACKED_PLAYERS: Record<string, string> = {
  'קיליאן אמבפה': 'France',
  'הארי קיין': 'England',
  'קאי האברץ': 'Germany',
  'פלוריאן וירץ': 'Germany',
  'פראן טורס': 'Spain',
  'לאמין ימאל': 'Spain',
  'ויניסיוס ג׳וניור': 'Brazil',
}

const matchById = new Map(
  Object.values(GROUPS).flatMap(g => g.matches.map(m => [m.id, m]))
)

export function pendingScorerQuestions(
  scores: Record<string, { home: number; away: number }>,
  realGoals: Record<string, Record<string, number>>,
): { player: string; matchId: string }[] {
  const pending: { player: string; matchId: string }[] = []
  for (const matchId of Object.keys(scores)) {
    const match = matchById.get(matchId)
    if (!match) continue
    for (const [player, team] of Object.entries(TRACKED_PLAYERS)) {
      if ((match.homeTeam === team || match.awayTeam === team) && realGoals[player]?.[matchId] == null) {
        pending.push({ player, matchId })
      }
    }
  }
  return pending
}

async function main(): Promise<void> {
  const scores = readGroupScores()
  let goals = parseRealGoals(readFileSync(RESULTS_PATH, 'utf-8'))
  const pending = pendingScorerQuestions(scores, goals)

  if (pending.length === 0) {
    console.log('No pending scorer questions.')
    return
  }

  const rl = createInterface({ input: stdin, output: stdout })

  for (const q of pending) {
    const match = matchById.get(q.matchId)!
    const score = scores[q.matchId]
    const team = TRACKED_PLAYERS[q.player]
    const teamGoals = match.homeTeam === team ? score.home : score.away

    console.log(`\n${match.homeTeam} ${score.home}-${score.away} ${match.awayTeam} (${q.matchId})`)
    const answer = await rl.question(`  Goals by ${q.player} (${team}, scored ${teamGoals}): `)
    const n = parseInt(answer.trim())

    if (isNaN(n) || n < 0 || n > teamGoals) {
      console.log(`  Invalid (expected 0-${teamGoals}), stopping.`)
      break
    }

    goals = { ...goals, [q.player]: { ...goals[q.player], [q.matchId]: n } }
    writeFileSync(RESULTS_PATH, renderRealGoals(readFileSync(RESULTS_PATH, 'utf-8'), goals), 'utf-8')
    console.log('  ✓ Saved')
  }

  rl.close()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
