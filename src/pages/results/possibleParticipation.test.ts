import { describe, it, expect } from 'vitest'
import type { KnockoutMatch, KnockoutStages, TournamentResults } from '../../shared/types'
import type { User } from '../../users'
import { possibleParticipation } from './possibleParticipation'

// A minimal real bracket where the group stage is done (so every R32 fixture
// carries real teams) but no knockout match has been played yet. The four R32
// matches this suite reasons about (73–76) carry real team names; the rest are
// filled with synthetic placeholders that never match a pick. Every later round
// is an unresolved placeholder — exactly the shape the results page hands us
// while the round of 32 is still to be played.
const R32_TEAMS: Record<number, [string, string]> = {
  73: ['Brazil', 'Argentina'],
  74: ['Spain', 'Portugal'],
  75: ['France', 'Germany'],
  76: ['England', 'Netherlands'],
}

function realBracket(): KnockoutStages {
  const r32: KnockoutMatch[] = []
  for (let n = 73; n <= 88; n++) {
    const [home, away] = R32_TEAMS[n] ?? [`Team${n}h`, `Team${n}a`]
    r32.push({ matchNum: n, home, away, resolved: true })
  }
  const ph = (lo: number, hi: number): KnockoutMatch[] => {
    const out: KnockoutMatch[] = []
    for (let n = lo; n <= hi; n++) out.push({ matchNum: n, home: `מנצח ${n}`, away: `מנצח ${n}`, resolved: false })
    return out
  }
  return {
    r32,
    r16: ph(89, 96),
    qf: ph(97, 100),
    sf: ph(101, 102),
    thirdPlace: ph(103, 103),
    final: ph(104, 104),
  }
}

function results(bracket: KnockoutStages): TournamentResults {
  return {
    groupMatches: {},
    groupTables: {},
    thirdPlaceQualification: { resolved: false, all: [], tied: [] },
    knockoutStages: bracket,
  }
}

// A user whose knockout bracket we control directly. Only the fields
// possibleParticipation reads need to be present.
function user(knockoutStages: Partial<KnockoutStages>): User {
  const empty: KnockoutStages = { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] }
  return {
    label: 'טסט',
    knockoutStages: { ...empty, ...knockoutStages },
  } as unknown as User
}

const koMatch = (matchNum: number, home: string, away: string): KnockoutMatch => ({
  matchNum, home, away, resolved: true,
})

describe('possibleParticipation', () => {
  it('flags an unresolved R16 slot when both predicted teams are alive and meet there', () => {
    // Real R16 match 90 is fed by R32 matches 73 (Brazil) and 75 (France). A
    // bettor who predicted Brazil vs France in the round of 16 can still land that
    // pairing at slot 90 — both teams are alive and their real paths converge there.
    const u = user({ r16: [koMatch(90, 'Brazil', 'France')] })
    const { ids, predictions } = possibleParticipation(u, results(realBracket()))
    expect(ids.has('90')).toBe(true)
    expect(predictions['90']).toMatchObject({ home: 'Brazil', away: 'France' })
  })

  it('does not flag a slot once one of the predicted teams is eliminated', () => {
    // Brazil lost its R32 tie (73), so the R16 pairing can never happen.
    const bracket = realBracket()
    bracket.r32 = bracket.r32.map(m =>
      m.matchNum === 73 ? { ...m, resolved: true, scores: { home: 0, away: 1 } } : m)
    const u = user({ r16: [koMatch(90, 'Brazil', 'France')] })
    const { ids } = possibleParticipation(u, results(bracket))
    expect(ids.has('90')).toBe(false)
  })

  it('does not flag a pairing whose teams actually meet in a different round', () => {
    // Brazil (73) and France (75) really meet back in the round of 16 (slot 90),
    // so a bettor who predicted them in the quarter-finals can never land that
    // pairing there — that meeting is spent a round earlier.
    const u = user({ qf: [koMatch(97, 'Brazil', 'France')] })
    const { ids } = possibleParticipation(u, results(realBracket()))
    expect(ids.size).toBe(0)
  })

  it('ignores already-resolved matches (those are the domain of the "משתתף" marker)', () => {
    const bracket = realBracket()
    bracket.r16 = bracket.r16.map(m =>
      m.matchNum === 90 ? { ...m, home: 'Brazil', away: 'France', resolved: true } : m)
    const u = user({ r16: [koMatch(90, 'Brazil', 'France')] })
    const { ids } = possibleParticipation(u, results(bracket))
    expect(ids.has('90')).toBe(false)
  })

  it('flags the third-place slot when both predicted losing semi-finalists are alive in different halves', () => {
    // Brazil (73) sits in the left half of the draw (semi 101); England (76) in the
    // right half (semi 102). Each can reach and lose its own semi, then meet in the
    // third-place match — so the bettor's 103 pick is still on the table.
    const u = user({ thirdPlace: [koMatch(103, 'Brazil', 'England')] })
    const { ids, predictions } = possibleParticipation(u, results(realBracket()))
    expect(ids.has('103')).toBe(true)
    expect(predictions['103']).toMatchObject({ home: 'Brazil', away: 'England' })
  })

  it('does not flag third place when the two picks share a half (they cannot both be losing semi-finalists)', () => {
    // Brazil (73) and Spain (74) are both in the left half — they would meet in the
    // semi or earlier, so they can never be the two beaten semi-finalists at once.
    const u = user({ thirdPlace: [koMatch(103, 'Brazil', 'Spain')] })
    const { ids } = possibleParticipation(u, results(realBracket()))
    expect(ids.has('103')).toBe(false)
  })
})
