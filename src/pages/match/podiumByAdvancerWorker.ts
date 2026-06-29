import { podiumByAdvancer, type PodiumByAdvancer } from '../../../sim-core'
import { USERS } from '../../users'
import type { PredictionsState } from '../../shared/types'

export interface PodiumRequest {
  viewerLabel: string
  played: PredictionsState
  playerGoals: Record<string, number>
  matchNum: number
  n: number
  seed: number
}

export interface PodiumResponse {
  result: PodiumByAdvancer | null
}

// `self` is the dedicated worker global; the DOM-lib `Worker` shape covers the
// single-arg postMessage + onmessage we need.
const worker = self as unknown as Worker

// One Monte-Carlo pass off the main thread: it pins this worker's core for the
// run, but the page (and its scroll/clicks) stays responsive. The viewer is sent
// by label and resolved here so the request stays a plain serialisable object.
worker.onmessage = (e: MessageEvent<PodiumRequest>) => {
  const { viewerLabel, played, playerGoals, matchNum, n, seed } = e.data
  const viewer = USERS.find(u => u.label === viewerLabel)
  const result = viewer ? podiumByAdvancer(viewer, played, matchNum, n, seed, playerGoals) : null
  worker.postMessage({ result } satisfies PodiumResponse)
}
