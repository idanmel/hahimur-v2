import { deriveGroupStatus } from '../shared/groupStatus'
import { getThirdPlaceTeams, qualifyBestThirdPlace } from '../formView/thirdPlace/thirdPlace'
import { derivePlayerGoals } from '../tournament-results'
import { matchSortKey } from '../shared/matchOrder'
import { isUnpredicted } from '../shared/types'
import type { KnockoutMatch, MatchScores, PredictionsState, TournamentResults } from '../shared/types'

// One played match, normalised across stages so the race can walk the whole
// tournament as a single timeline. `id` is the key used to slice scores.
export interface PlayedMatch {
  id: string
  date: string
  homeTeam: string
  awayTeam: string
  scores: MatchScores
}

const KO_ROUNDS: (keyof TournamentResults['knockoutStages'])[] = ['r32', 'r16', 'qf', 'sf', 'thirdPlace', 'final']

const isPlayed = (s?: MatchScores): s is MatchScores => !!s && !isUnpredicted(s)

// Every played match in chronological order, group stage first and then the
// knockout rounds in bracket order. The group always precedes the knockouts in
// time, so this is the true timeline; while there are no KO matches it is
// exactly the old group-only walk.
export function playedMatchesChrono(results: TournamentResults): PlayedMatch[] {
  const group = Object.values(results.groupMatches).flat()
    .filter(m => isPlayed(m.scores))
    .sort((a, b) => matchSortKey(a.matchDate, a.kickoffIST) - matchSortKey(b.matchDate, b.kickoffIST))
    .map(m => ({ id: m.id, date: m.matchDate ?? '', homeTeam: m.homeTeam, awayTeam: m.awayTeam, scores: m.scores! }))

  const ko: PlayedMatch[] = []
  for (const round of KO_ROUNDS) {
    for (const m of (results.knockoutStages[round] ?? []).filter(m => isPlayed(m.scores)).sort((a, b) => a.matchNum - b.matchNum)) {
      ko.push({ id: String(m.matchNum), date: m.matchDate ?? '', homeTeam: m.home, awayTeam: m.away, scores: m.scores! })
    }
  }
  return [...group, ...ko]
}

// The tournament as it stood right after the first `count` played matches of
// `chrono`. Built by re-running the SAME derivation pipeline that produces the
// live results (deriveGroupStatus + third-place qualification) over only the
// in-slice scores — so feeding this to computeUserPoints yields exactly the
// leaderboard total at that moment, no scoring logic duplicated.
export function resultsAsOf(results: TournamentResults, chrono: PlayedMatch[], count: number): TournamentResults {
  const sliceIds = new Set(chrono.slice(0, count).map(m => m.id))

  const partial: PredictionsState = {}
  for (const m of Object.values(results.groupMatches).flat()) {
    if (sliceIds.has(m.id) && m.scores) partial[m.id] = m.scores
  }

  const { allGroupData, allGroupsFilled } = deriveGroupStatus(partial)
  const groupTables = Object.fromEntries(allGroupData.map(d => [d.group, d.standings]))
  const thirdTeams = getThirdPlaceTeams(allGroupData)
  const thirdPlaceQualification = allGroupsFilled
    ? qualifyBestThirdPlace(thirdTeams)
    : { resolved: false as const, all: thirdTeams, tied: [] }

  const groupMatches = Object.fromEntries(
    Object.entries(results.groupMatches).map(([letter, ms]) => [
      letter,
      ms.map(m => (sliceIds.has(m.id) ? m : { ...m, scores: { home: null, away: null } })),
    ]),
  )

  // Keep the revealed bracket (home/away) but clear the score of any match not
  // yet in the slice, so unplayed-as-of-`count` rounds award nothing.
  const clearScore = (m: KnockoutMatch): KnockoutMatch =>
    sliceIds.has(String(m.matchNum)) ? m : { ...m, scores: { home: null, away: null } }
  const knockoutStages = {
    r32: (results.knockoutStages.r32 ?? []).map(clearScore),
    r16: (results.knockoutStages.r16 ?? []).map(clearScore),
    qf: (results.knockoutStages.qf ?? []).map(clearScore),
    sf: (results.knockoutStages.sf ?? []).map(clearScore),
    thirdPlace: (results.knockoutStages.thirdPlace ?? []).map(clearScore),
    final: (results.knockoutStages.final ?? []).map(clearScore),
  }

  const playerMatchGoals: Record<string, Record<string, number>> = {}
  for (const [player, byMatch] of Object.entries(results.playerMatchGoals ?? {})) {
    const kept = Object.fromEntries(Object.entries(byMatch).filter(([mid]) => sliceIds.has(mid)))
    if (Object.keys(kept).length) playerMatchGoals[player] = kept
  }

  // The tournament-deciders are only known once their match is in the slice;
  // until then they award nothing (the golden boot is settled at the very end).
  const decided = (m: KnockoutMatch) => sliceIds.has(String(m.matchNum))
  const tournamentOver = count >= chrono.length
  const champion = (results.knockoutStages.final ?? []).some(decided) ? results.champion : undefined
  const thirdPlaceWinner = (results.knockoutStages.thirdPlace ?? []).some(decided) ? results.thirdPlaceWinner : undefined

  return {
    ...results,
    groupMatches,
    groupTables,
    knockoutStages,
    playerMatchGoals,
    playerGoals: derivePlayerGoals(playerMatchGoals),
    thirdPlaceQualification,
    champion,
    thirdPlaceWinner,
    goldenBootWinner: tournamentOver ? results.goldenBootWinner : undefined,
  }
}
