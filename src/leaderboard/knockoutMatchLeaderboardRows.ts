import { isUnpredicted, type KnockoutMatch, type MatchScores, type TournamentResults } from '../shared/types'
import type { User } from '../users'
import { matchSortKey } from '../shared/matchOrder'
import { singleMatchPoints, POINTS_PER_GOAL, OLEH_POINTS } from './points'
import { playedGroupMatchesChrono, rowsForMatches } from './leaderboardRows'
import { competitionRanks } from './rank'
import type { MatchLeaderRow } from './matchLeaderboardRows'

function allKO(stages: TournamentResults['knockoutStages']): KnockoutMatch[] {
  return [...stages.r32, ...stages.r16, ...stages.qf, ...stages.sf, ...stages.thirdPlace, ...stages.final]
}

// The bettor's predicted match for this pairing — teams matching in either order.
function userMatchFor(user: User, home: string, away: string): KnockoutMatch | undefined {
  return allKO(user.knockoutStages).find(m =>
    m.home && m.away &&
    ((m.home === home && m.away === away) || (m.home === away && m.away === home)))
}

// Re-express a predicted score in the actual fixture's home/away terms, so a
// bettor who stored the two teams reversed still reads in the page's orientation
// (the penalty winner flips sides with the score). Null if they didn't predict it.
function orientedPrediction(user: User, actualHome: string, actualAway: string): MatchScores | null {
  const um = userMatchFor(user, actualHome, actualAway)
  if (!um?.scores || isUnpredicted(um.scores)) return null
  if (um.home === actualHome) return um.scores
  const sc = um.scores
  return {
    home: sc.away, away: sc.home,
    drawWinner: sc.drawWinner === 'home' ? 'away' : sc.drawWinner === 'away' ? 'home' : undefined,
  }
}

// Points a bettor earns from one played knockout match: the oriented score bet
// plus any goals their picked scorer netted there — mirroring the group rows.
function koMatchPointsFor(user: User, actual: KnockoutMatch, results: TournamentResults): number {
  const predicted = orientedPrediction(user, actual.home, actual.away)
  const betPoints = predicted ? singleMatchPoints(String(actual.matchNum), predicted, actual.scores!) : 0
  const goals = (results.playerMatchGoals?.[user.topGoalscorer]?.[String(actual.matchNum)] ?? 0) * POINTS_PER_GOAL
  return betPoints + goals
}

function roundTeams(matches: KnockoutMatch[]): string[] {
  return matches.flatMap(m => [m.home, m.away]).filter(Boolean) as string[]
}

// The team that advanced out of a played knockout fixture — the higher score, or
// the penalty winner on a level scoreline. Null if the match isn't decided.
function advancingTeam(m: KnockoutMatch): string | null {
  const s = m.scores!
  if (s.home! > s.away!) return m.home
  if (s.away! > s.home!) return m.away
  return s.drawWinner === 'away' ? m.away : s.drawWinner === 'home' ? m.home : null
}

// Advancement bonus this match's winner earns a bettor who foresaw them moving on:
// the round's OLEH points if the actual advancer is in the bettor's next-round set
// (or named as their third-place winner / champion). Mirrors computeRoundBreakdown
// but attributed to the single fixture that produced the advancer, credited as
// soon as the match is played.
function koAdvancementFor(user: User, match: KnockoutMatch): number {
  if (!match.scores || isUnpredicted(match.scores) || !match.home || !match.away) return 0
  const advancer = advancingTeam(match)
  if (!advancer) return 0
  const n = match.matchNum
  const uko = user.knockoutStages
  if (n === 104) return user.predictedChampion === advancer ? OLEH_POINTS.champion : 0
  if (n === 103) return user.predictedThirdPlaceWinner === advancer ? OLEH_POINTS.thirdPlaceWinner : 0
  const { pts, predicted } =
    n <= 88  ? { pts: OLEH_POINTS.r32, predicted: user.predictedR16Teams   ?? roundTeams(uko.r16) }   :
    n <= 96  ? { pts: OLEH_POINTS.r16, predicted: user.predictedQFTeams    ?? roundTeams(uko.qf) }    :
    n <= 100 ? { pts: OLEH_POINTS.qf,  predicted: user.predictedSFTeams    ?? roundTeams(uko.sf) }    :
               { pts: OLEH_POINTS.sf,  predicted: user.predictedFinalTeams ?? roundTeams(uko.final) }
  return predicted.includes(advancer) ? pts : 0
}

