import { isUnpredicted, type MatchScores } from '../../shared/types'
import type { User } from '../../users/index'
import { singleMatchPoints, singleMatchOutcome, type MatchOutcome } from '../../leaderboard/points'
import { compareScores } from './matchUtils'

export type ScoreFreqRow = {
  key: string
  score: MatchScores
  names: string[]
  count: number
  pct: number
  isLeader: boolean
  outcome: MatchOutcome | null
  pts: number | null
}

export type ScoreFrequency = {
  rows: ScoreFreqRow[]
  unpredicted: string[]
  recap: { exact: number; partial: number; miss: number }
}

// Pure model behind ScoreFrequencyTable: bucket users by their predicted
// scoreline, order the buckets, and — once a real result exists — attach each
// row's outcome/points and a tournament-wide exact/partial/miss recap.
export function buildScoreFrequency(
  matchId: string,
  users: User[],
  actualScore: MatchScores | null = null,
  // How to read a user's predicted score. Defaults to the flat predictions map;
  // knockout pages pass an orientation-corrected lookup so a bettor who had the
  // two teams reversed still groups under the real scoreline.
  scoreFor?: (u: User) => MatchScores | null | undefined,
): ScoreFrequency {
  const getScore = scoreFor ?? ((u: User) => u.predictions[matchId])
  // Group by the full predicted score, drawWinner included — so on a knockout
  // draw, "1-1 home on pens" and "1-1 away on pens" are distinct calls that
  // score differently. Group matches never carry a drawWinner, so the key
  // collapses to the plain scoreline there.
  const groups = new Map<string, { score: MatchScores; names: string[] }>()
  const unpredicted: string[] = []
  for (const u of users) {
    const p = getScore(u)
    if (!p || isUnpredicted(p)) { unpredicted.push(u.label); continue }
    const key = `${p.home}-${p.away}-${p.drawWinner ?? ''}`
    const g = groups.get(key) ?? { score: p, names: [] }
    g.names.push(u.label)
    groups.set(key, g)
  }
  unpredicted.sort((a, b) => a.localeCompare(b, 'he'))

  const total = [...groups.values()].reduce((s, g) => s + g.names.length, 0)
  const maxCount = Math.max(0, ...[...groups.values()].map(g => g.names.length))
  const rows: ScoreFreqRow[] = [...groups.entries()]
    .sort(([, a], [, b]) => compareScores(a.score.home!, a.score.away!, b.score.home!, b.score.away!))
    .map(([key, g]) => ({
      key,
      score: g.score,
      names: [...g.names].sort((a, b) => a.localeCompare(b, 'he')),
      count: g.names.length,
      pct: Math.round((g.names.length / total) * 100),
      isLeader: g.names.length === maxCount,
      outcome: actualScore ? singleMatchOutcome(g.score, actualScore) : null,
      pts: actualScore ? singleMatchPoints(matchId, g.score, actualScore) : null,
    }))

  const recap = { exact: 0, partial: 0, miss: 0 }
  if (actualScore) {
    for (const r of rows) {
      if (r.outcome === 'tzelifa') recap.exact += r.count
      else if (r.outcome === 'pgiya') recap.partial += r.count
      else recap.miss += r.count
    }
  }

  return { rows, unpredicted, recap }
}
