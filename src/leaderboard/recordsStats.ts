import { computeUserPoints, computeGroupTeamDetail, singleMatchOutcome } from './points'
import type { MatchOutcome, PointsBreakdown } from './points'
import { computeUserCrossings } from './crossings'
import type { RoundKey } from './crossings'
import { isUnpredicted } from '../shared/types'
import type { MatchScores, TournamentResults } from '../shared/types'
import { matchSortKey } from '../shared/matchOrder'
import { isPairing, orientPrediction, KO_ROUND_RANGES } from '../formView/knockout/koRounds'
import type { User } from '../users'

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

// One knockout round's צליפות/פגיעות for a bettor: every match in the round they
// called the pairing for (matched by team, either order) and where both the real
// and predicted scores are in, tallied by how the prediction scored.
function knockoutRoundOutcomes(user: User, results: TournamentResults, round: RoundKey): Outcomes {
  const acc: Outcomes = { tzelifot: 0, pgiot: 0 }
  const resultMatches = results.knockoutStages?.[round] ?? []
  const userMatches = user.knockoutStages?.[round] ?? []
  for (const rm of resultMatches) {
    if (!rm.scores || isUnpredicted(rm.scores) || !rm.home || !rm.away) continue
    const um = userMatches.find(m => isPairing(m, rm.home, rm.away))
    if (!um || !um.scores || isUnpredicted(um.scores)) continue
    tally(singleMatchOutcome(orientPrediction(um, rm)!, rm.scores), acc)
  }
  return acc
}

function knockoutOutcomes(user: User, results: TournamentResults): Outcomes {
  const acc: Outcomes = { tzelifot: 0, pgiot: 0 }
  for (const round of KO_ROUNDS) {
    const oc = knockoutRoundOutcomes(user, results, round)
    acc.tzelifot += oc.tzelifot
    acc.pgiot += oc.pgiot
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

// The cross-bracket pairings the bettor nailed in a single round: locked crossings
// (both teams have actually met in the slot) — and, once the simulation's per-match
// pairing odds are passed in, also ones the model makes inevitable (100%) even
// before the bracket slot is formally filled.
function roundCrossingHits(
  user: User,
  results: TournamentResults,
  round: RoundKey,
  crossingProbByMatch: Record<number, Record<string, number>>,
): number {
  const { locked } = computeUserCrossings(
    user.knockoutStages?.[round] ?? [],
    results.knockoutStages?.[round] ?? [],
    crossingProbByMatch,
  )
  return locked.length
}

// How many cross-bracket pairings the bettor nailed across every knockout round.
function crossingHits(
  user: User,
  results: TournamentResults,
  crossingProbByMatch: Record<number, Record<string, number>>,
): number {
  return CROSSING_ROUNDS.reduce((sum, round) => sum + roundCrossingHits(user, results, round, crossingProbByMatch), 0)
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
}

function userStats(
  user: User,
  results: TournamentResults,
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
  const stats = users.map(u => userStats(u, results, crossingProbByMatch))

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

// ---- per-knockout-stage records --------------------------------------------
// The cumulative records above cover the whole tournament; these crown a leader
// for each knockout stage *in isolation*, so once a round is done we can see who
// topped it on points, exact scores, correct results and matchups — a fresh race
// per stage as the bracket deepens.

// The knockout rounds that get their own records board, in bracket order, with
// the label the stage tabs show. Labels are self-contained here (not pulled from
// the crossings view) so records don't depend on that component.
const KO_STAGE_DEFS: { key: RoundKey; label: string }[] = [
  { key: 'r32',        label: 'שלב ה-32' },
  { key: 'r16',        label: 'שמינית הגמר' },
  { key: 'qf',         label: 'רבע הגמר' },
  { key: 'sf',         label: 'חצי הגמר' },
  { key: 'thirdPlace', label: 'המקום השלישי' },
  { key: 'final',      label: 'הגמר' },
]

// The record categories shown per stage — a focused subset of the cumulative
// ones (streaks/עולות/מיקומים/טיפוס are cross-stage or group-only, so they don't
// belong to a single knockout round).
type StageStatField = 'points' | 'tzelifot' | 'pgiot' | 'crossings'
const STAGE_CATEGORY_DEFS: { key: string; title: string; emoji: string; unit: string; blurb: string; field: StageStatField }[] = [
  { key: 'points',    title: 'שיא נקודות', emoji: '👑', unit: 'נק׳',    blurb: 'הכי הרבה נקודות שנצברו בשלב הזה',              field: 'points' },
  { key: 'tzelifot',  title: 'שיא צליפות', emoji: '🎯', unit: 'צליפות', blurb: 'הכי הרבה תוצאות מדויקות בשלב הזה',              field: 'tzelifot' },
  { key: 'pgiot',     title: 'שיא פגיעות', emoji: '✅', unit: 'פגיעות', blurb: 'הכי הרבה תוצאות נכונות בשלב הזה',               field: 'pgiot' },
  { key: 'crossings', title: 'שיא הצלבות', emoji: '🔀', unit: 'הצלבות', blurb: 'הכי הרבה צמדי נוקאאוט שנוחשו נכון בשלב הזה',    field: 'crossings' },
]

// Points earned in one knockout round, pulled from the same breakdown the
// leaderboard uses (the third-place match lives under `third`).
function roundPointsTotal(bd: PointsBreakdown, round: RoundKey): number {
  switch (round) {
    case 'r32':        return bd.r32.total
    case 'r16':        return bd.r16.total
    case 'qf':         return bd.qf.total
    case 'sf':         return bd.sf.total
    case 'thirdPlace': return bd.third.total
    case 'final':      return bd.final.total
  }
}

export interface StageRecords {
  key: RoundKey
  label: string
  categories: RecordCategory[]
}

// One records board per knockout stage that has begun (has at least one played
// match), each with the leader-first, zero-dropped categories the view renders.
// Empty stages (no match played yet) and empty categories are omitted, so the
// section grows naturally as the tournament advances. `crossingProbByMatch`
// mirrors buildRecords: it lets a 100%-certain matchup count before its slot is
// formally filled.
export function buildKnockoutStageRecords(
  users: User[],
  results: TournamentResults,
  me?: string,
  crossingProbByMatch: Record<number, Record<string, number>> = {},
): StageRecords[] {
  const stages: StageRecords[] = []
  for (const { key, label } of KO_STAGE_DEFS) {
    const resultMatches = results.knockoutStages?.[key] ?? []
    if (!resultMatches.some(m => m.scores && !isUnpredicted(m.scores))) continue // stage not started

    const stats = users.map(u => {
      const oc = knockoutRoundOutcomes(u, results, key)
      const bd = computeUserPoints(u, results)
      return {
        label: u.label,
        isMe: u.label === me,
        points: roundPointsTotal(bd, key),
        tzelifot: oc.tzelifot,
        pgiot: oc.pgiot,
        crossings: roundCrossingHits(u, results, key, crossingProbByMatch),
      }
    })

    const categories = STAGE_CATEGORY_DEFS.map(def => ({
      key: def.key,
      title: def.title,
      emoji: def.emoji,
      unit: def.unit,
      blurb: def.blurb,
      entries: stats
        .map(s => ({ label: s.label, value: s[def.field], isMe: s.isMe }))
        .filter(e => e.value > 0)
        .sort((a, b) => b.value - a.value),
    })).filter(c => c.entries.length > 0)

    if (categories.length > 0) stages.push({ key, label, categories })
  }
  return stages
}
