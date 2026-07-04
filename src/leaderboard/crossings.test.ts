import { describe, it, expect } from 'vitest'
import { computeUserCrossings, crossingBreakdown, computeDeterminedCrossings, computeCrossingsSummary, rankedCrossingsSummary, summaryTotals, defaultCrossingsRound } from './crossings'
import type { Crossing, CrossingsBettor } from './crossings'
import type { KnockoutStages, MatchScores } from '../shared/types'
import type { KnockoutMatch } from '../shared/types'

// Real teams are TEAMS keys; unresolved slots are Hebrew placeholders.
const km = (matchNum: number, home: string, away: string): KnockoutMatch => ({
  matchNum,
  home,
  away,
  resolved: false,
})

describe('defaultCrossingsRound', () => {
  const scored = (matchNum: number, scores: MatchScores): KnockoutMatch => ({ ...km(matchNum, 'A', 'B'), scores })
  const emptyStages = (): KnockoutStages => ({ r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] })

  it('falls back to the round of 32 before any knockout is populated', () => {
    expect(defaultCrossingsRound(undefined)).toBe('r32')
    expect(defaultCrossingsRound(emptyStages())).toBe('r32')
  })

  it('stays on the round of 32 while it still has an unplayed match', () => {
    const stages = emptyStages()
    stages.r32 = [scored(73, { home: 1, away: 0 }), km(74, 'A', 'B')]
    expect(defaultCrossingsRound(stages)).toBe('r32')
  })

  it('advances to the round of 16 once every round-of-32 match is played', () => {
    const stages = emptyStages()
    stages.r32 = [scored(73, { home: 1, away: 0 }), scored(74, { home: 2, away: 1 })]
    stages.r16 = [km(89, 'A', 'B')] // populated, not yet played
    expect(defaultCrossingsRound(stages)).toBe('r16')
  })

  it('ignores the third-place side match so it never steals focus from the final', () => {
    const stages = emptyStages()
    stages.r32 = [scored(73, { home: 1, away: 0 })]
    stages.r16 = [scored(89, { home: 1, away: 0 })]
    stages.qf = [scored(97, { home: 1, away: 0 })]
    stages.sf = [scored(101, { home: 1, away: 0 })]
    stages.thirdPlace = [km(103, 'A', 'B')]
    stages.final = [km(104, 'A', 'B')]
    expect(defaultCrossingsRound(stages)).toBe('final')
  })
})

