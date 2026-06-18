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

// Runs the Monte-Carlo engine in a Web Worker. Recomputes only when the real
// results change (keyed on a stringification), so it effectively runs once.
export function useWinProbabilities(
  played: PredictionsState,
  last: PlayedMatch | null,
  playerGoals: Record<string, number> = {},
  prevPlayerGoals: Record<string, number> = {},
  n: number = DEFAULT_N,
  seed: number = DEFAULT_SEED,
): WinProbResult {
  const supported = typeof Worker !== 'undefined'
  // Keep the last computed result tagged with the key that produced it, so we can
  // derive "loading" purely from whether that key matches the current inputs —
  // no synchronous setState inside the effect needed.
  const [computed, setComputed] = useState<{ key: string; rows: Row[]; deltaByLabel: Record<string, number> } | null>(null)

  const lastMatchId = last?.id ?? null
  const key = `${JSON.stringify(played)}|${lastMatchId}|${JSON.stringify(playerGoals)}|${JSON.stringify(prevPlayerGoals)}|${n}|${seed}`

  useEffect(() => {
    if (!supported) return
    const worker = new Worker(new URL('./winProbWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<WinProbResponse>) => {
      setComputed({ key, rows: e.data.rows, deltaByLabel: e.data.deltaByLabel })
    }
    worker.postMessage({ played, lastMatchId, playerGoals, prevPlayerGoals, n, seed } satisfies WinProbRequest)
    return () => worker.terminate()
    // played/last/n/seed are all captured via `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, supported])

  if (!supported) return { status: 'unsupported', rows: [], deltaByLabel: {} }
  if (computed?.key === key) return { status: 'ready', rows: computed.rows, deltaByLabel: computed.deltaByLabel }
  return { status: 'loading', rows: computed?.rows ?? [], deltaByLabel: computed?.deltaByLabel ?? {} }
}
