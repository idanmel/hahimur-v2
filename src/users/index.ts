import type { PredictionsState, Standing, ThirdPlaceQualification, KnockoutStages, GroupMatch } from '../shared/types'

import * as eldad_levi from './eldad-levi'
import * as elrad_gome from './elrad-gome'
import * as idan_melamed from './idan-melamed'
import * as oren_laniado from './oren-laniado'
import * as tal_lichter from './tal-lichter'

export interface User {
  label: string
  predictions: PredictionsState
  topGoalscorer: string
  groupTables: Record<string, Standing[]>
  thirdPlaceQualification: ThirdPlaceQualification
  groupMatches: Record<string, GroupMatch[]>
  knockoutStages: KnockoutStages
  predictedChampion?: string
}

function derivePredictions(groupMatches: Record<string, GroupMatch[]>, knockoutStages: KnockoutStages): PredictionsState {
  const result: PredictionsState = {}
  for (const matches of Object.values(groupMatches)) {
    for (const match of matches) {
      if (match.scores) result[match.id] = match.scores
    }
  }
  const allKO = [...knockoutStages.r32, ...knockoutStages.r16, ...knockoutStages.qf, ...knockoutStages.sf, ...knockoutStages.thirdPlace, ...knockoutStages.final]
  for (const match of allKO) {
    if (match.scores) result[String(match.matchNum)] = match.scores
  }
  return result
}

function toUser(mod: Omit<User, 'predictions'> & Record<string, unknown>): User {
  return { ...mod, predictions: derivePredictions(mod.groupMatches, mod.knockoutStages) } as User
}

export const USERS: User[] = [
  toUser(eldad_levi),
  toUser(elrad_gome),
  toUser(idan_melamed),
  toUser(oren_laniado),
  toUser(tal_lichter),
]

export const USERS_SORTED = [...USERS].sort((a, b) => a.label.localeCompare(b.label, 'he'))
