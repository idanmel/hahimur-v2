import { runSims, buildRows, mergeSimAgg, simChunks, type Row, type SimAgg, type StageReach } from '../../../sim-core'
import type { PredictionsState } from '../../shared/types'

export interface WinProbRequest {
  played: PredictionsState
  // real golden-boot goals accrued up to the viewed point, keyed by player — so
  // the projection and current rank both reward a scorer who's already scoring.
  playerGoals: Record<string, number>
  n: number
  seed: number
}

export interface WinProbResponse {
  rows: Row[]
  // Simulated probability each team survives the group stage (reaches the round
  // of 32), keyed by team code. Lets the view treat a ~0% team as eliminated even
  // before its group formally finishes (see effectiveEliminations).
  reachByTeam: Record<string, number>
  // Simulated probability each team finishes *first* in its group, keyed by team
  // code. With reachByTeam this turns "advances" into "advances, likely as winner
  // / runner-up" — the round-3 picture the card now spells out per bettor.
  groupFirstByTeam: Record<string, number>
  // Per-team probability of reaching each tournament depth, keyed by team code, so
  // the card can quote the odds at the exact stage each bettor backed a team to.
  stageReachByTeam: Record<string, StageReach>
  // Per knockout matchNum (every round), P(each team pairing occurs), keyed by the
  // side-agnostic "teamA|teamB" key. Lets the crossings view quote P(my matchup
  // comes true) at any stage.
  crossingProbByMatch: Record<number, Record<string, number>>
}

// `self` is the dedicated worker global; the DOM-lib `Worker` shape covers the
// single-arg postMessage + onmessage we need without a separate webworker lib.
const worker = self as unknown as Worker

worker.onmessage = async (e: MessageEvent<WinProbRequest>) => {
  const { played, playerGoals, n, seed } = e.data

  // Single pass — no counterfactual "before this match" run. The win% itself is
  // what the card reports; a per-match win% delta was a difference of two noisy
  // estimates (so doubly noisy) and doubled the runtime, so it's gone.
  //
  // n sims is a solid stretch of CPU; running it as one blocking loop pins a core
  // for that whole time, which starves the rest of the machine and feels like a
  // freeze. We slice it into the shared chunk plan (sim-core's simChunks: a fixed
  // batch size, each batch re-seeded with seed + chunkIndex) and yield a macrotask
  // between batches so the event loop — and the host — can breathe. The match card
  // walks the very same chunk plan, so both views sample identical tournaments.
  const chunks = simChunks(n, seed)
  let real: SimAgg = runSims(played, chunks[0].count, chunks[0].seed, true, playerGoals)
  for (let i = 1; i < chunks.length; i++) {
    await new Promise<void>(resolve => setTimeout(resolve))
    real = mergeSimAgg(real, runSims(played, chunks[i].count, chunks[i].seed, true, playerGoals))
  }
  const rows = buildRows(real, n, played, playerGoals)

  const reachByTeam: Record<string, number> = {}
  for (const [team, count] of real.reachR32) reachByTeam[team] = count / n

  const groupFirstByTeam: Record<string, number> = {}
  for (const [team, count] of real.groupFirst) groupFirstByTeam[team] = count / n

  const teams = new Set<string>([...real.reachR32.keys(), ...real.champFreq.keys()])
  const stageReachByTeam: Record<string, StageReach> = {}
  for (const t of teams) {
    stageReachByTeam[t] = {
      r32: (real.reachR32.get(t) ?? 0) / n,
      r16: (real.reachR16.get(t) ?? 0) / n,
      qf: (real.reachQF.get(t) ?? 0) / n,
      sf: (real.reachSF.get(t) ?? 0) / n,
      final: (real.reachFinal.get(t) ?? 0) / n,
      champion: (real.champFreq.get(t) ?? 0) / n,
      third: (real.thirdFreq.get(t) ?? 0) / n,
    }
  }

  const crossingProbByMatch: Record<number, Record<string, number>> = {}
  for (const [matchNum, byPair] of real.koPairs) {
    const rec: Record<string, number> = {}
    for (const [key, count] of byPair) rec[key] = count / n
    crossingProbByMatch[matchNum] = rec
  }

  worker.postMessage({ rows, reachByTeam, groupFirstByTeam, stageReachByTeam, crossingProbByMatch } satisfies WinProbResponse)
}
