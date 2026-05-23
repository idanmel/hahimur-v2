import type { Standing, ThirdPlaceQualification, KnockoutMatch, MatchScores } from '../../shared/types'
import { ALLOCATION_MATRIX } from './allocationMatrix'
import { GROUP_HEBREW } from '../../shared/groups'

type GroupData = { group: string; standings: Standing[]; allFilled: boolean }
type Slot = { team: string; resolved: boolean }
type PredictionsState = Record<string, MatchScores>

export interface KnockoutStages {
  r16: KnockoutMatch[]
  qf: KnockoutMatch[]
  sf: KnockoutMatch[]
  thirdPlace: KnockoutMatch
  final: KnockoutMatch
}

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
    const srcGroup = slot.slice(1) // matrix values are '3X' — strip the '3' to get group letter
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

function placeholder(matchNum: number, prefix: string): Slot {
  return { team: `${prefix} ${matchNum}`, resolved: false }
}

function outcomeOf(m: KnockoutMatch, predictions: PredictionsState, pick: 'winner' | 'loser'): Slot {
  const prefix = pick === 'winner' ? 'מנצח' : 'מפסיד'
  if (!m.resolved) return placeholder(m.matchNum, prefix)
  const pred = predictions[String(m.matchNum)]
  if (!pred || pred.home === null || pred.away === null) return placeholder(m.matchNum, prefix)
  if (pred.home > pred.away) return { team: pick === 'winner' ? m.home : m.away, resolved: true }
  if (pred.away > pred.home) return { team: pick === 'winner' ? m.away : m.home, resolved: true }
  if (pred.drawWinner === 'home') return { team: pick === 'winner' ? m.home : m.away, resolved: true }
  if (pred.drawWinner === 'away') return { team: pick === 'winner' ? m.away : m.home, resolved: true }
  return placeholder(m.matchNum, prefix)
}

export function clearUnresolvedKOScores(
  matches: KnockoutMatch[],
  predictions: PredictionsState,
): PredictionsState {
  const toClear = matches.filter(m => {
    if (m.resolved) return false
    const p = predictions[String(m.matchNum)]
    return p && (p.home !== null || p.away !== null)
  })
  if (toClear.length === 0) return predictions
  const next = { ...predictions }
  for (const m of toClear) next[String(m.matchNum)] = { home: null, away: null }
  return next
}

export function resolveKnockout(round32: KnockoutMatch[], predictions: PredictionsState): KnockoutStages {
  const byNum: Record<number, KnockoutMatch> = {}
  for (const m of round32) byNum[m.matchNum] = m

  const fallback = (n: number): KnockoutMatch => ({ matchNum: n, home: '', away: '', resolved: false })
  const matchAt = (n: number) => byNum[n] ?? fallback(n)
  const w = (n: number): Slot => outcomeOf(matchAt(n), predictions, 'winner')
  const l = (n: number): Slot => outcomeOf(matchAt(n), predictions, 'loser')

  const r16 = [
    mk(89, w(74), w(77)),
    mk(90, w(73), w(75)),
    mk(91, w(76), w(78)),
    mk(92, w(79), w(80)),
    mk(93, w(83), w(84)),
    mk(94, w(81), w(82)),
    mk(95, w(86), w(88)),
    mk(96, w(85), w(87)),
  ]
  for (const m of r16) byNum[m.matchNum] = m

  const qf = [
    mk(97,  w(89), w(90)),
    mk(98,  w(93), w(94)),
    mk(99,  w(91), w(92)),
    mk(100, w(95), w(96)),
  ]
  for (const m of qf) byNum[m.matchNum] = m

  const sf = [
    mk(101, w(97),  w(98)),
    mk(102, w(99), w(100)),
  ]
  for (const m of sf) byNum[m.matchNum] = m

  const thirdPlace = mk(103, l(101), l(102))
  const final      = mk(104, w(101), w(102))

  return { r16, qf, sf, thirdPlace, final }
}
