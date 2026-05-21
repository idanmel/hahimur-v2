import type { KnockoutMatch, MatchScores } from '../shared/types'

type PredictionsState = Record<string, MatchScores>

export interface KnockoutStages {
  r16: KnockoutMatch[]
  qf: KnockoutMatch[]
  sf: KnockoutMatch[]
  thirdPlace: KnockoutMatch
  final: KnockoutMatch
}

type Slot = { team: string; resolved: boolean }

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
  return placeholder(m.matchNum, prefix)
}

function mk(matchNum: number, home: Slot, away: Slot): KnockoutMatch {
  return { matchNum, home: home.team, away: away.team, resolved: home.resolved && away.resolved }
}

export function resolveKnockout(round32: KnockoutMatch[], predictions: PredictionsState): KnockoutStages {
  const byNum: Record<number, KnockoutMatch> = {}
  for (const m of round32) byNum[m.matchNum] = m

  const fallback = (n: number): KnockoutMatch => ({ matchNum: n, home: '', away: '', resolved: false })
  const w = (n: number): Slot => outcomeOf(byNum[n] ?? fallback(n), predictions, 'winner')
  const l = (n: number): Slot => outcomeOf(byNum[n] ?? fallback(n), predictions, 'loser')

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
