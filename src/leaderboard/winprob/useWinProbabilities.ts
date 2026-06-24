import { useEffect, useState } from 'react'
import type { PredictionsState } from '../../shared/types'
import type { Row, StageReach } from '../../../sim-core'
import type { WinProbRequest, WinProbResponse } from './winProbWorker'

export type WinProbStatus = 'loading' | 'ready' | 'unsupported'

export interface WinProbResult {
  status: WinProbStatus
  rows: Row[]
  reachByTeam: Record<string, number>
  groupFirstByTeam: Record<string, number>
  stageReachByTeam: Record<string, StageReach>
}

// A single fast pass. We dropped the second "before this match" run that powered
// the win% delta — it was a difference of two noisy estimates (doubly noisy) and
// doubled the runtime. With only one run we can keep the count modest and still be
// quick: probabilities are reported directly (not as fragile differences), and the
// deeper "reach the stage you backed" odds are stable enough at this count.
const DEFAULT_N = 4000
const DEFAULT_SEED = 12345

interface Computed {
  rows: Row[]
  reachByTeam: Record<string, number>
  groupFirstByTeam: Record<string, number>
  stageReachByTeam: Record<string, StageReach>
}

// The engine is fully deterministic for a given (played, goals, n, seed), so every
// distinct point-in-time only needs to be simulated once. We memoise results per
// key for the whole session — switching scope/back, or flipping between points
// already viewed, is then instant; only a genuinely new scenario runs the sims.
const cache = new Map<string, Computed>()

// Runs the Monte-Carlo engine in a Web Worker, but only on a cache miss — i.e.
// the first time a given scenario is requested. Repeat views return cached.
export function useWinProbabilities(
  played: PredictionsState,
  playerGoals: Record<string, number> = {},
  n: number = DEFAULT_N,
  seed: number = DEFAULT_SEED,
): WinProbResult {
  const supported = typeof Worker !== 'undefined'
  // Bumped when a worker fills the cache, to re-render with the fresh result.
  const [, bump] = useState(0)

  const key = `${JSON.stringify(played)}|${JSON.stringify(playerGoals)}|${n}|${seed}`

  useEffect(() => {
    if (!supported || cache.has(key)) return
    const worker = new Worker(new URL('./winProbWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<WinProbResponse>) => {
      cache.set(key, { rows: e.data.rows, reachByTeam: e.data.reachByTeam, groupFirstByTeam: e.data.groupFirstByTeam, stageReachByTeam: e.data.stageReachByTeam })
      bump(x => x + 1)
    }
    worker.postMessage({ played, playerGoals, n, seed } satisfies WinProbRequest)
    return () => worker.terminate()
    // played/n/seed are all captured via `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, supported])

  if (!supported) return { status: 'unsupported', rows: [], reachByTeam: {}, groupFirstByTeam: {}, stageReachByTeam: {} }
  const hit = cache.get(key)
  if (hit) return { status: 'ready', rows: hit.rows, reachByTeam: hit.reachByTeam, groupFirstByTeam: hit.groupFirstByTeam, stageReachByTeam: hit.stageReachByTeam }
  return { status: 'loading', rows: [], reachByTeam: {}, groupFirstByTeam: {}, stageReachByTeam: {} }
}
