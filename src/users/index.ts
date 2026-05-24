import type { PredictionsState } from '../shared/types'

import * as idan_melamed from './idan-melamed'

export interface User {
  label: string
  number: string
  predictions: PredictionsState
  topGoalscorer: string
}

export const USERS: User[] = [
  idan_melamed,
]
