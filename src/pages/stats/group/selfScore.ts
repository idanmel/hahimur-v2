// The deterministic, group-only "what's best for me" engine shared by the match
// card and the group stats page. It looks at *your bet only* — no other players,
// no Monte-Carlo, no knockout simulation. For any candidate result it scores the
// points you'd earn from this group: your scoreline (צליפה/פגיעה), your exact
// standings order (goal-difference aware) and your advancers (top-2 and, when it
// applies, a best-third pick). Same input ⇒ same output, every time.
import type { MatchScores, PredictionsState, Standing } from '../../../shared/types'
import type { User } from '../../../users'
import { GROUP_MATCHES, ALL_GROUP_LETTERS, TEAMS } from '../../../shared/groups'
import { calculateStandings, goalDifference } from '../../../shared/standings'
import { singleMatchPoints, PLACE_POINT, OLEH_POINTS } from '../../../leaderboard/points'

export type Want = 'home' | 'draw' | 'away'

export const he = (team: string) => TEAMS[team]?.he ?? team

const QUALIFY_COUNT = 8
const TOTAL_GROUPS = ALL_GROUP_LETTERS.length

export function dir(s?: MatchScores): Want | null {
  if (!s || s.home == null || s.away == null) return null
  if (s.home > s.away) return 'home'
  if (s.away > s.home) return 'away'
  return 'draw'
}

// The scoreline we feed the model for a wanted direction. When your own
// prediction already points that way we reuse it, so the scenario doubles as your
// צליפה target; otherwise a minimal canonical margin.
export function repScore(want: Want, pred?: MatchScores): MatchScores {
  if (pred && dir(pred) === want) return { home: pred.home, away: pred.away }
  if (want === 'home') return { home: 1, away: 0 }
  if (want === 'away') return { home: 0, away: 1 }
  return { home: 1, away: 1 }
}

export function groupTeams(groupLetter: string): string[] {
  const set = new Set<string>()
  for (const m of GROUP_MATCHES[groupLetter] ?? []) { set.add(m.homeTeam); set.add(m.awayTeam) }
  return [...set]
}

// The final order of a group is fully determined once its own matches are fixed
// (real + the candidate's representative scorelines), so we read it off a plain
// standings calc rather than any simulation.
export function groupOrder(groupLetter: string, state: PredictionsState): string[] {
  return calculateStandings(GROUP_MATCHES[groupLetter] ?? [], state).standings.map(s => s.team)
}

// Your own predicted final order for the group. Place points are scored against
// your explicit standings bet (groupTables), so that's the target; fall back to
// the order implied by your scores if it's unset.
export function selfPredictedOrder(user: User, groupLetter: string): string[] {
  const tbl = user.groupTables[groupLetter]
  if (tbl && tbl.length) return tbl.map(s => s.team)
  return groupOrder(groupLetter, user.predictions)
}

// The team (if any) you bet to advance from THIS group as one of the best thirds.
function thirdAdvancerPick(user: User, groupLetter: string): string | undefined {
  if (!user.thirdPlaceQualification.resolved) return undefined
  return user.thirdPlaceQualification.qualifiers.find(q => q.group === groupLetter)?.team
}

// 'in'   = clinched among the 8 best thirds (can't be pushed out by the groups
//          that haven't closed yet)
// 'out'  = already behind 8 other thirds — mathematically can't advance as a third
// 'open' = still undecided; depends on groups that haven't finished
export type ThirdStatus = 'in' | 'open' | 'out'

export interface ThirdLine { points: number; gd: number; gf: number }

function lineOf(s: Standing): ThirdLine {
  return { points: s.points, gd: goalDifference(s), gf: s.goalsFor }
}

// Same comparison qualifyBestThirdPlace uses: points, then overall GD, then goals.
function betterThird(a: ThirdLine, b: ThirdLine): boolean {
  if (a.points !== b.points) return a.points > b.points
  if (a.gd !== b.gd) return a.gd > b.gd
  return a.gf > b.gf
}

// Final 3rd-place lines of the OTHER groups that are fully settled for real.
// Unfinished groups are deliberately excluded — we never guess how they'll end,
// so the best-third outlook only sharpens as real groups close.
function settledOtherThirds(targetGroup: string, settled: PredictionsState): ThirdLine[] {
  const lines: ThirdLine[] = []
  for (const g of ALL_GROUP_LETTERS) {
    if (g === targetGroup) continue
    const matches = GROUP_MATCHES[g] ?? []
    const allPlayed = matches.length > 0 && matches.every(m => settled[m.id])
    if (!allPlayed) continue
    const st = calculateStandings(matches, settled).standings
    if (st.length >= 3) lines.push(lineOf(st[2]))
  }
  return lines
}

// Everything about the best-third race that doesn't change between this group's
// candidate outcomes — computed once per recommendation, not per scenario.
export interface ThirdField {
  otherThirds: ThirdLine[]
  unknownOthers: number   // other groups whose final 3rd-place line is unknown
}

