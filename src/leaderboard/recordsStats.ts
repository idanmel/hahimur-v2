import { computeUserPoints, computeGroupTeamDetail, singleMatchOutcome } from './points'
import type { MatchOutcome } from './points'
import { computeUserCrossings } from './crossings'
import type { RoundKey } from './crossings'
import { rankTrajectories } from './leaderboardRows'
import { isUnpredicted } from '../shared/types'
import type { MatchScores, TournamentResults } from '../shared/types'
import { matchSortKey } from '../shared/matchOrder'
import { isPairing, orientPrediction, KO_ROUND_RANGES } from '../formView/knockout/koRounds'
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

const KO_ROUNDS = KO_ROUND_RANGES.map(r => r.key)

function knockoutOutcomes(user: User, results: TournamentResults): Outcomes {
  const acc: Outcomes = { tzelifot: 0, pgiot: 0 }
  for (const round of KO_ROUNDS) {
    const resultMatches = results.knockoutStages?.[round] ?? []
    const userMatches = user.knockoutStages?.[round] ?? []
    for (const rm of resultMatches) {
      if (!rm.scores || isUnpredicted(rm.scores) || !rm.home || !rm.away) continue
      const um = userMatches.find(m => isPairing(m, rm.home, rm.away))
      if (!um || !um.scores || isUnpredicted(um.scores)) continue
      tally(singleMatchOutcome(orientPrediction(um, rm)!, rm.scores), acc)
    }
  }
  return acc
}

// Every scored match the bettor engaged with, oldest first, reduced to just its
// outcome (צליפה / פגיעה / פספוס). Group matches all count — an unpredicted one
// reads as a פספוס — while knockout matches count only where the bettor predicted
// that pairing, mirroring how the group/knockout tallies above treat each stage.
// This ordered list is what the streak records read.
function outcomeTimeline(user: User, results: TournamentResults): MatchOutcome[] {
  const events: { key: number; outcome: MatchOutcome }[] = []

  for (const groupId of Object.keys(results.groupMatches)) {
    const userById: Record<string, MatchScores> = {}
    for (const m of user.groupMatches[groupId] ?? []) if (m.scores) userById[m.id] = m.scores
    for (const rm of results.groupMatches[groupId]) {
      if (!rm.scores || isUnpredicted(rm.scores)) continue
      events.push({
        key: matchSortKey(rm.matchDate, rm.kickoffIST),
        outcome: singleMatchOutcome(userById[rm.id] ?? { home: null, away: null }, rm.scores),
      })
    }
  }

  for (const round of KO_ROUNDS) {
    const resultMatches = results.knockoutStages?.[round] ?? []
    const userMatches = user.knockoutStages?.[round] ?? []
    for (const rm of resultMatches) {
      if (!rm.scores || isUnpredicted(rm.scores) || !rm.home || !rm.away) continue
      const um = userMatches.find(m => isPairing(m, rm.home, rm.away))
      if (!um || !um.scores || isUnpredicted(um.scores)) continue
      events.push({
        key: matchSortKey(rm.matchDate, rm.kickoffIST),
        outcome: singleMatchOutcome(orientPrediction(um, rm)!, rm.scores),
      })
    }
  }

  return events.sort((a, b) => a.key - b.key).map(e => e.outcome)
}

// The longest run of consecutive matches that satisfy `keep`, scanning the
// chronological timeline. Used both ways: a run of hits (פגיעה/צליפה) and a run
// of misses (the dry spell with neither).
export function longestRun(timeline: MatchOutcome[], keep: (o: MatchOutcome) => boolean): number {
  let best = 0, run = 0
  for (const o of timeline) {
    run = keep(o) ? run + 1 : 0
    if (run > best) best = run
  }
  return best
}

// The knockout rounds whose cross-bracket pairings count as "הצלבות". A locked
// crossing means both teams the bettor paired actually met in that slot.
const CROSSING_ROUNDS: RoundKey[] = ['r32', 'r16', 'qf', 'sf', 'final']

