import { runSims, buildRows, type Row } from '../../../sim-core'
import type { PredictionsState } from '../../shared/types'

export interface WinProbRequest {
  played: PredictionsState
  lastMatchId: string | null
  // real golden-boot goals accrued up to the viewed point, keyed by player — so
  // the projection and current rank both reward a scorer who's already scoring.
  playerGoals: Record<string, number>
  // same, but excluding the last played match — the baseline the delta compares
  // against, so a scorer netting in that game shows up as a positive swing.
  prevPlayerGoals: Record<string, number>
  n: number
  seed: number
}

export interface WinProbResponse {
  rows: Row[]
  // win% change since the last played game (real minus the same sim with that
  // match removed, common-seeded so the diff is low-noise). Empty before any game.
  deltaByLabel: Record<string, number>
}

// `self` is the dedicated worker global; the DOM-lib `Worker` shape covers the
// single-arg postMessage + onmessage we need without a separate webworker lib.
const worker = self as unknown as Worker

worker.onmessage = (e: MessageEvent<WinProbRequest>) => {
  const { played, lastMatchId, playerGoals, prevPlayerGoals, n, seed } = e.data

  const real = runSims(played, n, seed, true, playerGoals)
  const rows = buildRows(real, n, played, playerGoals)

  const deltaByLabel: Record<string, number> = {}
  if (lastMatchId && played[lastMatchId]) {
    const prevPlayed: PredictionsState = { ...played }
    delete prevPlayed[lastMatchId]
    const prev = runSims(prevPlayed, n, seed, false, prevPlayerGoals)
    for (const r of rows) {
      const prevPct = ((prev.win.get(r.label) ?? 0) / n) * 100
      deltaByLabel[r.label] = r.winPct - prevPct
    }
  }

  worker.postMessage({ rows, deltaByLabel } satisfies WinProbResponse)
}
