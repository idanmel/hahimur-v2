import type { Standing, ThirdPlaceQualification, KnockoutMatch } from '../shared/types'
import { ALLOCATION_MATRIX } from './allocationMatrix'
import { GROUP_HEBREW } from '../shared/groups'

type GroupData = { group: string; standings: Standing[]; allFilled: boolean }
type Slot = { team: string; resolved: boolean }

const POSITION_LABELS = ['מנצח', 'סגן-אלוף', 'שלישי'] as const

function slotAt(data: GroupData | undefined, group: string, idx: number): Slot {
  if (data?.allFilled && data.standings[idx])
    return { team: data.standings[idx].team, resolved: true }
  return { team: `${POSITION_LABELS[idx]} ${GROUP_HEBREW[group] ?? group}`, resolved: false }
}

const winner   = (d: GroupData | undefined, g: string) => slotAt(d, g, 0)
const runnerUp = (d: GroupData | undefined, g: string) => slotAt(d, g, 1)
const thirdOf  = (d: GroupData | undefined, g: string) => slotAt(d, g, 2)

function mk(matchNum: number, home: Slot, away: Slot): KnockoutMatch {
  return { matchNum, home: home.team, away: away.team, resolved: home.resolved && away.resolved }
}

export function resolveRound32(
  allGroupData: GroupData[],
  thirdPlaceQual: ThirdPlaceQualification,
): KnockoutMatch[] {
  const byGroup = Object.fromEntries(allGroupData.map(d => [d.group, d]))

  let allocAssignment: Record<string, string> | undefined
  if (thirdPlaceQual.resolved) {
    const key = thirdPlaceQual.qualifiers.map(t => t.group).sort().join('')
    allocAssignment = ALLOCATION_MATRIX[key]
  }

  function alloc(winnerPos: string): Slot {
    if (!allocAssignment) return { team: '?', resolved: false }
    const slot = allocAssignment[winnerPos]
    if (!slot) return { team: '?', resolved: false }
    const srcGroup = slot.slice(1)
    return thirdOf(byGroup[srcGroup], srcGroup)
  }

  const w = (g: string) => winner(byGroup[g], g)
  const r = (g: string) => runnerUp(byGroup[g], g)

  return [
    mk(73, r('A'), r('B')),
    mk(74, w('E'), alloc('1E')),
    mk(75, w('F'), r('C')),
    mk(76, w('C'), r('F')),
    mk(77, w('I'), alloc('1I')),
    mk(78, r('E'), r('I')),
    mk(79, w('A'), alloc('1A')),
    mk(80, w('L'), alloc('1L')),
    mk(81, w('D'), alloc('1D')),
    mk(82, w('G'), alloc('1G')),
    mk(83, r('K'), r('L')),
    mk(84, w('H'), r('J')),
    mk(85, w('B'), alloc('1B')),
    mk(86, w('J'), r('H')),
    mk(87, w('K'), alloc('1K')),
    mk(88, r('D'), r('G')),
  ]
}