// How many cross-bracket pairings the bettor nailed. A locked crossing is one
// whose two teams have actually met in the slot — and, once the simulation's
// per-match pairing odds are passed in, also one the model makes inevitable
// (100%) even before its bracket slot is formally filled.
function crossingHits(
  user: User,
  results: TournamentResults,
  crossingProbByMatch: Record<number, Record<string, number>>,
): number {
  return CROSSING_ROUNDS.reduce((sum, round) => {
    const { locked } = computeUserCrossings(
      user.knockoutStages?.[round] ?? [],
      results.knockoutStages?.[round] ?? [],
      crossingProbByMatch,
    )
    return sum + locked.length
  }, 0)
}

// Everything we rank a bettor by, computed once per user so the record builder
// just reads fields and sorts.
export interface UserRecordStats {
  label: string
  tzelifot: number
  pgiot: number
  hits: number
  hitStreak: number
  missStreak: number
  olot: number
  mikumim: number
  crossings: number
  points: number
  climb: number
}

function userStats(
  user: User,
  results: TournamentResults,
  climb: number,
  crossingProbByMatch: Record<number, Record<string, number>>,
): UserRecordStats {
  const group = groupOutcomes(user, results)
  const ko = knockoutOutcomes(user, results)
  const detail = computeGroupTeamDetail(user, results)
  const timeline = outcomeTimeline(user, results)
  return {
    label: user.label,
    tzelifot: group.tzelifot + ko.tzelifot,
    pgiot: group.pgiot + ko.pgiot,
    hits: group.tzelifot + ko.tzelifot + group.pgiot + ko.pgiot,
    hitStreak: longestRun(timeline, o => o !== 'miss'),
    missStreak: longestRun(timeline, o => o === 'miss'),
    olot: detail.advancement.length,
    mikumim: detail.places.length,
    crossings: crossingHits(user, results, crossingProbByMatch),
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
  { key: 'hits',     title: 'שיא פגיעות + צליפות', emoji: '🎯', unit: 'סה״כ', blurb: 'הכי הרבה תוצאות נכונות בסך הכל — פגיעות וצליפות יחד', field: 'hits' },
  { key: 'hitStreak', title: 'שיא רצף פגיעות', emoji: '🔥', unit: 'ברצף', blurb: 'הרצף הארוך ביותר של משחקים עם פגיעה או צליפה', field: 'hitStreak' },
  { key: 'missStreak', title: 'שיא רצף יבש', emoji: '🧊', unit: 'ברצף', blurb: 'הרצף הארוך ביותר של משחקים רצופים בלי פגיעה או צליפה', field: 'missStreak' },
  { key: 'olot',     title: 'שיא עולות',   emoji: '⬆️', unit: 'עולות',  blurb: 'הכי הרבה קבוצות שנוחשו נכון לעלות מהבתים',   field: 'olot' },
  { key: 'mikumim',  title: 'שיא מיקומים', emoji: '📊', unit: 'מיקומים', blurb: 'הכי הרבה מיקומים מדויקים בטבלאות הבתים',    field: 'mikumim' },
  { key: 'crossings', title: 'שיא הצלבות', emoji: '🔀', unit: 'הצלבות', blurb: 'הכי הרבה הצלבות מדויקות — צמדי נוקאאוט שנוחשו נכון', field: 'crossings' },
  { key: 'climb',    title: 'שיא טיפוס',   emoji: '🚀', unit: 'מקומות', blurb: 'הזינוק הגדול ביותר בטבלה אחרי משחק בודד',    field: 'climb' },
]

// All the headline records, each already sorted with the leader first and zero
// scorers dropped, ready for the view to render as cards. `crossingProbByMatch`
// (from the win-prob simulation) lets 100%-certain knockout pairings count toward
// the crossings record before their bracket slot is formally filled; omit it and
// only formally-settled crossings count.
export function buildRecords(
  users: User[],
  results: TournamentResults,
  me?: string,
  crossingProbByMatch: Record<number, Record<string, number>> = {},
): RecordCategory[] {
  const trajectories = rankTrajectories(users, results)
  const stats = users.map(u => userStats(u, results, biggestClimb(trajectories[u.label] ?? []), crossingProbByMatch))

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
