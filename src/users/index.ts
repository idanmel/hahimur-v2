import type { PredictionsState } from '../shared/types'

import * as eldad_levi from './eldad-levi'
import * as elrad_gome from './elrad-gome'
import * as idan_melamed from './idan-melamed'
import * as oren_laniado from './oren-laniado'
import * as tal_lichter from './tal-lichter'

export interface User {
  label: string
  predictions: PredictionsState
  topGoalscorer: string
}

export const USERS: User[] = [
  eldad_levi,
  elrad_gome,
  idan_melamed,
  oren_laniado,
  tal_lichter,
]

export const USERS_SORTED = [...USERS].sort((a, b) => a.label.localeCompare(b.label, 'he'))