describe('computeUserCrossings', () => {
  it('locks a crossing where both predicted teams already reached the slot', () => {
    const actual = [km(73, 'Mexico', 'Canada')]
    const user = [km(73, 'Canada', 'Mexico')] // sides reversed — still the same crossing
    const { locked, potential } = computeUserCrossings(user, actual)
    expect(potential).toHaveLength(0)
    expect(locked).toHaveLength(1)
    expect(locked[0].matchNum).toBe(73)
    expect(locked[0].teams.every(t => t.confirmed)).toBe(true)
    expect(locked[0].pendingSlots).toEqual([])
  })

  it('keeps a half-confirmed crossing as potential and flags the pending slot', () => {
    const actual = [km(75, 'Brazil', 'סגנית ו')] // Brazil in, other side open
    const user = [km(75, 'Brazil', 'Netherlands')]
    const { locked, potential } = computeUserCrossings(user, actual)
    expect(locked).toHaveLength(0)
    expect(potential).toHaveLength(1)
    expect(potential[0].pendingSlots).toEqual(['סגנית ו'])
    const byTeam = Object.fromEntries(potential[0].teams.map(t => [t.team, t.confirmed]))
    expect(byTeam).toEqual({ Brazil: true, Netherlands: false })
  })

  it('locks a half-open crossing the sim makes inevitable (100%), flagged certain', () => {
    const actual = [km(75, 'Brazil', 'סגנית ו')] // slot not formally filled
    const user = [km(75, 'Brazil', 'Netherlands')]
    const probByMatch = { 75: { 'Brazil|Netherlands': 1 } } // forced in every scenario
    const { locked, potential } = computeUserCrossings(user, actual, probByMatch)
    expect(potential).toHaveLength(0)
    expect(locked).toHaveLength(1)
    expect(locked[0].matchNum).toBe(75)
    expect(locked[0].certain).toBe(true)
  })

  it('leaves a merely near-certain (99.9%) crossing open, not locked', () => {
    const actual = [km(75, 'Brazil', 'סגנית ו')]
    const user = [km(75, 'Brazil', 'Netherlands')]
    const probByMatch = { 75: { 'Brazil|Netherlands': 0.999 } }
    const { locked, potential } = computeUserCrossings(user, actual, probByMatch)
    expect(locked).toHaveLength(0)
    expect(potential).toHaveLength(1)
  })

  it('keeps a wide-open crossing (neither side resolved) as potential', () => {
    const actual = [km(79, 'מנצח א', 'שלישית א/ב/ג')]
    const user = [km(79, 'Mexico', 'Brazil')]
    const { potential } = computeUserCrossings(user, actual)
    expect(potential).toHaveLength(1)
    expect(potential[0].teams.every(t => !t.confirmed)).toBe(true)
    expect(potential[0].pendingSlots).toEqual(['מנצח א', 'שלישית א/ב/ג'])
  })

  it('locks a pairing the bettor predicted at a different slot than reality routed it', () => {
    // Reality routes Portugal × Croatia through slot 83; the bettor predicted that
    // exact pairing at slot 87. Scoring (koMatchPoints) credits a pairing wherever the
    // two teams meet, so the crossing is locked — not broken — even at a different slot.
    const actual = [km(83, 'Portugal', 'Croatia'), km(87, 'Colombia', 'שלישית ד')]
    const user = [km(87, 'Portugal', 'Croatia'), km(83, 'Colombia', 'Ghana')]
    const { locked, missed } = computeUserCrossings(user, actual)
    const pc = locked.find(c => c.teams.some(t => t.team === 'Portugal'))
    expect(pc).toBeDefined()
    expect(pc!.matchNum).toBe(83) // keyed to where the pairing actually lives
    expect(pc!.teams.every(t => t.confirmed)).toBe(true)
    // and it must NOT be reported as a broken crossing
    expect(missed.some(c => c.teams.some(t => t.team === 'Portugal'))).toBe(false)
  })

  it('keeps a slot-swapped crossing potential while its real slot is still open', () => {
    // Reality routes Portugal × Croatia through slot 83 (already settled) and is heading
    // toward Colombia × Ghana at slot 87 — but 87's away side is still a third-place
    // placeholder. The bettor predicted the two pairings at swapped slots (Colombia/Ghana
    // at 83, Portugal/Croatia at 87). Colombia/Ghana must NOT be judged against slot 83's
    // settled Portugal × Croatia — Colombia is on track at its real slot 87, Ghana pending.
    const actual = [km(83, 'Portugal', 'Croatia'), km(87, 'Colombia', 'שלישית ד')]
    const user = [km(87, 'Portugal', 'Croatia'), km(83, 'Colombia', 'Ghana')]
    const { locked, potential, missed } = computeUserCrossings(user, actual)
    expect(locked.some(c => c.teams.some(t => t.team === 'Portugal'))).toBe(true)
    const cg = potential.find(c => c.teams.some(t => t.team === 'Colombia'))
    expect(cg).toBeDefined()
    expect(cg!.matchNum).toBe(87) // anchored to where Colombia really is, not the routed slot
    expect(missed.some(c => c.teams.some(t => t.team === 'Ghana'))).toBe(false)
  })

  it('breaks a pairing whose two teams reached the round in different matches', () => {
    // Both Switzerland and Spain are in R32, but in different slots (each awaiting a
    // third-place opponent). A bettor who paired them together can never see it happen.
    const actual = [km(84, 'Spain', 'שלישית א'), km(85, 'Switzerland', 'שלישית ב')]
    const user = [km(84, 'Spain', 'Switzerland')]
    const { locked, potential, missed } = computeUserCrossings(user, actual)
    expect(locked).toHaveLength(0)
    expect(potential).toHaveLength(0)
    expect(missed).toHaveLength(1)
  })

  it('marks a crossing broken by a confirmed team the bettor did not pick as missed', () => {
    const actual = [km(76, 'Brazil', 'סגנית ג')] // Brazil confirmed, bettor paired neither
    const user = [km(76, 'Mexico', 'Canada')]
    const { locked, potential, missed } = computeUserCrossings(user, actual)
    expect(locked).toHaveLength(0)
    expect(potential).toHaveLength(0)
    expect(missed).toHaveLength(1)
    expect(missed[0].matchNum).toBe(76)
    expect(missed[0].actualTeams).toEqual(['Brazil']) // the real team that landed
  })

  it('marks a fully-resolved crossing the bettor got wrong as missed', () => {
    const actual = [km(73, 'Mexico', 'Canada')]
    const user = [km(73, 'Brazil', 'Spain')]
    const { locked, potential, missed } = computeUserCrossings(user, actual)
    expect(locked).toHaveLength(0)
    expect(potential).toHaveLength(0)
    expect(missed).toHaveLength(1)
    expect(missed[0].actualTeams).toEqual(['Mexico', 'Canada'])
  })

  it('accounts for every match: locked + potential + missed covers all', () => {
    const actual = [
      km(73, 'Mexico', 'Canada'),     // locked
      km(75, 'Brazil', 'סגנית ו'),    // potential
      km(76, 'Brazil', 'סגנית ג'),    // missed
    ]
    const user = [
      km(73, 'Mexico', 'Canada'),
      km(75, 'Brazil', 'Netherlands'),
      km(76, 'Mexico', 'Canada'),
    ]
    const { locked, potential, missed } = computeUserCrossings(user, actual)
    expect(locked.length + potential.length + missed.length).toBe(3)
  })

  it('skips actual matches the bettor has no prediction for', () => {
    const actual = [km(73, 'Mexico', 'Canada')]
    const { locked, potential } = computeUserCrossings([], actual)
    expect(locked).toHaveLength(0)
    expect(potential).toHaveLength(0)
  })

  it('captures the bettor predicted scoreline, oriented to their home/away', () => {
    const actual = [km(73, 'Mexico', 'Canada')]
    const user: KnockoutMatch[] = [
      { matchNum: 73, home: 'Mexico', away: 'Canada', resolved: false, scores: { home: 2, away: 1 } },
    ]
    const { locked } = computeUserCrossings(user, actual)
    expect(locked[0].predicted).toEqual({ home: 2, away: 1 })
  })

  it('leaves predicted null when the bettor left the knockout score blank', () => {
    const actual = [km(73, 'Mexico', 'Canada')]
    const user = [km(73, 'Mexico', 'Canada')] // km() has no scores
    const { locked } = computeUserCrossings(user, actual)
    expect(locked[0].predicted).toBeNull()
  })

  it('breaks the chance into each team reaching the match plus the joint', () => {
    const crossing = {
      matchNum: 75,
      teams: [{ team: 'Brazil', confirmed: true }, { team: 'Netherlands', confirmed: false }],
      pendingSlots: ['x'],
      predicted: null,
    } as Crossing
    const probByMatch = {
      75: { 'Brazil|Netherlands': 0.3, 'Brazil|Germany': 0.5, 'France|Netherlands': 0.2 },
    }
    const bd = crossingBreakdown(crossing, probByMatch)!
    expect(bd.reachA).toBeCloseTo(0.8) // Brazil appears in 0.3 + 0.5 of runs
    expect(bd.reachB).toBeCloseTo(0.5) // Netherlands in 0.3 + 0.2
    expect(bd.joint).toBeCloseTo(0.3)  // the two together
  })

  it('tells each open team which bracket slot it must finish in', () => {
    const actual = [km(75, 'Brazil', 'סגנית ו')] // Brazil in, the away side still open
    const user = [km(75, 'Brazil', 'Netherlands')]
    const { potential } = computeUserCrossings(user, actual)
    const byTeam = Object.fromEntries(potential[0].teams.map(t => [t.team, t]))
    expect(byTeam.Brazil.confirmed).toBe(true)
    expect(byTeam.Brazil.needsSlot).toBeUndefined()
    expect(byTeam.Netherlands.confirmed).toBe(false)
    expect(byTeam.Netherlands.needsSlot).toBe('סגנית ו') // exactly what it must become
  })

  it('orders potential crossings most-resolved first, then by matchNum', () => {
    const actual = [
      km(80, 'מנצח ב', 'שלישית ד'),      // both open
      km(75, 'Brazil', 'סגנית ו'),       // one confirmed
      km(79, 'Spain', 'שלישית א/ב/ג'),   // one confirmed, lower matchNum
    ]
    const user = [
      km(80, 'Mexico', 'Canada'),
      km(75, 'Brazil', 'Netherlands'),
      km(79, 'Spain', 'Germany'),
    ]
    const { potential } = computeUserCrossings(user, actual)
    expect(potential.map(c => c.matchNum)).toEqual([75, 79, 80])
  })
})

