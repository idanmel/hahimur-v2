import { useEffect, useState } from 'react'
import type { PredictionsState } from '../../shared/types'
import type { PodiumByAdvancer } from '../../../sim-core'
import type { PivotalRequest, PivotalResponse } from './pivotalMatchesWorker'

export type PivotalStatus = 'idle' | 'loading' | 'ready' | 'unsupported'

export interface PivotalHookResult {
  status: PivotalStatus
  result: PodiumByAdvancer[]
}

// Match the win-prob card's count/seed so the conditional reads are drawn from
// the same tournaments the board aggregates — no Monte-Carlo drift between "your
// odds" and "what this match does to them".
const DEFAULT_N = 4000
const DEFAULT_SEED = 12345

// Deterministic for a given (viewer, played, goals, n, seed), so each distinct
// request is simulated once and memoised for the session.
const cache = new Map<string, PodiumByAdvancer[]>()

// Runs pivotalMatches in a Web Worker on a cache miss. An empty viewer label
// (nobody selected) stays idle — there's no "your key moment" to compute.
export function usePivotalMatches(
  viewerLabel: string,
  played: PredictionsState,
  playerGoals: Record<string, number> = {},
  n: number = DEFAULT_N,
  seed: number = DEFAULT_SEED,
): PivotalHookResult {
  const supported = typeof Worker !== 'undefined'
  const [, bump] = useState(0)

  const active = supported && viewerLabel !== ''
  const key = `${viewerLabel}|${JSON.stringify(played)}|${JSON.stringify(playerGoals)}|${n}|${seed}`

  useEffect(() => {
    if (!active || cache.has(key)) return
    const worker = new Worker(new URL('./pivotalMatchesWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<PivotalResponse>) => {
      cache.set(key, e.data.result)
      bump(x => x + 1)
    }
    worker.postMessage({ viewerLabel, played, playerGoals, n, seed } satisfies PivotalRequest)
    return () => worker.terminate()
    // every input is captured by `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active])

  if (!supported) return { status: 'unsupported', result: [] }
  if (!active) return { status: 'idle', result: [] }
  if (cache.has(key)) return { status: 'ready', result: cache.get(key)! }
  return { status: 'loading', result: [] }
}
