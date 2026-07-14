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

// A match that's already been played keeps its real score — scenarios can only
// vary the still-open matches (the UI locks decided ones the same way).
function lockDecided(sc: ScenarioScores): ScenarioScores {
  return {
    sf: [info.sf[0].scores ?? sc.sf[0], info.sf[1].scores ?? sc.sf[1]],
    final: info.finalScores ?? sc.final,
    third: info.thirdScores ?? sc.third,
  }
}

// Build the real results with the remaining matches filled in — the ground
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
  })
})

describe('incremental scorer matches the real points engine', () => {
  const scenarios: ScenarioScores[] = [
    { sf: [{ home: 2, away: 1 }, { home: 1, away: 0 }], final: { home: 3, away: 2 }, third: { home: 1, away: 1, drawWinner: 'home' } },
    { sf: [{ home: 0, away: 1 }, { home: 2, away: 2, drawWinner: 'away' }], final: { home: 0, away: 0, drawWinner: 'home' }, third: { home: 4, away: 1 } },
    { sf: [{ home: 1, away: 1, drawWinner: 'away' }, { home: 3, away: 0 }], final: { home: 2, away: 1 }, third: { home: 0, away: 2 } },
  ]
  it('base + remainingDelta === computeUserPoints for every bettor & scenario', () => {
    for (const raw of scenarios) {
      const sc = lockDecided(raw)
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
    // Already-played matches keep their real score; the rest get hypothetical ones.
    const sc: ScenarioScores = lockDecided({ sf: [{ home: 2, away: 1 }, { home: 1, away: 0 }], final: { home: 1, away: 0 }, third: { home: 2, away: 1 } })
    // sanity: one finalist per semi, champion from the final pair, medal from the losers
    const r = resolveScenario(info, sc)
    expect(info.sf[0].teams).toContain(r.finalists[0])
    expect(info.sf[1].teams).toContain(r.finalists[1])
    expect(r.finalists).toContain(r.champion)
    expect(r.losers).toContain(r.thirdWinner)
    const rows = projectStandings(USERS, base, info, sc)
    expect(rows.map(x => x.rank)).toEqual(rows.map((_, i) => i + 1))
    expect(rows).toHaveLength(USERS.length)
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].pts).toBeGreaterThanOrEqual(rows[i].pts)
  })
})

describe('golden boot', () => {
  const bi = bootInfo(USERS, tournamentResults, info)

  it('picks the current top scorer as the default projected winner', () => {
    const lead = Math.max(0, ...Object.values(bi.goals))
    expect(bi.leader).toBeTruthy()
    expect(bi.goals[bi.leader!]).toBe(lead)
    // options come sorted by goals, leader first
    expect(bi.options[0].name).toBe(bi.leader)
    const goals = bi.options.map(o => o.goals)
    expect([...goals].sort((x, y) => y - x)).toEqual(goals)
  })

  it('keeps only real contenders — leaders + alive chasers within reach — dropping far-back picks', () => {
    const lead = Math.max(0, ...Object.values(bi.goals))
    expect(bi.options.length).toBeGreaterThan(0)
    // everyone in: at the lead, or still playing and within the ~2-goal reachable gap
    for (const o of bi.options) {
      expect(o.goals >= lead || (o.alive && o.goals >= lead - 2), `${o.name} (${o.goals}) shouldn't be an option`).toBe(true)
    }
    // everyone out: strictly behind the lead
    const inOptions = new Set(bi.options.map(o => o.name))
    for (const [name, g] of Object.entries(bi.goals)) {
      if (!inOptions.has(name)) expect(g, `${name} left out despite leading`).toBeLessThan(lead)
    }
  })

  it('sweeps each relevant PICKED contender + null (an unpicked leader wins → nobody)', () => {
    // the sweep is exactly the picked options (order kept) plus the "nobody" outcome
    expect(bi.sweep).toEqual([...bi.options.filter(o => o.picked).map(o => o.name), null])
  })

  it('surfaces unpicked real leaders (e.g. Messi) when a live race board is supplied', () => {
    // put Messi one goal clear of whatever the real lead is, so he's the sole leader
    const lead = Math.max(0, ...Object.values(tournamentResults.playerGoals ?? {}))
    const withRace = bootInfo(USERS, tournamentResults, info, {
      race: { 'ליאו מסי': lead + 1 },
      teamByPlayer: { 'ליאו מסי': 'Argentina' },
    })
    expect(withRace.leader).toBe('ליאו מסי') // sole leader, unpicked
    const messi = withRace.options.find(o => o.name === 'ליאו מסי')!
    expect(messi.picked).toBe(false)
    expect(messi.alive).toBe(true) // Argentina reached the semis, so they play to the end
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

  it('has Karni as the only remaining title contender after Spain took SF1', () => {
    // Locked results only shrink the outcome space, so this holds through the final.
    const names = reach.contenders.map(c => c.label)
    expect(names).toEqual(['יונתן קרני'])
    expect(reach.stats.get('יונתן קרני')!.minRank).toBe(1)
  })

  it('keeps ranks and bubbles internally consistent in any tournament state', () => {
    const all = [...reach.stats.values()]
    for (const s of all) {
      expect(s.minRank, s.label).toBeLessThanOrEqual(s.maxRank)
      expect(s.canWin, s.label).toBe(s.minRank === 1)
      if (s.canWin) expect(s.canTop3, s.label).toBe(true)
      if (s.canTop3) expect(s.canTop5, s.label).toBe(true)
      if (s.lockedTop3) expect(s.canTop3, s.label).toBe(true)
    }
    // each podium/top-5 spot is filled by someone in every scenario
    const top3 = all.filter(s => s.canTop3).length
    const top5 = all.filter(s => s.canTop5).length
    expect(top3).toBeGreaterThanOrEqual(3)
    expect(top5).toBeGreaterThanOrEqual(Math.min(5, all.length))
    expect(top5).toBeGreaterThanOrEqual(top3)
    // contenders are exactly the canWin set
    expect(reach.contenders.map(c => c.label).sort()).toEqual(all.filter(s => s.canWin).map(s => s.label).sort())
  })
})