describe('computeUserCrossings finished results', () => {
  it('leaves result undefined on a locked crossing with no real score supplied', () => {
    const actual = [km(73, 'Mexico', 'Canada')]
    const user = [km(73, 'Mexico', 'Canada')]
    const { locked } = computeUserCrossings(user, actual)
    expect(locked[0].result).toBeUndefined()
  })

  it('attaches a scored result (real score, advancer, points) once the match is played', () => {
    const actual = [km(73, 'Mexico', 'Canada')]
    const user: KnockoutMatch[] = [
      { matchNum: 73, home: 'Mexico', away: 'Canada', resolved: false, scores: { home: 2, away: 1 } },
    ]
    const scores = { 73: { home: 2, away: 1 } } // Mexico 2-1 — exactly what the bettor called
    const { locked } = computeUserCrossings(user, actual, {}, scores)
    const r = locked[0].result!
    expect(r).toMatchObject({
      home: 'Mexico', away: 'Canada', homeScore: 2, awayScore: 1,
      advancer: 'Mexico', predHome: 2, predAway: 1, outcome: 'tzelifa', points: 7,
    })
  })

  it('re-orients a reversed prediction to the real fixture before scoring it', () => {
    // Reality's fixture is Mexico (home) × Canada (away); the bettor listed the pair
    // reversed — Canada (home) 1 × Mexico (away) 2, i.e. still "Mexico beats Canada 2-1".
    const actual = [km(73, 'Mexico', 'Canada')]
    const user: KnockoutMatch[] = [
      { matchNum: 73, home: 'Canada', away: 'Mexico', resolved: false, scores: { home: 1, away: 2 } },
    ]
    const scores = { 73: { home: 2, away: 1 } } // real: Mexico 2-1 Canada
    const { locked } = computeUserCrossings(user, actual, {}, scores)
    const r = locked[0].result!
    // predicted re-expressed in Mexico/Canada terms: 2-1 → exact hit, full points
    expect(r.predHome).toBe(2)
    expect(r.predAway).toBe(1)
    expect(r.advancer).toBe('Mexico')
    expect(r.outcome).toBe('tzelifa')
    expect(r.points).toBe(7)
  })

  it('scores a wrong winner as a miss worth zero, still showing the real result', () => {
    const actual = [km(73, 'Mexico', 'Canada')]
    const user: KnockoutMatch[] = [
      { matchNum: 73, home: 'Mexico', away: 'Canada', resolved: false, scores: { home: 3, away: 0 } },
    ]
    const scores = { 73: { home: 0, away: 2 } } // real: Canada win 0-2
    const { locked } = computeUserCrossings(user, actual, {}, scores)
    const r = locked[0].result!
    expect(r.homeScore).toBe(0)
    expect(r.awayScore).toBe(2)
    expect(r.advancer).toBe('Canada')
    expect(r.outcome).toBe('miss')
    expect(r.points).toBe(0)
  })
})

