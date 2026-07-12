import { describe, it, expect } from 'vitest'
import { USERS } from '../../users'
import { tournamentResults } from '../../tournament-results'
import { computeUserPoints } from '../points'
import type { TournamentResults, KnockoutMatch } from '../../shared/types'
import {
  getRemaining,
  computeBaseTotals,
  projectStandings,
  projectProvisional,
  computeReachability,
  resolveScenario,
  remainingDelta,
  winnerOf,
  bootInfo,
  bootBonus,
  type ScenarioScores,
  type EnteredFlags,
} from './scenarios'

const info = getRemaining(tournamentResults)
const base = computeBaseTotals(USERS, tournamentResults)

// Build the real results with the four remaining matches filled in — the ground
// truth the fast incremental scorer must reproduce.
function buildHypo(sc: ScenarioScores): TournamentResults {
  const r = resolveScenario(info, sc)
  const mk = (m: (typeof r.matches)[number]): KnockoutMatch => ({ matchNum: m.matchNum, home: m.home, away: m.away, resolved: true, scores: m.scores })
  const ko = tournamentResults.knockoutStages
  return {
    ...tournamentResults,
    knockoutStages: {
      ...ko,
      sf: [mk(r.matches[0]), mk(r.matches[1])],
      thirdPlace: [mk(r.matches[2])],
      final: [mk(r.matches[3])],
    },
    champion: r.champion,
    thirdPlaceWinner: r.thirdWinner,
  }
}

describe('getRemaining', () => {
  it('detects the final four with the real semi line-ups', () => {
    expect(info.valid).toBe(true)
    expect(info.sf.flatMap(s => s.teams).sort()).toEqual(['Argentina', 'England', 'France', 'Spain'].sort())
    expect(info.anyRemaining).toBe(true)
  })
})

describe('incremental scorer matches the real points engine', () => {
  const scenarios: ScenarioScores[] = [
    { sf: [{ home: 2, away: 1 }, { home: 1, away: 0 }], final: { home: 3, away: 2 }, third: { home: 1, away: 1, drawWinner: 'home' } },
    { sf: [{ home: 0, away: 1 }, { home: 2, away: 2, drawWinner: 'away' }], final: { home: 0, away: 0, drawWinner: 'home' }, third: { home: 4, away: 1 } },
    { sf: [{ home: 1, away: 1, drawWinner: 'away' }, { home: 3, away: 0 }], final: { home: 2, away: 1 }, third: { home: 0, away: 2 } },
  ]
  it('base + remainingDelta === computeUserPoints for every bettor & scenario', () => {
    for (const sc of scenarios) {
      const hypo = buildHypo(sc)
      const r = resolveScenario(info, sc)
      for (const u of USERS) {
        const full = computeUserPoints(u, hypo).total
        const inc = (base.get(u.label) ?? 0) + remainingDelta(u, r, info)
        expect(inc, `${u.label} / ${JSON.stringify(sc)}`).toBe(full)
      }
    }
  })
})

describe('winnerOf', () => {
  it('reads the advancer on a level scoreline', () => {
    expect(winnerOf('A', 'B', { home: 1, away: 1, drawWinner: 'away' })).toBe('B')
    expect(winnerOf('A', 'B', { home: 2, away: 1 })).toBe('A')
  })
})

describe('projectStandings', () => {
  it('ranks by projected total under the chosen scoreline', () => {
    const [a, b] = info.sf
    // France beat Spain 2-1, England beat Argentina 1-0, France win the final, Spain take third.
    const sc: ScenarioScores = { sf: [{ home: 2, away: 1 }, { home: 1, away: 0 }], final: { home: 1, away: 0 }, third: { home: 2, away: 1 } }
    // sanity: this scenario has France & England as finalists, France champion
    const r = resolveScenario(info, sc)
    expect(new Set(r.finalists)).toEqual(new Set(['France', 'England']))
    expect(r.champion).toBe('France')
    const rows = projectStandings(USERS, base, info, sc)
    expect(rows[0].rank).toBe(1)
    expect(rows).toHaveLength(USERS.length)
    void a; void b
  })
})

