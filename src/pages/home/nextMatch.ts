import type { GroupMatch, KnockoutMatch } from '../../shared/types'
import type { User } from '../../users/index'
import { tournamentResults } from '../../tournament-results'
import { kickoffDate, MATCH_WINDOW_MS } from '../../shared/matchOrder'
import { scoreFrequencies } from '../match/matchUtils'
import { allKO } from '../../formView/knockout/koRounds'
import { roundLabel } from '../match/koMatch'
import { knockoutParticipantScore } from '../match/koParticipants'

// Group-stage matches only for now: knockout fixtures have a different shape
// (matchNum, unresolved team slots) and their own resolution logic.
//
// The home page shows a 15-hour burst of matches rather than a fixed count: it
// anchors on the closest match and includes every match within 15h of it. This
// keeps a day's fixtures together even across midnight — a 23:00 match and the
// 02:00 one three hours later belong to the same burst, which calendar-date
// grouping would wrongly split — while a match a full day away stays out.
const WINDOW_MS = 15 * 60 * 60 * 1000

// The default match pool the home-page cards select from: every group match,
// carrying whatever scores have been recorded so far.
export const SCORED_MATCHES = Object.values(tournamentResults.groupMatches).flat()

// The default knockout pool: every knockout fixture across all rounds, carrying
// whatever score/teams have resolved so far. Unresolved fixtures (teams not yet
// decided) carry placeholder slots and are kept out of the feed by upcomingCards.
export const KO_FEED_MATCHES = allKO(tournamentResults.knockoutStages)

type Timed = { m: GroupMatch; kickoff: number }

// Pairs each match with its kickoff instant, dropping any without a parseable date.
function timed(matches: GroupMatch[]): Timed[] {
  return matches
    .map(m => ({ m, kickoff: kickoffDate(m.matchDate, m.kickoffIST)?.getTime() }))
    .filter((x): x is Timed => x.kickoff !== undefined)
}

// A match is settled once it has a final score recorded.
function hasFinalScore(m: GroupMatch): boolean {
  return m.scores?.home != null && m.scores?.away != null
}

// Every upcoming match within 15h of the closest one, in chronological order,
// so the home page shows the coming burst of fixtures. A started match still
// counts until its score is in.
export function nextMatches(matches: GroupMatch[], now: Date): GroupMatch[] {
  const upcoming = timed(matches)
    .filter(x => !hasFinalScore(x.m) && now.getTime() < x.kickoff + MATCH_WINDOW_MS)
    .sort((a, b) => a.kickoff - b.kickoff)
  return withinWindowOfFirst(upcoming)
}

// Given matches already sorted in the desired order, keeps just those whose
// kickoff is within 15h of the first (anchor) match. Empty in, empty out.
function withinWindowOfFirst(sorted: Timed[]): GroupMatch[] {
  const anchor = sorted[0]?.kickoff
  if (anchor === undefined) return []
  return sorted.filter(x => Math.abs(x.kickoff - anchor) < WINDOW_MS).map(x => x.m)
}

// One card in the home feed. `match` is the GroupMatch the card renders from; for
// a knockout fixture it's the KO match flattened into that shape (id = match
// number) with `ko` carrying the original so the card can label the round and
// pull team-matched predictions. `ko`/`heading` are absent for group fixtures.
export interface FeedCard {
  match: GroupMatch
  heading?: string
  ko?: KnockoutMatch
}

// A resolved knockout fixture as the GroupMatch the card renders from: its match
// number doubles as the id (its /matches route and live/scorer key), and its
// resolved slots are real team codes, so flags and Hebrew names look up the same.
function koAsGroupMatch(m: KnockoutMatch): GroupMatch {
  return {
    id: String(m.matchNum),
    homeTeam: m.home,
    awayTeam: m.away,
    matchDate: m.matchDate,
    kickoffIST: m.kickoffIST,
    scores: m.scores,
  }
}

// Group fixtures and resolved knockout fixtures merged into one card pool, each
// paired with its kickoff instant (cards without a parseable date dropped). A
// knockout match joins only once its teams are decided; placeholders stay out.
function feedCards(group: GroupMatch[], ko: KnockoutMatch[]): { c: FeedCard; kickoff: number }[] {
  const cards: FeedCard[] = [
    ...group.map(m => ({ match: m })),
    ...ko.filter(m => m.resolved).map(m => ({ match: koAsGroupMatch(m), heading: roundLabel(m.matchNum), ko: m })),
  ]
  return cards
    .map(c => ({ c, kickoff: kickoffDate(c.match.matchDate, c.match.kickoffIST)?.getTime() }))
    .filter((x): x is { c: FeedCard; kickoff: number } => x.kickoff !== undefined)
}

// The upcoming home-feed cards: group + knockout fixtures merged into one
// chronological 15h burst, so once the groups are done the feed rolls straight
// into the knockouts. Mirrors nextMatches' "within 15h of the closest,
// started-but-unscored still counts" rule across the combined pool.
export function upcomingCards(group: GroupMatch[], ko: KnockoutMatch[], now: Date): FeedCard[] {
  const upcoming = feedCards(group, ko)
    .filter(x => !hasFinalScore(x.c.match) && now.getTime() < x.kickoff + MATCH_WINDOW_MS)
    .sort((a, b) => a.kickoff - b.kickoff)
  const anchor = upcoming[0]?.kickoff
  if (anchor === undefined) return []
  return upcoming.filter(x => Math.abs(x.kickoff - anchor) < WINDOW_MS).map(x => x.c)
}

// The results-feed mirror of upcomingCards: played group and knockout fixtures
// merged into one 15h burst, newest first, so finished knockout matches show up
// in "תוצאות אחרונות" alongside the group results.
export function recentCards(group: GroupMatch[], ko: KnockoutMatch[], now: Date): FeedCard[] {
  const played = feedCards(group, ko)
    .filter(x => hasFinalScore(x.c.match) && x.kickoff <= now.getTime())
    .sort((a, b) => b.kickoff - a.kickoff)
  const anchor = played[0]?.kickoff
  if (anchor === undefined) return []
  return played.filter(x => Math.abs(x.kickoff - anchor) < WINDOW_MS).map(x => x.c)
}

export interface TopPrediction {
  home: number
  away: number
  count: number
  total: number
}

export function topPrediction(users: User[], matchId: string): TopPrediction | null {
  return mostCommon(scoreFrequencies(users, matchId))
}

// The knockout twin of topPrediction: bettors playing a knockout fixture are
// matched by the teams that actually reached it (not by match id), each counted
// at their score oriented to the real fixture's home/away.
export function koTopPrediction(users: User[], match: KnockoutMatch): TopPrediction | null {
  const counts = new Map<string, number>()
  for (const u of users) {
    const s = knockoutParticipantScore(match, u)
    if (!s || s.home == null || s.away == null) continue
    const key = `${s.home}-${s.away}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return mostCommon(counts)
}

// The most-predicted scoreline from a `${home}-${away}` → count tally, with how
// many bettors called it and the total who predicted at all. Null when empty.
function mostCommon(counts: Map<string, number>): TopPrediction | null {
  let top: { key: string; count: number } | null = null
  let total = 0
  for (const [key, count] of counts) {
    total += count
    if (!top || count > top.count) top = { key, count }
  }
  if (!top) return null
  const [home, away] = top.key.split('-').map(Number)
  return { home, away, count: top.count, total }
}
