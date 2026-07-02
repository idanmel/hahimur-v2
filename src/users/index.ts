import type { PredictionsState, Standing, ThirdPlaceQualification, KnockoutStages, GroupMatch } from '../shared/types'
import { derivePredictions } from './derivePredictions'

export { derivePredictions }

import * as eldad_levi from './eldad-levi'
import * as elrad_gome from './elrad-gome'
import * as idan_melamed from './idan-melamed'
import * as oren_laniado from './oren-laniado'
import * as roi_reisfeld from './roi-reisfeld'
import * as tal_lichter from './tal-lichter'
import * as tomer_agafim_friedler from './tomer-agafim-friedler'
import * as oded_livnat from './oded-livnat'
import * as yaniv_klein from './yaniv-klein'
import * as aviram_hareuveni from './aviram-hareuveni'
import * as lior_moldovan from './lior-moldovan'
import * as yonatan_karni from './yonatan-karni'
import * as maor_frankel from './maor-frankel'
import * as noam_biran from './noam-biran'
import * as raz_kobi from './raz-kobi'
import * as noam_yaron from './noam-yaron'
import * as adam_aronovitch from './adam-aronovitch'
import * as asaf_ben_zaken from './asaf-ben-zaken'
import * as chen_inbar from './chen-inbar'
import * as nir_alfasi from './nir-alfasi'
import * as eyal_erez from './eyal-erez'
import * as noam_gershoni from './noam-gershoni'
import * as itay_karlinski from './itay-karlinski'
import * as eitan_benmor from './eitan-benmor'
import * as alon_goldstein from './alon-goldstein'
import * as omer_apel from './omer-apel'

export interface User {
  label: string
  predictions: PredictionsState
  // A pick is identity, not just display: points and live goals join on the
  // exact string. Real users' picks must be canonical PICKED_SCORERS names
  // (shared/scorers.ts) — scorers.test.ts enforces that at the data boundary.
  topGoalscorer: string
  groupTables: Record<string, Standing[]>
  thirdPlaceQualification: ThirdPlaceQualification
  groupMatches: Record<string, GroupMatch[]>
  knockoutStages: KnockoutStages
  predictedChampion?: string
  predictedThirdPlaceWinner?: string
  predictedR16Teams?: string[]
  predictedQFTeams?: string[]
  predictedSFTeams?: string[]
  predictedFinalTeams?: string[]
}

function toUser(mod: Omit<User, 'predictions'> & Record<string, unknown>): User {
  return { ...mod, predictions: derivePredictions(mod.groupMatches, mod.knockoutStages) } as User
}

export const USERS: User[] = [
  toUser(eldad_levi),
  toUser(elrad_gome),
  toUser(idan_melamed),
  toUser(oren_laniado),
  toUser(roi_reisfeld),
  toUser(tal_lichter),
  toUser(tomer_agafim_friedler),
  toUser(oded_livnat),
  toUser(yaniv_klein),
  toUser(aviram_hareuveni),
  toUser(lior_moldovan),
  toUser(yonatan_karni),
  toUser(maor_frankel),
  toUser(noam_biran),
  toUser(raz_kobi),
  toUser(noam_yaron),
  toUser(adam_aronovitch),
  toUser(asaf_ben_zaken),
  toUser(chen_inbar),
  toUser(nir_alfasi),
  toUser(eyal_erez),
  toUser(noam_gershoni),
  toUser(itay_karlinski),
  toUser(eitan_benmor),
  toUser(alon_goldstein),
  toUser(omer_apel),
]

export const USERS_SORTED = [...USERS].sort((a, b) => a.label.localeCompare(b.label, 'he'))