describe('computeDeterminedCrossings', () => {
  const bettor = (label: string, r32: KnockoutMatch[]): CrossingsBettor => ({
    label,
    knockoutStages: { r32, r16: [], qf: [], sf: [], thirdPlace: [], final: [] } as never,
  })

  it('lists a fully-determined pairing and a partial (one-team) slot side by side', () => {
    const actual = [
      km(73, 'Mexico', 'Canada'),    // both real -> determined pairing
      km(75, 'Brazil', 'סגנית ו'),   // one real -> partial (Brazil already advanced)
    ]
    const out = computeDeterminedCrossings([bettor('דני', actual)], actual)
    const det = out.find(d => d.matchNum === 73)!
    expect(det.partial).toBeFalsy()
    expect(det.teams).toEqual(['Mexico', 'Canada'])
    const part = out.find(d => d.matchNum === 75)!
    expect(part.partial).toBe(true)
    expect(part.teams).toEqual(['Brazil'])
  })

  it('collects everyone who predicted the exact pairing, side-agnostic', () => {
    const actual = [km(73, 'Mexico', 'Canada')]
    const bettors = [
      bettor('דני', [km(73, 'Mexico', 'Canada')]),
      bettor('רוני', [km(73, 'Canada', 'Mexico')]),  // reversed — same crossing
      bettor('יוסי', [km(73, 'Brazil', 'Spain')]),   // different pairing
    ]
    const out = computeDeterminedCrossings(bettors, actual)
    expect(out[0].predictors).toEqual(['דני', 'רוני'])
  })

  it('counts a bettor who predicted the pairing at a different slot in the same round', () => {
    // Reality routes Portugal × Croatia through slot 83; this bettor predicted the
    // exact same pairing but slotted it at 87 (different group finishes, same meeting).
    const actual = [km(83, 'Portugal', 'Croatia')]
    const bettors = [
      bettor('ליכטר', [km(87, 'Portugal', 'Croatia'), km(83, 'Colombia', 'Ghana')]),
    ]
    const out = computeDeterminedCrossings(bettors, actual)
    expect(out[0].predictors).toEqual(['ליכטר'])
  })

  it('does not count a pairing the bettor predicted in a different round', () => {
    // Same two teams, but the bettor put their meeting in R16 (89), not R32 — that's
    // a different prediction, so it shouldn't count toward the R32 crossing.
    const actual = [km(83, 'Portugal', 'Croatia')]
    const bettors: CrossingsBettor[] = [
      { label: 'דני', knockoutStages: { r32: [], r16: [km(89, 'Portugal', 'Croatia')], qf: [], sf: [], thirdPlace: [], final: [] } as never },
    ]
    const out = computeDeterminedCrossings(bettors, actual)
    expect(out[0].predictors).toEqual([])
  })

  it('sorts by predictor count, most-called first', () => {
    const actual = [km(73, 'Mexico', 'Canada'), km(74, 'Brazil', 'Spain')]
    const bettors = [
      bettor('א', [km(73, 'Mexico', 'Canada'), km(74, 'Brazil', 'Spain')]),
      bettor('ב', [km(74, 'Brazil', 'Spain')]),
      bettor('ג', [km(74, 'Brazil', 'Spain')]),
    ]
    const out = computeDeterminedCrossings(bettors, actual)
    expect(out.map(d => d.matchNum)).toEqual([74, 73]) // 74 has 3 callers, 73 has 1
  })

  it('keeps a determined pairing nobody called, with an empty predictors list', () => {
    const actual = [km(73, 'Mexico', 'Canada')]
    const out = computeDeterminedCrossings([bettor('דני', [km(73, 'Brazil', 'Spain')])], actual)
    expect(out).toHaveLength(1)
    expect(out[0].predictors).toEqual([])
  })

  it('includes a 100%-certain matchup even when the bracket slot is still open', () => {
    const actual = [km(75, 'Brazil', 'סגנית ו')] // slot not formally filled
    const probByMatch = { 75: { 'Brazil|Netherlands': 1 } } // the sim makes it inevitable
    const out = computeDeterminedCrossings([bettor('דני', [km(75, 'Brazil', 'Netherlands')])], actual, probByMatch)
    expect(out).toHaveLength(1)
    expect(out[0].matchNum).toBe(75)
    expect(out[0].teams.slice().sort()).toEqual(['Brazil', 'Netherlands'])
    expect(out[0].certain).toBe(true)
    expect(out[0].predictors).toEqual(['דני'])
  })

  it('shows a near-certain (99.9%) open slot as a partial, not a locked pairing', () => {
    const actual = [km(75, 'Brazil', 'סגנית ו')]
    const probByMatch = { 75: { 'Brazil|Netherlands': 0.999 } } // all but sealed, not 100%
    const out = computeDeterminedCrossings([bettor('דני', [km(75, 'Brazil', 'Netherlands')])], actual, probByMatch)
    expect(out).toHaveLength(1)
    expect(out[0].partial).toBe(true)
    expect(out[0].certain).toBeFalsy()
    expect(out[0].teams).toEqual(['Brazil'])
  })

  it('emits a partial slot (predictors empty) when only one side is a real team', () => {
    const actual = [km(75, 'Brazil', 'סגנית ו')]
    const out = computeDeterminedCrossings([bettor('דני', [km(75, 'Brazil', 'Netherlands')])], actual)
    expect(out).toHaveLength(1)
    expect(out[0].partial).toBe(true)
    expect(out[0].teams).toEqual(['Brazil'])
    expect(out[0].predictors).toEqual([])
  })

  it('attaches the real result (score + advancer) to a determined pairing that was played', () => {
    const actual = [km(73, 'Mexico', 'Canada')]
    const scores = { 73: { home: 0, away: 3 } } // Canada wins 3-0
    const out = computeDeterminedCrossings([bettor('דני', actual)], actual, {}, scores)
    expect(out[0].result).toBeDefined()
    expect(out[0].result!.homeScore).toBe(0)
    expect(out[0].result!.awayScore).toBe(3)
    expect(out[0].result!.advancer).toBe('Canada')
  })
})

