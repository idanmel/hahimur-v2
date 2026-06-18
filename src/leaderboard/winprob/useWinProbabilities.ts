import { useEffect, useState } from 'react'
import type { PredictionsState } from '../../shared/types'
import type { Row } from '../../../sim-core'
import type { PlayedMatch } from './realPlayed'
import type { WinProbRequest, WinProbResponse } from './winProbWorker'

export type WinProbStatus = 'loading' | 'ready' | 'unsupported'

export interface WinProbResult {
  status: WinProbStatus
  rows: Row[]
  deltaByLabel: Record<string, number>
}

const DEFAULT_N = 2500
const DEFAULT_SEED = 12345

interface Computed {
  rows: Row[]
  deltaByLabel: Record<string, number>
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
  last: PlayedMatch | null,
  playerGoals: Record<string, number> = {},
  prevPlayerGoals: Record<string, number> = {},
  n: number = DEFAULT_N,
  seed: number = DEFAULT_SEED,
): WinProbResult {
  const supported = typeof Worker !== 'undefined'
  // Bumped when a worker fills the cache, to re-render with the fresh result.
  const [, bump] = useState(0)

  const lastMatchId = last?.id ?? null
  const key = `${JSON.stringify(played)}|${lastMatchId}|${JSON.stringify(playerGoals)}|${JSON.stringify(prevPlayerGoals)}|${n}|${seed}`

  useEffect(() => {
    if (!supported || cache.has(key)) return
    const worker = new Worker(new URL('./winProbWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<WinProbResponse>) => {
      cache.set(key, { rows: e.data.rows, deltaByLabel: e.data.deltaByLabel })
      bump(x => x + 1)
    }
    worker.postMessage({ played, lastMatchId, playerGoals, prevPlayerGoals, n, seed } satisfies WinProbRequest)
    return () => worker.terminate()
    // played/last/n/seed are all captured via `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, supported])

  if (!supported) return { status: 'unsupported', rows: [], deltaByLabel: {} }
  const hit = cache.get(key)
  if (hit) return { status: 'ready', rows: hit.rows, deltaByLabel: hit.deltaByLabel }
  return { status: 'loading', rows: [], deltaByLabel: {} }
}
