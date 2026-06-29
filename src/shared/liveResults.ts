import type { TournamentResults, KnockoutStages, MatchScores } from './types'
import { derivePlayerGoals } from '../tournament-results'
import { allKO } from '../formView/knockout/koRounds'
import type { LiveOverlay } from './espnLive'

// Overlays a live {scores, goals} overlay onto the baked tournament results.
// Never overrides a match that already has a final baked score, and returns the
// base object unchanged when the overlay is empty (no live match / fetch failed),
// so the app behaves exactly as before when nothing is live.
export function mergeLiveResults(base: TournamentResults, live: LiveOverlay): TournamentResults {
  const hasScores = Object.keys(live.scores).length > 0
  const hasGoals = Object.keys(live.goals).length > 0
  const hasLive = Object.keys(live.live ?? {}).length > 0
  const hasKoReg = Object.keys(live.koReg ?? {}).length > 0
  if (!hasScores && !hasGoals && !hasLive && !hasKoReg) return base

  const finalIds = new Set<string>()
  for (const matches of Object.values(base.groupMatches)) {
    for (const m of matches) {
      if (m.scores?.home != null && m.scores?.away != null) finalIds.add(m.id)
    }
  }
  // Knockout matches are keyed by their matchNum (as a string), the same id the
  // live overlay and the home-feed cards use. A baked final KO score is final.
  for (const m of allKO(base.knockoutStages)) {
    if (m.scores?.home != null && m.scores?.away != null) finalIds.add(String(m.matchNum))
  }

  // Carry live status for in-progress matches, but never for one that already
  // has a baked final score — a finished match is finished even if ESPN is slow
  // to flip its state.
  const liveStatus: NonNullable<TournamentResults['live']> = {}
  for (const [matchId, status] of Object.entries(live.live ?? {})) {
    if (!finalIds.has(matchId)) liveStatus[matchId] = status
  }

  // Decide which scores to overlay onto one match, keyed by `id`. Returns the
  // scores to use, or null to leave the baked match untouched. Shared by the
  // group and knockout loops, which differ only in their container, id
  // derivation, and (KO only) the `koReg` 90'-freeze preference below.
  // A match already in finalIds keeps its baked final score, always.
  const resolveLiveScore = (id: string, reg?: MatchScores): MatchScores | null => {
    if (finalIds.has(id)) return null
    // KO only: prefer the frozen regulation (90') score when we have it — that
    // keeps a predicted draw scored correctly once a match goes to extra time /
    // penalties (the running scoreboard score would by then include ET goals).
    // Until the summary yields a regulation score we fall back to the running
    // score, which equals the regulation score during the first 90' anyway.
    // The running score stays in `live` for the display badge.
    if (reg) return { ...reg }
    const liveScore = live.scores[id]
    return liveScore ? { home: liveScore.home, away: liveScore.away } : null
  }

  const groupMatches: TournamentResults['groupMatches'] = {}
  for (const [letter, matches] of Object.entries(base.groupMatches)) {
    groupMatches[letter] = matches.map(m => {
      const scores = resolveLiveScore(m.id)
      return scores ? { ...m, scores } : m
    })
  }

  // Overlay live KO scores onto the bracket, keyed by matchNum, for an in-progress
  // not-yet-final match. Scoring reads m.scores, so prefer the frozen regulation
  // (90') score (see resolveLiveScore) over the running scoreboard.
  const knockoutStages: KnockoutStages = { ...base.knockoutStages }
  for (const round of Object.keys(knockoutStages) as (keyof KnockoutStages)[]) {
    knockoutStages[round] = knockoutStages[round].map(m => {
      const id = String(m.matchNum)
      const scores = resolveLiveScore(id, live.koReg?.[id])
      return scores ? { ...m, scores } : m
    })
  }

  const playerMatchGoals: Record<string, Record<string, number>> = {}
  for (const [player, byMatch] of Object.entries(base.playerMatchGoals ?? {})) {
    playerMatchGoals[player] = { ...byMatch }
  }
  for (const [player, byMatch] of Object.entries(live.goals)) {
    const target = playerMatchGoals[player] ?? (playerMatchGoals[player] = {})
    for (const [matchId, count] of Object.entries(byMatch)) {
      if (!finalIds.has(matchId)) target[matchId] = count
    }
  }

  return {
    ...base,
    groupMatches,
    knockoutStages,
    playerMatchGoals,
    playerGoals: derivePlayerGoals(playerMatchGoals),
    live: liveStatus,
  }
}
