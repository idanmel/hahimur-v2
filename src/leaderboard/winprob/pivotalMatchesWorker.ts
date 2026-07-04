import { pivotalMatches, type PodiumByAdvancer } from '../../../sim-core'
import { USERS } from '../../users'
import type { PredictionsState } from '../../shared/types'

export interface PivotalRequest {
  viewerLabel: string
  played: PredictionsState
  playerGoals: Record<string, number>
  n: number
  seed: number
}

export interface PivotalResponse {
  result: PodiumByAdvancer[]
}

// `self` is the dedicated worker global; the DOM-lib `Worker` shape covers the
// single-arg postMessage + onmessage we need.
const worker = self as unknown as Worker

// One Monte-Carlo pass off the main thread scores every current-round fixture for
// how much its outcome swings the viewer's finish, so the "what if" read never
// blocks scrolling. The viewer is sent by label and resolved here so the request
// stays a plain serialisable object.
worker.onmessage = (e: MessageEvent<PivotalRequest>) => {
  const { viewerLabel, played, playerGoals, n, seed } = e.data
  const viewer = USERS.find(u => u.label === viewerLabel)
  const result = viewer ? pivotalMatches(viewer, played, n, seed, playerGoals) : []
  worker.postMessage({ result } satisfies PivotalResponse)
}
