import type { Standing, ThirdPlaceQualification, KnockoutMatch, PredictionsState } from '../../shared/types'
import { ALLOCATION_MATRIX, THIRD_PLACE_SOURCE_GROUPS } from './allocationMatrix.ts'
import { GROUP_HEBREW, GROUP_MATCHES, ALL_GROUP_LETTERS } from '../../shared/groups.ts'
import { calculateStandings } from '../../shared/standings.ts'
import { getThirdPlaceTeams, qualifyBestThirdPlace } from '../thirdPlace/thirdPlace.ts'

type GroupData = { group: string; standings: Standing[]; allFilled: boolean }
type Slot = { team: string; resolved: boolean }

export interface KnockoutStages {
  r16: KnockoutMatch[]
  qf: KnockoutMatch[]
  sf: KnockoutMatch[]
  thirdPlace: KnockoutMatch
  final: KnockoutMatch
}

const POSITION_LABELS = ['מנצח', 'סגנית', 'שלישי'] as const

const KO_DATES: Record<number, { matchDate: string; kickoffIST: string }> = {
  // Round of 32
  73: { matchDate: '28 ביוני', kickoffIST: '22:00' },
  74: { matchDate: '29 ביוני', kickoffIST: '23:30' },
  75: { matchDate: '30 ביוני', kickoffIST: '04:00' },
  76: { matchDate: '29 ביוני', kickoffIST: '20:00' },
  77: { matchDate: '1 ביולי',  kickoffIST: '00:00' },
  78: { matchDate: '30 ביוני', kickoffIST: '20:00' },
  79: { matchDate: '1 ביולי',  kickoffIST: '04:00' },
  80: { matchDate: '1 ביולי',  kickoffIST: '19:00' },
  81: { matchDate: '2 ביולי',  kickoffIST: '03:00' },
  82: { matchDate: '1 ביולי',  kickoffIST: '23:00' },
  83: { matchDate: '3 ביולי',  kickoffIST: '02:00' },
  84: { matchDate: '2 ביולי',  kickoffIST: '22:00' },
  85: { matchDate: '3 ביולי',  kickoffIST: '06:00' },
  86: { matchDate: '4 ביולי',  kickoffIST: '01:00' },
  87: { matchDate: '4 ביולי',  kickoffIST: '04:30' },
  88: { matchDate: '3 ביולי',  kickoffIST: '21:00' },
  // Round of 16
  89: { matchDate: '5 ביולי',  kickoffIST: '00:00' },
  90: { matchDate: '4 ביולי',  kickoffIST: '20:00' },
  91: { matchDate: '5 ביולי',  kickoffIST: '23:00' },
  92: { matchDate: '6 ביולי',  kickoffIST: '03:00' },
  93: { matchDate: '6 ביולי',  kickoffIST: '22:00' },
  94: { matchDate: '7 ביולי',  kickoffIST: '03:00' },
  95: { matchDate: '7 ביולי',  kickoffIST: '19:00' },
  96: { matchDate: '7 ביולי',  kickoffIST: '23:00' },
  // Quarterfinals
  97:  { matchDate: '9 ביולי',  kickoffIST: '23:00' },
  98:  { matchDate: '10 ביולי', kickoffIST: '22:00' },
  99:  { matchDate: '12 ביולי', kickoffIST: '00:00' },
  100: { matchDate: '12 ביולי', kickoffIST: '04:00' },
  // Semifinals
  101: { matchDate: '14 ביולי', kickoffIST: '22:00' },
  102: { matchDate: '15 ביולי', kickoffIST: '22:00' },
  // Third place & Final
  103: { matchDate: '19 ביולי', kickoffIST: '00:00' },
  104: { matchDate: '19 ביולי', kickoffIST: '22:00' },
}

function slotAt(data: GroupData | undefined, group: string, idx: number): Slot {
  if (data?.allFilled && data.standings[idx])
    return { team: data.standings[idx].team, resolved: true }
  return { team: `${POSITION_LABELS[idx]} ${GROUP_HEBREW[group] ?? group}`, resolved: false }
}

const winner   = (d: GroupData | undefined, g: string) => slotAt(d, g, 0)
const runnerUp = (d: GroupData | undefined, g: string) => slotAt(d, g, 1)
const thirdOf  = (d: GroupData | undefined, g: string) => slotAt(d, g, 2)

function mk(matchNum: number, home: Slot, away: Slot): KnockoutMatch {
  return { matchNum, home: home.team, away: away.team, resolved: home.resolved && away.resolved, ...KO_DATES[matchNum] }
}

export function resolveRound32(
  allGroupData: GroupData[],
  thirdPlaceQual: ThirdPlaceQualification,
): KnockoutMatch[] {
  const byGroup = Object.fromEntries(allGroupData.map(d => [d.group, d]))

  // The matrix only pins a slot to a single source group once it's trustworthy —
  // i.e. every group has finished, since any remaining result can reshuffle which
  // 3rd places qualify and reassign the whole matrix. A mid-tournament "resolved"
  // qualification off partial standings isn't binding.
  const allGroupsFinished = allGroupData.every(d => d.allFilled)

  let allocAssignment: Record<string, string> | undefined
  if (allGroupsFinished && thirdPlaceQual.resolved) {
    const key = thirdPlaceQual.qualifiers.map(t => t.group).sort().join('')
    allocAssignment = ALLOCATION_MATRIX[key]
  }

  // Until the allocation is binding we don't know which single group feeds this
  // slot, but the matrix narrows it to a fixed set of 5 groups, so show them all:
  // "שלישית א/ב/ג/ד/ו". Once binding, defer to the specific source group.
  function alloc(winnerPos: string): Slot {
    if (!allocAssignment) {
      const groups = THIRD_PLACE_SOURCE_GROUPS[winnerPos] ?? []
      const he = groups.map(g => GROUP_HEBREW[g] ?? g).join('/')
      return { team: `שלישית ${he}`, resolved: false }
    }
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

export function buildKnockoutBracket(predictions: PredictionsState): KnockoutMatch[] {
  const allGroupData = ALL_GROUP_LETTERS.map(letter => {
    const matches = GROUP_MATCHES[letter] ?? []
    const { standings } = calculateStandings(matches, predictions)
    const allFilled = matches.length > 0 && matches.every(m => {
      const s = predictions[m.id]
      return s && s.home !== null && s.away !== null
    })
    return { group: letter as string, standings, allFilled }
  })
  const thirdPlaceQual = qualifyBestThirdPlace(getThirdPlaceTeams(allGroupData))
  const round32 = resolveRound32(allGroupData, thirdPlaceQual)
  const { r16, qf, sf, thirdPlace, final } = resolveKnockout(round32, predictions)
  return [...round32, ...r16, ...qf, ...sf, thirdPlace, final]
}

export function getQualifiedThirdPlaceTeams(predictions: PredictionsState): string[] | null {
  const allGroupData = ALL_GROUP_LETTERS.map(letter => {
    const matches = GROUP_MATCHES[letter] ?? []
    const { standings } = calculateStandings(matches, predictions)
    const allFilled = matches.length > 0 && matches.every(m => {
      const s = predictions[m.id]
      return s && s.home !== null && s.away !== null
    })
    return { group: letter as string, standings, allFilled }
  })
  if (!allGroupData.every(g => g.allFilled)) return null
  const qual = qualifyBestThirdPlace(getThirdPlaceTeams(allGroupData))
  return qual.resolved ? qual.qualifiers.map(t => t.team) : null
}