describe('golden boot', () => {
  const bi = bootInfo(USERS, tournamentResults, info)

  it('picks the current leader (Mbappé) as the default projected winner', () => {
    expect(bi.leader).toBe('קיליאן אמבפה')
    expect(bi.goals['קיליאן אמבפה']).toBe(8)
  })

  it('keeps only real contenders — leaders + alive chasers within reach — dropping far-back picks', () => {
    const names = bi.options.map(o => o.name)
    expect(names).toContain('קיליאן אמבפה') // 8, leader
    expect(names).toContain('הארי קיין') // 6, alive, within 2 of the lead
    expect(names).not.toContain('לאמין ימאל') // 1, alive but way behind → irrelevant
    expect(names).not.toContain('פראן טורס') // 0 → irrelevant
    expect(names).not.toContain('קאי האברץ') // Germany, out and trailing
  })

  it('sweeps each relevant PICKED contender + null (an unpicked leader wins → nobody)', () => {
    expect(bi.sweep).toContain('קיליאן אמבפה')
    expect(bi.sweep).toContain('הארי קיין')
    expect(bi.sweep).toContain(null)
    expect(bi.sweep).not.toContain('לאמין ימאל')
  })

  it('surfaces unpicked real leaders (e.g. Messi) when a live race board is supplied', () => {
    const withRace = bootInfo(USERS, tournamentResults, info, {
      race: { 'קיליאן אמבפה': 8, 'ליאו מסי': 9 },
      teamByPlayer: { 'קיליאן אמבפה': 'France', 'ליאו מסי': 'Argentina' },
    })
    expect(withRace.leader).toBe('ליאו מסי') // sole leader, unpicked
    const messi = withRace.options.find(o => o.name === 'ליאו מסי')!
    expect(messi.picked).toBe(false)
    expect(messi.alive).toBe(true) // Argentina still in the semis
    // an unpicked leader is NOT a distinct sweep outcome — it collapses into null
    expect(withRace.sweep).not.toContain('ליאו מסי')
  })

  it('awards +10 to the winner’s backers only', () => {
    const kaneBacker = USERS.find(u => u.topGoalscorer === 'הארי קיין')!
    expect(bootBonus(kaneBacker, 'הארי קיין')).toBe(10)
    expect(bootBonus(kaneBacker, 'קיליאן אמבפה')).toBe(0)
    expect(bootBonus(kaneBacker, null)).toBe(0)
  })

  it('pays every backer when several winners tie at the top', () => {
    const kaneBacker = USERS.find(u => u.topGoalscorer === 'הארי קיין')!
    const mbappeBacker = USERS.find(u => u.topGoalscorer === 'קיליאן אמבפה')!
    const tied = ['הארי קיין', 'קיליאן אמבפה']
    expect(bootBonus(kaneBacker, tied)).toBe(10)
    expect(bootBonus(mbappeBacker, tied)).toBe(10)
    // someone who backed a third player still gets nothing
    const other = USERS.find(u => !tied.includes(u.topGoalscorer))!
    expect(bootBonus(other, tied)).toBe(0)
  })

  it('folds the +10 into projected totals for the selected winner', () => {
    const empty: EnteredFlags = { sf: [false, false], final: false, third: false }
    const sc: ScenarioScores = { sf: [{ home: null, away: null }, { home: null, away: null }], final: { home: null, away: null }, third: { home: null, away: null } }
    const withKane = projectProvisional(USERS, base, info, sc, empty, 'הארי קיין')
    const kaneUser = USERS.find(u => u.topGoalscorer === 'הארי קיין')!
    const row = withKane.find(r => r.label === kaneUser.label)!
    expect(row.boot).toBe(10)
    expect(row.pts).toBe((base.get(kaneUser.label) ?? 0) + 10)
    const mbappeUser = USERS.find(u => u.topGoalscorer === 'קיליאן אמבפה')!
    expect(withKane.find(r => r.label === mbappeUser.label)!.boot).toBe(0)
  })

  it('sweeping the boot never shrinks who can reach #1', () => {
    const noBoot = computeReachability(USERS, base, info)
    const withBoot = computeReachability(USERS, base, info, bi.sweep)
    const a = new Set(noBoot.contenders.map(c => c.label))
    for (const label of a) expect(withBoot.stats.get(label)!.canWin).toBe(true)
    expect(withBoot.contenders.length).toBeGreaterThanOrEqual(noBoot.contenders.length)
  })
})

describe('computeReachability (with scorelines)', () => {
  const reach = computeReachability(USERS, base, info)

  it('finds the three real title contenders — including Klein', () => {
    const names = reach.contenders.map(c => c.label)
    expect(names).toContain('יונתן קרני')
    expect(names).toContain('ליאור מולדובן')
    expect(names).toContain('יניב קליין') // scorelines put Klein within reach of #1
    expect(names).toHaveLength(3)
  })

  it('gives Klein a reachable #1', () => {
    expect(reach.stats.get('יניב קליין')!.canWin).toBe(true)
  })

  it('surfaces a broad top-3 and top-5 bubble (scorelines matter)', () => {
    const top3 = [...reach.stats.values()].filter(s => s.canTop3).length
    const top5 = [...reach.stats.values()].filter(s => s.canTop5).length
    expect(top3).toBeGreaterThanOrEqual(8)
    expect(top5).toBeGreaterThan(top3)
  })
})