describe('computeCrossingsSummary', () => {
  const bettorOn = (label: string, stages: Partial<Record<keyof KnockoutStages, KnockoutMatch[]>>): CrossingsBettor => ({
    label,
    knockoutStages: { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [], ...stages } as never,
  })

  it('splits each bettor into already-played, still-guaranteed, and still-possible across all rounds', () => {
    const bracket = [
      km(73, 'Mexico', 'Canada'),     // r32, both real, played -> already participated
      km(75, 'Brazil', 'Netherlands'), // r32, both real, not played -> will participate
      km(89, 'France', 'סגנית ו'),     // r16, one real -> may participate (potential)
    ]
    const bettor = bettorOn('דני', {
      r32: [km(73, 'Mexico', 'Canada'), km(75, 'Brazil', 'Netherlands')],
      r16: [km(89, 'France', 'Germany')],
    })
    const actualScoreByNum = { 73: { home: 2, away: 1 } } // only match 73 has been played

    const [row] = computeCrossingsSummary([bettor], bracket, {}, actualScoreByNum)
    // the per-stage split is the stored data — only stages with involvement, in order
    expect(row.byStage).toEqual([
      { key: 'r32', played: 1, guaranteed: 1, possible: 0 },
      { key: 'r16', played: 0, guaranteed: 0, possible: 1 },
    ])
    // the tournament totals are a fold over it, not a stored (drift-prone) field
    expect(summaryTotals(row)).toEqual({ played: 1, guaranteed: 1, possible: 1 })
  })

  it('ranks bettors by their guaranteed involvement (played + locked) first', () => {
    const bracket = [km(73, 'Mexico', 'Canada'), km(74, 'Brazil', 'Spain')]
    const involved = bettorOn('מעורב', { r32: [km(73, 'Mexico', 'Canada'), km(74, 'Brazil', 'Spain')] })
    const bystander = bettorOn('צופה', { r32: [km(73, 'Germany', 'Italy')] }) // pairing broke
    // computation is order-agnostic; ranking is a separate, explicit step
    const out = rankedCrossingsSummary(computeCrossingsSummary([bystander, involved], bracket))
    expect(out.map(s => s.label)).toEqual(['מעורב', 'צופה'])
    expect(summaryTotals(out[0]).guaranteed).toBe(2)
  })
})