// Played knockout matches in schedule order. The requested `match` is folded in
// using its own score when the baked knockoutStages doesn't carry it yet — so a
// fixture resolved from the bracket still scores before results are baked in.
function playedKOChrono(results: TournamentResults, match: KnockoutMatch): KnockoutMatch[] {
  const staged = allKO(results.knockoutStages)
  const merged = staged.some(m => m.matchNum === match.matchNum) ? staged : [...staged, match]
  return merged
    .filter(m => m.home && m.away && m.scores && !isUnpredicted(m.scores))
    .sort((a, b) => matchSortKey(a.matchDate, a.kickoffIST) - matchSortKey(b.matchDate, b.kickoffIST))
}

function ranksByLabel(totals: { label: string; total: number }[]): Record<string, number> {
  const sorted = [...totals].sort((a, b) => b.total - a.total)
  const ranks = competitionRanks(sorted, r => r.total)
  return Object.fromEntries(sorted.map((r, i) => [r.label, ranks[i]]))
}

// A per-match leaderboard for a knockout fixture, mirroring the group one but
// continuing each bettor's running total into the bracket: the base is their
// full played-group total, then knockout matches accrue chronologically. The
// scoreline points and the winner's advancement bonus are surfaced separately,
// but both roll into the running total.
export function buildKnockoutMatchLeaderboardRows(
  users: User[],
  results: TournamentResults,
  match: KnockoutMatch,
): MatchLeaderRow[] {
  const groupBase = rowsForMatches(users, results, playedGroupMatchesChrono(results), false)
  const base = new Map(users.map((u, i) => [u.label, groupBase[i].total]))

  const chrono = playedKOChrono(results, match)
  const idx = chrono.findIndex(m => m.matchNum === match.matchNum)
  const played = idx >= 0
  // Knockout matches counted toward the cumulative total: through this one when
  // it's played, otherwise everything scheduled strictly before it.
  const refKey = matchSortKey(match.matchDate, match.kickoffIST)
  const upTo = played ? idx + 1 : chrono.filter(m => matchSortKey(m.matchDate, m.kickoffIST) < refKey).length

  // Every point a played knockout match awards a bettor — the oriented scoreline
  // bet plus the advancement bonus for its winner.
  const koPointsFor = (user: User, m: KnockoutMatch) => koMatchPointsFor(user, m, results) + koAdvancementFor(user, m)

  // Each bettor's cumulative total through the first `count` knockout matches.
  const totalThrough = (user: User, count: number) =>
    base.get(user.label)! + chrono.slice(0, count).reduce((sum, m) => sum + koPointsFor(user, m), 0)

  // Movement is the rank change this match caused: the standings just before it
  // (group-final standings for the very first knockout match) vs after it.
  const before = played ? ranksByLabel(users.map(u => ({ label: u.label, total: totalThrough(u, idx) }))) : null
  const after = played ? ranksByLabel(users.map(u => ({ label: u.label, total: totalThrough(u, idx + 1) }))) : null

  return users
    .map(user => ({
      label: user.label,
      prediction: orientedPrediction(user, match.home, match.away),
      matchPoints: played ? koMatchPointsFor(user, chrono[idx], results) : 0,
      advancementPoints: played ? koAdvancementFor(user, chrono[idx]) : 0,
      total: totalThrough(user, upTo),
      placeMovement: before && after ? before[user.label] - after[user.label] : null,
    }))
    .sort((a, b) => b.total - a.total || (b.matchPoints + b.advancementPoints) - (a.matchPoints + a.advancementPoints) || a.label.localeCompare(b.label, 'he'))
}