function buildThirdField(targetGroup: string, settled: PredictionsState): ThirdField {
  const otherThirds = settledOtherThirds(targetGroup, settled)
  return { otherThirds, unknownOthers: (TOTAL_GROUPS - 1) - otherThirds.length }
}

export function thirdPlaceOutlook(line: ThirdLine, field: ThirdField): ThirdStatus {
  const aheadNow = field.otherThirds.filter(o => betterThird(o, line)).length
  if (aheadNow >= QUALIFY_COUNT) return 'out'
  if (aheadNow + field.unknownOthers < QUALIFY_COUNT) return 'in'
  return 'open'
}

// All the per-recommendation context that's constant across candidate scenarios.
export interface SelfScoreContext {
  groupLetter: string
  predOrder: string[]
  predAdvancers: string[]   // teams you bet to reach the next round from this group
  thirdPick?: string
  field: ThirdField
}

export function buildContext(user: User, groupLetter: string, settled: PredictionsState): SelfScoreContext {
  const predOrder = selfPredictedOrder(user, groupLetter)
  const thirdPick = thirdAdvancerPick(user, groupLetter)
  const top2 = (user.groupTables[groupLetter] ?? []).slice(0, 2).map(s => s.team)
  const fallbackTop2 = top2.length ? top2 : predOrder.slice(0, 2)
  const predAdvancers = [...new Set([...fallbackTop2, ...(thirdPick ? [thirdPick] : [])])]
  return { groupLetter, predOrder, predAdvancers, thirdPick, field: buildThirdField(groupLetter, settled) }
}

export interface GroupScore {
  matchPoints: number
  placePoints: number
  advPoints: number
  total: number
  order: string[]
  // Which of your predicted advancers actually reach the next round here, so the
  // UI can name the team whose advancement a result wins or costs you.
  advancers: string[]
  // The at-risk best-third pick and its outlook, present only when that pick
  // lands exactly 3rd in this scenario — so the UI can explain the judgment.
  thirdPick?: string
  thirdStatus?: ThirdStatus
  thirdPoints?: number       // tiebreak hint: more points = a safer third
}

// 1st → 'ראשון', 2nd → 'שני', etc. — for naming the exact slot a result locks in.
export const SLOT_WORD = ['ראשון', 'שני', 'שלישי', 'רביעי']

// The teams whose slot matches your predicted order in `order` but NOT in `ref` —
// i.e. the exact placements this scenario gets right that the reference doesn't.
export function slotsWon(order: string[], ref: string[], predOrder: string[]): { team: string; slot: number }[] {
  const out: { team: string; slot: number }[] = []
  for (let i = 0; i < predOrder.length; i++) {
    if (order[i] === predOrder[i] && ref[i] !== predOrder[i]) out.push({ team: predOrder[i], slot: i })
  }
  return out
}

export function describeSlots(items: { team: string; slot: number }[]): string {
  return items.map(it => `${he(it.team)} במקום ה${SLOT_WORD[it.slot]}`).join(' ו')
}

export function listTeams(teams: string[]): string {
  return teams.map(he).join(' ו')
}

// Score one fully-specified group state (every group match has a scoreline:
// real where settled, representative where hypothetical) purely on *your* bet.
export function scoreGroupOutcome(user: User, ctx: SelfScoreContext, state: PredictionsState): GroupScore {
  const { groupLetter, predOrder, predAdvancers, thirdPick, field } = ctx
  const matches = GROUP_MATCHES[groupLetter] ?? []
  const standings = calculateStandings(matches, state).standings
  const order = standings.map(s => s.team)
  const pos = new Map(order.map((t, i) => [t, i]))

  let matchPoints = 0
  for (const m of matches) {
    const pred = user.predictions[m.id]
    const actual = state[m.id]
    if (pred && actual && actual.home != null && actual.away != null) {
      matchPoints += singleMatchPoints(m.id, pred, actual)
    }
  }

  let placePoints = 0
  for (let i = 0; i < order.length; i++) if (order[i] === predOrder[i]) placePoints += PLACE_POINT

  let advPoints = 0
  const advancers: string[] = []
  let thirdStatus: ThirdStatus | undefined
  let thirdPoints: number | undefined
  for (const team of predAdvancers) {
    const p = pos.get(team)
    if (p == null) continue
    if (p < 2) { advPoints += OLEH_POINTS.group; advancers.push(team); continue }
    if (p === 2) {
      const status = thirdPlaceOutlook(lineOf(standings[2]), field)
      if (team === thirdPick) { thirdStatus = status; thirdPoints = standings[2].points }
      // 'in'/'open' both count toward the bet (open = still alive); only a
      // mathematically-out third is dropped.
      if (status !== 'out') { advPoints += OLEH_POINTS.group; advancers.push(team) }
    }
  }

  return {
    matchPoints, placePoints, advPoints,
    total: matchPoints + placePoints + advPoints,
    order, advancers, thirdPick, thirdStatus, thirdPoints,
  }
}
