import { useEffect, useState } from 'react'
import type { PredictionsState } from '../../shared/types'
import type { PodiumByAdvancer } from '../../../sim-core'
import type { PodiumRequest, PodiumResponse } from './podiumByAdvancerWorker'

export type PodiumStatus = 'idle' | 'loading' | 'ready' | 'unsupported'

export interface PodiumHookResult {
  status: PodiumStatus
  result: PodiumByAdvancer | null
}

// Match the win-prob card's count/seed so the read is stable and deterministic;
// the conditional podium % is reported directly (not as a fragile difference), so
// 4000 is plenty even after splitting into the two advancer buckets.
const DEFAULT_N = 4000
const DEFAULT_SEED = 12345

// Deterministic for a given (viewer, played, goals, match, n, seed), so each
// distinct request is simulated once and memoised for the session — revisiting a
// fixture, or switching back to it, is then instant.
const cache = new Map<string, PodiumByAdvancer | null>()

// Runs podiumByAdvancer in a Web Worker on a cache miss. An empty viewer label
// (nobody picked) stays idle — there's no "your podium" to compute.
export function usePodiumByAdvancer(
  viewerLabel: string,
  played: PredictionsState,
  playerGoals: Record<string, number> = {},
  matchNum: number,
  n: number = DEFAULT_N,
  seed: number = DEFAULT_SEED,
): PodiumHookResult {
  const supported = typeof Worker !== 'undefined'
  const [, bump] = useState(0)

  const active = supported && viewerLabel !== ''
  const key = `${viewerLabel}|${JSON.stringify(played)}|${JSON.stringify(playerGoals)}|${matchNum}|${n}|${seed}`

  useEffect(() => {
    if (!active || cache.has(key)) return
    const worker = new Worker(new URL('./podiumByAdvancerWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<PodiumResponse>) => {
      cache.set(key, e.data.result)
      bump(x => x + 1)
    }
    worker.postMessage({ viewerLabel, played, playerGoals, matchNum, n, seed } satisfies PodiumRequest)
    return () => worker.terminate()
    // every input is captured by `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active])

  if (!supported) return { status: 'unsupported', result: null }
  if (!active) return { status: 'idle', result: null }
  if (cache.has(key)) return { status: 'ready', result: cache.get(key)! }
  return { status: 'loading', result: null }
}
