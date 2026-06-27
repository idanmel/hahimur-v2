import { computeUserPoints, computeGroupTeamDetail, singleMatchOutcome } from './points'
import { rankTrajectories } from './leaderboardRows'
import { isUnpredicted } from '../shared/types'
import type { KnockoutMatch, MatchScores, TournamentResults } from '../shared/types'
import type { User } from '../users'

// The biggest single-game leap up the standings: ranks are 1-based and listed
// chronologically, so a climb is the previous rank minus the next one. Returns 0
// when there's no movement to read (fewer than two snapshots) or only drops.
export function biggestClimb(ranks: number[]): number {
  let best = 0
  for (let i = 1; i < ranks.length; i++) {
    best = Math.max(best, ranks[i - 1] - ranks[i])
  }
  return best
}

interface Outcomes { tzelifot: number; pgiot: number }

function tally(outcome: ReturnType<typeof singleMatchOutcome>, acc: Outcomes): void {
  if (outcome === 'tzelifa') acc.tzelifot++
  else if (outcome === 'pgiya') acc.pgiot++
}

function groupOutcomes(user: User, results: TournamentResults): Outcomes {
  const acc: Outcomes = { tzelifot: 0, pgiot: 0 }
  for (const groupId of Object.keys(results.groupMatches)) {
    const userById: Record<string, MatchScores> = {}
    for (const m of user.groupMatches[groupId] ?? []) if (m.scores) userById[m.id] = m.scores
    for (const rm of results.groupMatches[groupId]) {
      if (!rm.scores || isUnpredicted(rm.scores)) continue
      tally(singleMatchOutcome(userById[rm.id] ?? { home: null, away: null }, rm.scores), acc)
    }
  }
  return acc
}

const KO_ROUNDS = ['r32', 'r16', 'qf', 'sf', 'thirdPlace', 'final'] as const

// Orient a bettor's knockout prediction to the actual fixture's home/away sides,
// flipping the scoreline (and drawWinner) when they listed the teams reversed.
function orientPrediction(userMatch: KnockoutMatch, resultMatch: KnockoutMatch): MatchScores {
  const flipped = userMatch.home === resultMatch.away
  if (!flipped) return userMatch.scores!
  const { home, away, drawWinner } = userMatch.scores!
  return { home: away, away: home, drawWinner: drawWinner === 'home' ? 'away' : drawWinner === 'away' ? 'home' : undefined }
}

function knockoutOutcomes(user: User, results: TournamentResults): Outcomes {
  const acc: Outcomes = { tzelifot: 0, pgiot: 0 }
  for (const round of KO_ROUNDS) {
    const resultMatches = results.knockoutStages?.[round] ?? []
    const userMatches = user.knockoutStages?.[round] ?? []
    for (const rm of resultMatches) {
      if (!rm.scores || isUnpredicted(rm.scores) || !rm.home || !rm.away) continue
      const um = userMatches.find(m =>
        m.home && m.away &&
        ((m.home === rm.home && m.away === rm.away) || (m.home === rm.away && m.away === rm.home)),
      )
      if (!um || !um.scores || isUnpredicted(um.scores)) continue
      tally(singleMatchOutcome(orientPrediction(um, rm), rm.scores), acc)
    }
  }
  return acc
}

// Everything we rank a bettor by, computed once per user so the record builder
// just reads fields and sorts.
export interface UserRecordStats {
  label: string
  tzelifot: number
  pgiot: number
  olot: number
  mikumim: number
  points: number
  climb: number
}

function userStats(user: User, results: TournamentResults, climb: number): UserRecordStats {
  const group = groupOutcomes(user, results)
  const ko = knockoutOutcomes(user, results)
  const detail = computeGroupTeamDetail(user, results)
  return {
    label: user.label,
    tzelifot: group.tzelifot + ko.tzelifot,
    pgiot: group.pgiot + ko.pgiot,
    olot: detail.advancement.length,
    mikumim: detail.places.length,
    points: computeUserPoints(user, results).total,
    climb,
  }
}

export interface RecordEntry {
  label: string
  value: number
  isMe: boolean
}

export interface RecordCategory {
  key: string
  title: string
  emoji: string
  unit: string
  blurb: string
  // Every bettor with a non-zero value, highest first.
  entries: RecordEntry[]
}

type CatDef = { key: string; title: string; emoji: string; unit: string; blurb: string; field: keyof UserRecordStats }

const CATEGORY_DEFS: CatDef[] = [
  { key: 'points',   title: 'שיא נקודות',  emoji: '👑', unit: 'נק׳',    blurb: 'הניקוד הכולל הגבוה ביותר בטורניר',          field: 'points' },
  { key: 'tzelifot', title: 'שיא צליפות',  emoji: '🎯', unit: 'צליפות', blurb: 'הכי הרבה תוצאות מדויקות לאורך הטורניר',      field: 'tzelifot' },
  { key: 'pgiot',    title: 'שיא פגיעות',  emoji: '✅', unit: 'פגיעות', blurb: 'הכי הרבה תוצאות נכונות (מנצחת או תיקו)',     field: 'pgiot' },
  { key: 'olot',     title: 'שיא עולות',   emoji: '⬆️', unit: 'עולות',  blurb: 'הכי הרבה קבוצות שנוחשו נכון לעלות מהבתים',   field: 'olot' },
  { key: 'mikumim',  title: 'שיא מיקומים', emoji: '📊', unit: 'מיקומים', blurb: 'הכי הרבה מיקומים מדויקים בטבלאות הבתים',    field: 'mikumim' },
  { key: 'climb',    title: 'שיא טיפוס',   emoji: '🚀', unit: 'מקומות', blurb: 'הזינוק הגדול ביותר בטבלה אחרי משחק בודד',    field: 'climb' },
]

// All the headline records, each already sorted with the leader first and zero
// scorers dropped, ready for the view to render as cards.
export function buildRecords(users: User[], results: TournamentResults, me?: string): RecordCategory[] {
  const trajectories = rankTrajectories(users, results)
  const stats = users.map(u => userStats(u, results, biggestClimb(trajectories[u.label] ?? [])))

  return CATEGORY_DEFS.map(def => ({
    key: def.key,
    title: def.title,
    emoji: def.emoji,
    unit: def.unit,
    blurb: def.blurb,
    entries: stats
      .map(s => ({ label: s.label, value: s[def.field] as number, isMe: s.label === me }))
      .filter(e => e.value > 0)
      .sort((a, b) => b.value - a.value),
  }))
}
