// @vitest-environment node
import { describe, expect, test } from 'vitest'
import type { KnockoutMatch, PredictionsState, Standing, TournamentResults } from './src/shared/types'
import { makeUser } from './src/leaderboard/testFixtures'
import { USERS } from './src/users'
import { realEliminations, effectiveEliminations, EFFECTIVE_OUT_EPS, eliminatedBackedPickInMatch, bracketSurvival, advancementSummary, reachAtRank, currentResults, simulateTournament, realGamesByTeam, explainMatchForUser, he, runSims, buildRows, compareRows, mergeSimAgg, podiumByAdvancer, pivotalMatches, rivalBackers } from './sim-core'
import { tournamentResults } from './src/tournament-results'
import { realPlayedState } from './src/leaderboard/winprob/realPlayed'
import { buildKnockoutBracket } from './src/formView/knockout/knockout'
import { TEAMS } from './src/shared/groups'

const standing = (team: string): Standing =>
  ({ team, played: 3, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 })

const ko = (matchNum: number, home: string, away: string, h: number, a: number): KnockoutMatch =>
  ({ matchNum, home, away, resolved: true, scores: { home: h, away: a } })

const emptyKO = () => ({ r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] })

describe('realEliminations', () => {
  test('a team that loses a knockout match exits at that round', () => {
    const results: TournamentResults = {
      groupMatches: {},
      groupTables: {},
      thirdPlaceQualification: { resolved: false, all: [], tied: [] },
      knockoutStages: { ...emptyKO(), qf: [ko(97, 'Brazil', 'England', 1, 2)] },
    }
    const exits = realEliminations(results)
    expect(exits.get('Brazil')).toMatchObject({ rank: 4 })
    expect(exits.has('England')).toBe(false) // winner is still alive
  })

  test('the final winner stays alive, the loser exits at the final', () => {
    const results: TournamentResults = {
      groupMatches: {},
      groupTables: {},
      thirdPlaceQualification: { resolved: false, all: [], tied: [] },
      knockoutStages: { ...emptyKO(), final: [ko(104, 'France', 'England', 2, 1)] },
    }
    const exits = realEliminations(results)
    expect(exits.has('France')).toBe(false)
    expect(exits.get('England')).toMatchObject({ rank: 6 })
  })

  test('group non-qualifiers exit only once the group is fully played', () => {
    const full = [
      { id: 'A1', homeTeam: 'Mexico', awayTeam: 'South Africa', scores: { home: 2, away: 0 } },
      { id: 'A2', homeTeam: 'South Korea', awayTeam: 'Czech Republic', scores: { home: 1, away: 0 } },
      { id: 'A3', homeTeam: 'Czech Republic', awayTeam: 'South Africa', scores: { home: 1, away: 0 } },
      { id: 'A4', homeTeam: 'Mexico', awayTeam: 'South Korea', scores: { home: 1, away: 0 } },
      { id: 'A5', homeTeam: 'Czech Republic', awayTeam: 'Mexico', scores: { home: 0, away: 2 } },
      { id: 'A6', homeTeam: 'South Africa', awayTeam: 'South Korea', scores: { home: 0, away: 1 } },
    ]
    const table = [standing('Mexico'), standing('South Korea'), standing('Czech Republic'), standing('South Africa')]
    const base: TournamentResults = {
      groupMatches: { A: full },
      groupTables: { A: table },
      thirdPlaceQualification: { resolved: true, all: [], qualifiers: [] },
      knockoutStages: emptyKO(),
    }
    const exits = realEliminations(base)
    expect(exits.has('Mexico')).toBe(false)        // top 2
    expect(exits.has('South Korea')).toBe(false)   // top 2
    expect(exits.get('South Africa')).toMatchObject({ rank: 0 }) // bottom, out

    // with one match still unplayed, nobody is out yet
    const partial = { ...base, groupMatches: { A: [{ ...full[0], scores: { home: null, away: null } }, ...full.slice(1)] } }
    expect(realEliminations(partial).has('South Africa')).toBe(false)
  })
})

describe('effectiveEliminations', () => {
  const realExits = new Map([['Brazil', { rank: 4, label: 'רבע הגמר' }]])

  test('a team the model gives ~0 path to the knockouts is treated as eliminated mid-group', () => {
    // Turkey-style: not yet provably out (group unfinished) but reach ≈ 0.
    const eff = effectiveEliminations(realExits, { Turkey: 0, Spain: 0.42 })
    expect(eff.get('Turkey')).toMatchObject({ rank: 0, label: 'שלב הבתים' })
    expect(eff.has('Spain')).toBe(false)          // a live pick stays alive
  })

  test('certain real exits are preserved and never overwritten by the model verdict', () => {
    const eff = effectiveEliminations(realExits, { Brazil: 0 })
    expect(eff.get('Brazil')).toMatchObject({ rank: 4 }) // keeps the specific KO exit
  })

  test('a team right at the threshold is not yet declared out', () => {
    const eff = effectiveEliminations(new Map(), { Edge: EFFECTIVE_OUT_EPS })
    expect(eff.has('Edge')).toBe(false)
  })
})

describe('eliminatedBackedPickInMatch', () => {
  const backer = USERS.find(u => (u.predictedR16Teams ?? []).length > 0)!
  const pick = backer.predictedR16Teams![0]

  test('names a backed team knocked out in the match and counts the whole field', () => {
    const exits = new Map([[pick, { rank: 0, label: 'שלב הבתים' }]])
    const res = eliminatedBackedPickInMatch(backer.label, pick, '__no_such_team__', exits)!
    expect(res.team).toBe(pick)
    expect(res.teamHe).toBe(he(pick))
    expect(res.backers).toBeGreaterThanOrEqual(1) // at least this bettor backed it
    expect(res.total).toBe(USERS.length)
  })

  test('returns null when no backed team in the match was eliminated', () => {
    expect(eliminatedBackedPickInMatch(backer.label, pick, '__no_such_team__', new Map())).toBeNull()
  })

  test('returns null for an unknown bettor label', () => {
    const exits = new Map([[pick, { rank: 0, label: 'שלב הבתים' }]])
    expect(eliminatedBackedPickInMatch('__nobody__', pick, '__no_such_team__', exits)).toBeNull()
  })
})

describe('runSims knockout-reach', () => {
  test('every group team gets an explicit reach count, including a doomed 0', () => {
    // A group already lost by one side: it should appear with reach 0, not be absent.
    const played: PredictionsState = {
      D1: { home: 4, away: 1 }, D2: { home: 2, away: 0 },
      D3: { home: 2, away: 0 }, D4: { home: 0, away: 1 },
    }
    const agg = runSims(played, 200, 12345)
    expect(agg.reachR32.has('Turkey')).toBe(true)      // present even at 0%
    expect(agg.reachR32.get('Turkey')).toBe(0)
    expect((agg.reachR32.get('United States') ?? 0)).toBeGreaterThan(0)
  })

  test('group-first counts are tracked and never exceed reach', () => {
    const played: PredictionsState = {
      D1: { home: 4, away: 1 }, D2: { home: 2, away: 0 },
      D3: { home: 2, away: 0 }, D4: { home: 0, away: 1 },
    }
    const agg = runSims(played, 200, 12345)
    // every group team has an explicit group-first count (0 for the doomed side)
    expect(agg.groupFirst.has('Turkey')).toBe(true)
    expect(agg.groupFirst.get('Turkey')).toBe(0)
    // finishing 1st implies reaching the knockouts, so first ≤ reach for all teams
    for (const [team, first] of agg.groupFirst)
      expect(first).toBeLessThanOrEqual(agg.reachR32.get(team) ?? 0)
    // exactly one winner per group per sim → total firsts == groups × sims
    const totalFirst = [...agg.groupFirst.values()].reduce((a, b) => a + b, 0)
    expect(totalFirst).toBe(12 * 200)
  })

  test('third-place wins are tallied: one bronze per sim, each winner also reached the semis', () => {
    const n = 200
    const agg = runSims({ A1: { home: 1, away: 0 } }, n, 12345)
    // Exactly one third-place match winner per sim (the bracket always resolves it).
    const total = [...agg.thirdFreq.values()].reduce((a, b) => a + b, 0)
    expect(total).toBe(n)
    // A bronze winner is a semi loser, so it can never win the third-place match more
    // often than it reached the semis.
    for (const [team, third] of agg.thirdFreq)
      expect(third).toBeLessThanOrEqual(agg.reachSF.get(team) ?? 0)
  })

  test('stage-reach is cumulative: deeper rounds are reached no more often than shallower', () => {
    const agg = runSims({ A1: { home: 1, away: 0 } }, 150, 12345)
    const teams = new Set([...agg.reachR32.keys(), ...agg.reachR16.keys()])
    for (const t of teams) {
      const r32 = agg.reachR32.get(t) ?? 0
      const r16 = agg.reachR16.get(t) ?? 0
      const qf = agg.reachQF.get(t) ?? 0
      const sf = agg.reachSF.get(t) ?? 0
      const fin = agg.reachFinal.get(t) ?? 0
      const champ = agg.champFreq.get(t) ?? 0
      expect(r16).toBeLessThanOrEqual(r32)
      expect(qf).toBeLessThanOrEqual(r16)
      expect(sf).toBeLessThanOrEqual(qf)
      expect(fin).toBeLessThanOrEqual(sf)
      expect(champ).toBeLessThanOrEqual(fin)
    }
    // round-by-round totals equal teams-per-round × sims (32,16,8,4,2 reachers)
    const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0)
    expect(sum(agg.reachR32)).toBe(32 * 150)
    expect(sum(agg.reachR16)).toBe(16 * 150)
    expect(sum(agg.reachQF)).toBe(8 * 150)
    expect(sum(agg.reachSF)).toBe(4 * 150)
    expect(sum(agg.reachFinal)).toBe(2 * 150)
  })
})

describe('reachAtRank', () => {
  const sr = { r32: 0.9, r16: 0.7, qf: 0.5, sf: 0.3, final: 0.15, champion: 0.08 }
  test('maps each predicted depth rank to the matching reach probability', () => {
    expect(reachAtRank(sr, 7)).toBe(0.08) // champion
    expect(reachAtRank(sr, 6)).toBe(0.15) // final
    expect(reachAtRank(sr, 5)).toBe(0.3)  // semis
    expect(reachAtRank(sr, 4)).toBe(0.5)  // quarters
    expect(reachAtRank(sr, 3)).toBe(0.7)  // last 16
    expect(reachAtRank(sr, 2)).toBe(0.9)  // group advance
    expect(reachAtRank(sr, 1)).toBe(0.9)
  })
  test('an unknown team (no stage data) reads as 0', () => {
    expect(reachAtRank(undefined, 7)).toBe(0)
  })
})

describe('bracketSurvival', () => {
  const user = makeUser({
    predictedChampion: 'Brazil',
    predictedFinalTeams: ['Brazil', 'France'],
    predictedSFTeams: ['Brazil', 'France', 'Spain', 'England'],
    predictedQFTeams: ['Brazil', 'France', 'Spain', 'England', 'Germany', 'Argentina', 'Portugal', 'Netherlands'],
    predictedR16Teams: ['Brazil', 'France', 'Spain', 'England', 'Germany', 'Argentina', 'Portugal', 'Netherlands'],
  })

  test('counts how many picks survive and names the deepest-bet casualty', () => {
    const exits = realEliminations({
      groupMatches: {},
      groupTables: {},
      thirdPlaceQualification: { resolved: false, all: [], tied: [] },
      knockoutStages: {
        ...emptyKO(),
        qf: [ko(97, 'Brazil', 'England', 1, 2)],   // champion pick Brazil out in QF
        r16: [ko(89, 'Germany', 'X', 0, 1)],        // R16 pick Germany out in R16
      },
    })
    const s = bracketSurvival(user, exits)!
    expect(s.total).toBe(8)
    expect(s.out).toBe(2)
    expect(s.alive).toBe(6)
    // Brazil was bet deepest (champion) so it is the painful one
    expect(s.painful?.teamHe).toBeDefined()
    expect(s.painful?.predictedLabel).toBe('אלופה')
  })

  test('returns null when the user has no advancement picks', () => {
    expect(bracketSurvival(makeUser(), new Map())).toBeNull()
  })

  test('all picks alive yields no painful casualty', () => {
    const s = bracketSurvival(user, new Map())!
    expect(s.alive).toBe(8)
    expect(s.out).toBe(0)
    expect(s.painful).toBeUndefined()
  })

  // Regression: a team backed only to *advance from the group* (top-2, never set
  // to reach the R16) must still count toward survival and show as a casualty when
  // it goes out — otherwise the card says "all your picks alive" while the match
  // line flags that same team as eliminated.
  test('a group-advance pick that exits is counted, not silently ignored', () => {
    const groupUser = makeUser({
      groupTables: { D: [standing('Turkey'), standing('Spain'), standing('X'), standing('Y')] },
      predictedR16Teams: ['Spain'],
    })
    const exits = new Map([['Turkey', { rank: 0, label: 'שלב הבתים' }]])
    const s = bracketSurvival(groupUser, exits)!
    expect(s.total).toBe(2)
    expect(s.out).toBe(1)
    expect(s.alive).toBe(1)
    expect(s.painful?.teamHe).toBeDefined()
    expect(s.painful?.predictedLabel).toBe('עולה מהבית')
  })
})

describe('advancementSummary', () => {
  const user = makeUser({
    groupTables: {
      A: [standing('Spain'), standing('Turkey'), standing('X'), standing('Y')],
      B: [standing('Brazil'), standing('Egypt'), standing('Z'), standing('W')],
    },
    predictedR16Teams: ['Spain', 'Brazil'],
  })

  test('buckets each advancement pick by its model reach and group-first', () => {
    const reach = { Spain: 0.97, Brazil: 0.62, Turkey: 0.0, Egypt: 0.45 }
    const groupFirst = { Spain: 0.71, Brazil: 0.30, Turkey: 0.0, Egypt: 0.10 }
    const exits = new Map([['Turkey', { rank: 0, label: 'שלב הבתים' }]])
    const s = advancementSummary(user, reach, groupFirst, exits)!

    expect(s.total).toBe(4)
    expect(s.secured).toBe(1)   // Spain
    expect(s.likely).toBe(1)    // Brazil (0.62)
    expect(s.bubble).toBe(1)    // Egypt (0.45)
    expect(s.out).toBe(1)       // Turkey (in exits)
    expect(s.decided).toBe(false) // Egypt still on the bubble
    // sorted most-secure first, Spain flagged as group favorite
    expect(s.picks[0].team).toBe('Spain')
    expect(s.picks[0].topsGroup).toBe(true)
    expect(s.picks.find(p => p.team === 'Brazil')!.topsGroup).toBe(false)
  })

  test('an out pick never counts as a group favorite even with stale group-first', () => {
    const s = advancementSummary(user, { Turkey: 0 }, { Turkey: 0.9 }, new Map([['Turkey', { rank: 0, label: 'שלב הבתים' }]]))!
    expect(s.picks.find(p => p.team === 'Turkey')!.topsGroup).toBe(false)
  })

  test('returns null when the user has no advancement picks', () => {
    expect(advancementSummary(makeUser(), {}, {}, new Map())).toBeNull()
  })
})

describe('explainMatchForUser', () => {
  const user = makeUser({
    predictedChampion: 'Brazil',
    predictedR16Teams: ['Brazil', 'Germany'],
  })
  const groupOut = new Map([['Germany', { rank: 0, label: 'שלב הבתים' }]])

  test('a backed team that won is reported as a win, prefixed as the user’s pick', () => {
    const txt = explainMatchForUser(user, 'Brazil', 'Serbia', 2, 0)
    expect(txt.startsWith('מהבחירות שלך:')).toBe(true)
    expect(txt).toContain(`${he('Brazil')} (אלופה) ניצחה`)
  })

  test('a backed team that lost but is still alive is flagged as not-yet-out', () => {
    const txt = explainMatchForUser(user, 'Germany', 'Spain', 0, 1)
    expect(txt).toContain(`${he('Germany')} (שמינית) הפסידה אך עדיין בחיים`)
    expect(txt).not.toContain('הודחה')
  })

  test('a backed team eliminated in reality is reported as knocked out', () => {
    const txt = explainMatchForUser(user, 'Germany', 'Spain', 0, 1, groupOut)
    expect(txt).toContain(`${he('Germany')} (שמינית) הודחה מהטורניר`)
  })

  test('a backed team that won its match but is out is reported as ejected, never "closing in"', () => {
    const txt = explainMatchForUser(user, 'Germany', 'Spain', 1, 0, groupOut)
    expect(txt).toContain(`${he('Germany')} (שמינית) ניצחה`)
    expect(txt).toContain('נפלטה מהטורניר')
    expect(txt).not.toContain('מתקרבת ליעד')
  })

  test('a draw keeps an alive pick neutral but flags one that got ejected', () => {
    expect(explainMatchForUser(user, 'Brazil', 'Germany', 1, 1))
      .toContain('סיימה בתיקו ועדיין בחיים')
    expect(explainMatchForUser(user, 'Brazil', 'Germany', 1, 1, groupOut))
      .toContain(`${he('Germany')} (שמינית) נפלטה בתיקו`)
  })

  test('the deepest pick leads when both teams were backed', () => {
    const txt = explainMatchForUser(user, 'Germany', 'Brazil', 0, 1)
    expect(txt.indexOf(he('Brazil'))).toBeLessThan(txt.indexOf(he('Germany')))
  })

  test('with no stake in the match the move is attributed to rivals', () => {
    const txt = explainMatchForUser(makeUser(), 'Brazil', 'Spain', 1, 0)
    expect(txt).toContain('לא בחרת קבוצה מהמשחק')
  })
})

describe('currentResults knockout resolution', () => {
  // A bettor's submitted predictions are a fully internally-consistent set of
  // results (groups + a complete, resolvable bracket) — a realistic stand-in
  // for "the whole tournament has now been played".
  const fullState: PredictionsState = USERS[0].predictions

  test('with groups still in progress, no knockout is fabricated', () => {
    const partial: PredictionsState = { A1: { home: 1, away: 0 } }
    const res = currentResults(partial)
    expect(res.knockoutStages.r32).toHaveLength(0)
    expect(res.thirdPlaceQualification.resolved).toBe(false)
  })

  test('real golden-boot goals so far are carried into the current snapshot', () => {
    const res = currentResults({ A1: { home: 1, away: 0 } }, { 'הארי קיין': 3 })
    expect(res.playerGoals).toEqual({ 'הארי קיין': 3 })
  })

  test('once all groups finish, the real bracket and champion are resolved from played KO scores', () => {
    const res = currentResults(fullState)
    expect(res.thirdPlaceQualification.resolved).toBe(true)
    expect(res.knockoutStages.r32).toHaveLength(16)
    const m73 = res.knockoutStages.r32.find(m => m.matchNum === 73)!
    expect(m73.home).toBeTruthy()             // a real team, not a placeholder slot
    expect(m73.scores).toEqual(fullState['73'])
    expect(res.champion).toBeTruthy()
    expect(res.knockoutStages.final[0].scores).toEqual(fullState['104'])
  })
})

describe('runSims knockout pairings', () => {
  test('every knockout match (R32 → final) tallies pairings that sum to the run count', () => {
    const agg = runSims({ A1: { home: 1, away: 0 } }, 150, 12345)
    // every knockout match number appears (73..88 R32, 89..96 R16, 97..100 QF,
    // 101..102 SF, 103 third place, 104 final) and its pairings add up to n
    const koNums = Array.from({ length: 104 - 73 + 1 }, (_, i) => 73 + i) // 73..104 (all KO matches)
    for (const num of koNums) {
      const byPair = agg.koPairs.get(num)
      expect(byPair, `match ${num}`).toBeDefined()
      const total = [...byPair!.values()].reduce((a, b) => a + b, 0)
      expect(total, `match ${num}`).toBe(150)
    }
  })

  test('pairing keys are side-agnostic (alphabetical)', () => {
    const agg = runSims({ A1: { home: 1, away: 0 } }, 60, 99)
    for (const byPair of agg.koPairs.values())
      for (const key of byPair.keys()) {
        const [a, b] = key.split('|')
        expect(a < b).toBe(true)
      }
  })

  test('merging batches sums each match pairing count', () => {
    const a = runSims({ A1: { home: 1, away: 0 } }, 40, 1)
    const b = runSims({ A1: { home: 1, away: 0 } }, 40, 2)
    const merged = mergeSimAgg(a, b)
    for (const num of [73, 90, 104]) {
      const total = [...merged.koPairs.get(num)!.values()].reduce((x, y) => x + y, 0)
      expect(total).toBe(80)
    }
  })
})

describe('runSims champion-conditioned win tally', () => {
  const played: PredictionsState = { A1: { home: 1, away: 0 } }

  test('condWinByChamp is collected only under the collect flag', () => {
    expect(runSims(played, 30, 3, false).condWinByChamp).toBeUndefined()
    expect(runSims(played, 30, 3, true).condWinByChamp).toBeDefined()
  })

  test('per champion, the summed win-share never exceeds that champion frequency', () => {
    const agg = runSims(played, 300, 12345, true)
    for (const [team, byBettor] of agg.condWinByChamp!) {
      const champCount = agg.champFreq.get(team) ?? 0
      const winShareTotal = [...byBettor.values()].reduce((a, b) => a + b, 0)
      // exactly one pool win is shared out per sim, so summed over the sims where
      // this team was champion the total win-share equals that champion count.
      expect(winShareTotal).toBeCloseTo(champCount, 6)
    }
  })

  test('summing the champion buckets recovers the flat win/top3/top5 tallies', () => {
    const agg = runSims(played, 300, 12345, true)
    const fold = (m: Map<string, Map<string, number>>) => {
      const perBettor = new Map<string, number>()
      for (const byBettor of m.values())
        for (const [label, v] of byBettor) perBettor.set(label, (perBettor.get(label) ?? 0) + v)
      return perBettor
    }
    // champions cover every sim (a tournament always crowns one), so the champion-
    // partitioned tallies add back up to each bettor's overall tally.
    const foldedWin = fold(agg.condWinByChamp!)
    for (const [label, total] of agg.win) expect(foldedWin.get(label) ?? 0).toBeCloseTo(total, 6)
    const foldedT3 = fold(agg.condTop3ByChamp!)
    for (const [label, total] of agg.top3) expect(foldedT3.get(label) ?? 0).toBe(total)
    const foldedT5 = fold(agg.condTop5ByChamp!)
    for (const [label, total] of agg.top5) expect(foldedT5.get(label) ?? 0).toBe(total)
  })

  test('merging batches sums the champion-conditioned buckets', () => {
    const a = runSims(played, 60, 7, true)
    const b = runSims(played, 60, 8, true)
    const team = [...a.condWinByChamp!.keys()][0]
    const label = [...a.condWinByChamp!.get(team)!.keys()][0]
    const expected = (a.condWinByChamp!.get(team)!.get(label) ?? 0) + (b.condWinByChamp!.get(team)!.get(label) ?? 0)
    const merged = mergeSimAgg(a, b)
    expect(merged.condWinByChamp!.get(team)!.get(label)).toBeCloseTo(expected, 6)
  })
})

describe('buildRows champion-conditioned fields', () => {
  const played: PredictionsState = { A1: { home: 1, away: 0 } }

  test('condWinPct equals the champion bucket win-share over that champion frequency', () => {
    const n = 400
    const agg = runSims(played, n, 12345, true)
    const rows = buildRows(agg, n, played)
    for (const r of rows) {
      if (!r.championTeam) { expect(r.condWinPct).toBeNull(); continue }
      const champCount = agg.champFreq.get(r.championTeam) ?? 0
      expect(r.championWinPct).toBeCloseTo((champCount / n) * 100, 6)
      if (champCount === 0) { expect(r.condWinPct).toBeNull(); expect(r.condTop3Pct).toBeNull(); expect(r.condTop5Pct).toBeNull(); continue }
      const share = agg.condWinByChamp!.get(r.championTeam)?.get(r.label) ?? 0
      expect(r.condWinPct!).toBeCloseTo((share / champCount) * 100, 6)
      const t3 = agg.condTop3ByChamp!.get(r.championTeam)?.get(r.label) ?? 0
      expect(r.condTop3Pct!).toBeCloseTo((t3 / champCount) * 100, 6)
      const t5 = agg.condTop5ByChamp!.get(r.championTeam)?.get(r.label) ?? 0
      expect(r.condTop5Pct!).toBeCloseTo((t5 / champCount) * 100, 6)
      // conditioning is monotone: top-5 ≥ top-3 ≥ win, same as the unconditional finish odds.
      expect(r.condTop5Pct!).toBeGreaterThanOrEqual(r.condTop3Pct! - 1e-9)
      expect(r.condTop3Pct!).toBeGreaterThanOrEqual(r.condWinPct! - 1e-9)
    }
  })
})

// A systematic sweep: every number a bettor sees must describe ONE physically-possible
// tournament and obey the obvious ordering laws. We build the real rows twice — once
// pre-tournament (everything in play) and once from the live results — and assert the
// invariants on every row. If any of these ever trip, a bettor is being shown a scenario
// that can't happen (the class of bug we keep getting bitten by), not a rounding nit.
describe('buildRows output is internally coherent', () => {
  const N = 800
  const CHAMPION = 7
  const FINALIST = 6
  const SEMIS = 5
  const EPS = 1e-9

  const states: [string, PredictionsState][] = [
    ['pre-tournament', {}],
    ['live results', realPlayedState(tournamentResults)],
  ]

  for (const [name, played] of states) {
    describe(name, () => {
      const rows = buildRows(runSims(played, N, 20260707, true), N, played)
      const total = rows.length

      test('there is at least one bettor to check', () => {
        expect(total).toBeGreaterThan(0)
      })

      for (const r of rows) {
        describe(r.label, () => {
          test('win ⊆ top3 ⊆ top5, all within 0–100', () => {
            expect(r.winPct).toBeGreaterThanOrEqual(0)
            expect(r.winPct).toBeLessThanOrEqual(r.top3Pct + EPS)
            expect(r.top3Pct).toBeLessThanOrEqual(r.top5Pct + EPS)
            expect(r.top5Pct).toBeLessThanOrEqual(100 + EPS)
          })

          test('ranks sit inside the field and the peak is not below the realistic best', () => {
            for (const v of [r.curRank, r.expRank, r.bestPlace, r.peakPlace]) {
              expect(v).toBeGreaterThanOrEqual(1)
              expect(v).toBeLessThanOrEqual(total)
            }
            expect(r.peakPlace).toBeLessThanOrEqual(r.bestPlace) // a smaller place is a better finish
          })

          test('champion-conditioned reads exist iff the champion can win, and stay ordered', () => {
            expect(r.championWinPct).toBeGreaterThanOrEqual(0)
            expect(r.championWinPct).toBeLessThanOrEqual(100 + EPS)
            if (r.championWinPct === 0) {
              expect(r.condWinPct).toBeNull()
              expect(r.condTop3Pct).toBeNull()
              expect(r.condTop5Pct).toBeNull()
            } else if (r.condWinPct !== null) {
              expect(r.condWinPct).toBeGreaterThanOrEqual(0)
              expect(r.condWinPct).toBeLessThanOrEqual(r.condTop3Pct! + EPS)
              expect(r.condTop3Pct!).toBeLessThanOrEqual(r.condTop5Pct! + EPS)
              expect(r.condTop5Pct!).toBeLessThanOrEqual(100 + EPS)
            }
          })

          const s = r.bestScenario
          if (s) {
            test('the best case is one real tournament: ≤1 champion, ≤2 finalists', () => {
              expect(s.picks.filter(p => p.reached >= CHAMPION).length).toBeLessThanOrEqual(1)
              expect(s.picks.filter(p => p.reached >= FINALIST).length).toBeLessThanOrEqual(2)
              expect(s.rank).toBe(r.bestPlace)
              expect(s.pts).toBeGreaterThanOrEqual(0)
              for (const p of s.picks) {
                expect(p.reached).toBeGreaterThanOrEqual(0)
                expect(p.reached).toBeLessThanOrEqual(CHAMPION)
              }
            })

            test('the third-place pick is never also a finalist in that same run', () => {
              if (!s.thirdTeamHe) return
              const asPick = s.picks.find(p => p.teamHe === s.thirdTeamHe)
              if (asPick) expect(asPick.reached).toBeLessThanOrEqual(SEMIS)
              const clash = s.picks.find(p => p.teamHe === s.thirdTeamHe && p.reached >= FINALIST)
              expect(clash, `${s.thirdTeamHe} shown in both the final and the third-place match`).toBeUndefined()
            })

            test('collisions resolve toward rank: among same-depth picks, fewer rivals ⇒ deeper run', () => {
              // Within each backed depth, the pick FEWER rivals also backed must not be shown
              // stopping earlier than a more-popular same-depth pick — that would be the
              // rank-negative resolution the optimal scenario is meant to avoid.
              const byRank = new Map<number, typeof s.picks>()
              for (const p of s.picks) {
                if (p.team === s.thirdTeam) continue // third-place pick is steered separately
                const g = byRank.get(p.predictedRank)
                if (g) g.push(p); else byRank.set(p.predictedRank, [p])
              }
              for (const [rank, g] of byRank) {
                for (const a of g) for (const b of g) {
                  if (rivalBackers(a.team, rank, r.label) < rivalBackers(b.team, rank, r.label)) {
                    expect(a.reached, `${a.team} (rarer) shown shallower than ${b.team}`).toBeGreaterThanOrEqual(b.reached)
                  }
                }
              }
            })
          }
        })
      }
    })
  }
})

describe('buildRows best-case coherence', () => {
  // Regression: a bettor's predicted third-place winner lost its semi and then took the
  // third-place match — so it can never ALSO be shown reaching the final/title in the same
  // (single, coherent) best-case tournament. Run pre-tournament (everything in play) so
  // every deep pick, including the third-place bet, is live.
  const REACHED_FINAL_OR_TITLE = 6

  test('the third-place pick is never shown reaching the final in the same scenario', () => {
    const n = 600
    const rows = buildRows(runSims({}, n, 12345, true), n, {})
    for (const r of rows) {
      const s = r.bestScenario
      if (!s?.thirdTeamHe) continue
      const clash = s.picks.find(p => p.teamHe === s.thirdTeamHe && p.reached >= REACHED_FINAL_OR_TITLE)
      expect(clash, `${r.label}: ${s.thirdTeamHe} shown in both the final and the third-place match`).toBeUndefined()
    }
  })

  test("Idan's Argentina is not simultaneously a finalist and the third-place winner", () => {
    const n = 600
    const rows = buildRows(runSims({}, n, 12345, true), n, {})
    const idan = rows.find(r => r.label === 'עידן מלמד')
    expect(idan).toBeDefined()
    const s = idan!.bestScenario
    if (s?.thirdTeamHe) {
      const deepRun = s.picks.find(p => p.teamHe === s.thirdTeamHe)
      if (deepRun) expect(deepRun.reached).toBeLessThanOrEqual(5) // capped at the semis
    }
  })
})

describe('buildRows win-probability ordering', () => {
  const played: PredictionsState = { A1: { home: 1, away: 0 } }

  test('rows are sorted by win, then top-3, top-5, expected place, avg points', () => {
    const n = 400
    const rows = buildRows(runSims(played, n, 12345, true), n, played)
    // win% is the primary key — never increases down the board
    for (let i = 1; i < rows.length; i++) expect(rows[i].winPct).toBeLessThanOrEqual(rows[i - 1].winPct + 1e-9)
    // and the full tiebreak chain holds pairwise (no adjacent pair is out of order)
    for (let i = 1; i < rows.length; i++) expect(compareRows(rows[i - 1], rows[i])).toBeLessThanOrEqual(0)
  })

  test('compareRows breaks a win/top3/top5 tie by the better (lower) expected place', () => {
    const base = { winPct: 0, top3Pct: 0, top5Pct: 0, avgPts: 10, label: 'ב' } as const
    const better = { ...base, expRank: 8 } as unknown as Parameters<typeof compareRows>[0]
    const worse = { ...base, label: 'א', expRank: 12 } as unknown as Parameters<typeof compareRows>[0]
    expect(compareRows(better, worse)).toBeLessThan(0) // lower expRank ranks ahead despite the name order
  })
})

describe('mergeSimAgg', () => {
  // Slicing a simulation into separately-seeded batches and merging must give the
  // same tallies as adding the batches by hand — this is what lets the worker run
  // in yielding chunks without changing the result.
  const played: PredictionsState = { A1: { home: 1, away: 0 } }
  const label = USERS[0].label

  test('merges every tally additively and concatenates the point series', () => {
    const a = runSims(played, 40, 1, true, {})
    const b = runSims(played, 40, 2, true, {})

    const aWin = a.win.get(label)!, bWin = b.win.get(label)!
    const aPts = a.sumPts.get(label)!, bPts = b.sumPts.get(label)!
    const aR32 = a.stages.get(label)!.r32, bR32 = b.stages.get(label)!.r32
    const aSeries = a.series!.get(label)!.length, bSeries = b.series!.get(label)!.length

    const merged = mergeSimAgg(a, b)

    expect(merged.win.get(label)!).toBeCloseTo(aWin + bWin, 10)
    expect(merged.sumPts.get(label)!).toBe(aPts + bPts)
    expect(merged.stages.get(label)!.r32).toBe(aR32 + bR32)
    expect(merged.series!.get(label)!.length).toBe(aSeries + bSeries)
  })

  test('champion frequencies from both batches are summed', () => {
    const a = runSims(played, 60, 7, false, {})
    const b = runSims(played, 60, 8, false, {})
    const champs = new Set([...a.champFreq.keys(), ...b.champFreq.keys()])
    const expected = new Map([...champs].map(t => [t, (a.champFreq.get(t) ?? 0) + (b.champFreq.get(t) ?? 0)]))
    const merged = mergeSimAgg(a, b)
    for (const [t, v] of expected) expect(merged.champFreq.get(t)).toBe(v)
    // total champion attributions equals the combined number of simulations
    expect([...merged.champFreq.values()].reduce((x, y) => x + y, 0)).toBe(120)
  })
})

describe('golden boot banks real goals', () => {
  test('banked goals are a floor on the projected tally', () => {
    const partial = { A1: { home: 1, away: 0 } } // England (קיין) hasn't played here
    const res = simulateTournament(partial, { 'הארי קיין': 2 }, realGamesByTeam(partial))
    expect(res.playerGoals!['הארי קיין']).toBeGreaterThanOrEqual(2)
  })

  test('once every game is played, the tally equals exactly the banked goals', () => {
    const full = USERS[0].predictions // all games resolved → no remaining games to sample
    const res = simulateTournament(full, { 'הארי קיין': 5 }, realGamesByTeam(full))
    expect(res.playerGoals!['הארי קיין']).toBe(5)
  })

  test('a scorer with banked goals wins the boot far more often than with none', () => {
    const partial = { A1: { home: 1, away: 0 } }
    const games = realGamesByTeam(partial)
    const wins = (goals: Record<string, number>) => {
      let w = 0
      for (let i = 0; i < 300; i++) {
        const res = simulateTournament(partial, goals, games)
        if ((res.goldenBootWinner as string[]).includes('הארי קיין')) w++
      }
      return w
    }
    expect(wins({ 'הארי קיין': 6 })).toBeGreaterThan(wins({}))
  })
})

describe('podiumByAdvancer', () => {
  const viewer = USERS[0]
  // Reopen the final four (SFs, third place, final) on top of the real results, so an
  // open known-teams fixture AND a placeholder fixture both exist no matter how far
  // the live tournament has progressed — the QF results feeding them never change.
  const played = (() => {
    const p = { ...realPlayedState(tournamentResults) }
    for (const n of [101, 102, 103, 104]) delete p[String(n)]
    return p
  })()
  const bracket = buildKnockoutBracket(played)
  // A not-yet-played knockout fixture whose two participants are real, resolved
  // teams (a reopened semi).
  const openMatch = bracket.find(m => TEAMS[m.home] && TEAMS[m.away] && !played[String(m.matchNum)])!
  // A deeper fixture whose feeders are still open, so it carries placeholder labels.
  const placeholderMatch = bracket.find(m => !(TEAMS[m.home] && TEAMS[m.away]))!

  test('the fixture used by the test really has known teams and is unplayed', () => {
    expect(openMatch).toBeDefined()
    expect(placeholderMatch).toBeDefined()
  })

  test('buckets every simulation by the two real advancers', () => {
    const r = podiumByAdvancer(viewer, played, openMatch.matchNum, 200, 1)!
    expect(r).not.toBeNull()
    expect(new Set([r.teamA, r.teamB])).toEqual(new Set([openMatch.home, openMatch.away]))
    expect(r.nA + r.nB).toBe(200)                 // a known-teams fixture resolves to one of the two every run
    for (const p of [r.podiumIfA, r.podiumIfB]) {
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(1)
    }
    // the baseline is the advance-weighted average of the two conditionals, so it
    // must sit between them — neither outcome can leave both above the marginal.
    expect(r.podiumBaseline).toBeGreaterThanOrEqual(Math.min(r.podiumIfA, r.podiumIfB))
    expect(r.podiumBaseline).toBeLessThanOrEqual(Math.max(r.podiumIfA, r.podiumIfB))
    expect(r.podiumBaseline).toBeCloseTo((r.nA * r.podiumIfA + r.nB * r.podiumIfB) / (r.nA + r.nB), 10)
  })

  test('returns null for a match that has already been played', () => {
    const decided: PredictionsState = { ...played, [String(openMatch.matchNum)]: { home: 1, away: 0 } }
    expect(podiumByAdvancer(viewer, decided, openMatch.matchNum, 50, 1)).toBeNull()
  })

  test('returns null when the participants are not yet known (placeholder teams)', () => {
    expect(podiumByAdvancer(viewer, played, placeholderMatch.matchNum, 50, 1)).toBeNull()
  })

  test('is deterministic for a fixed seed', () => {
    const a = podiumByAdvancer(viewer, played, openMatch.matchNum, 150, 7)
    const b = podiumByAdvancer(viewer, played, openMatch.matchNum, 150, 7)
    expect(a).toEqual(b)
  })
})

describe('pivotalMatches', () => {
  const viewer = USERS[0]
  const played = realPlayedState(tournamentResults)
  const bracket = buildKnockoutBracket(played)
  const openMatches = bracket.filter(m => TEAMS[m.home] && TEAMS[m.away] && !played[String(m.matchNum)])

  test('scores exactly the open, known-teams fixtures', () => {
    const pivotal = pivotalMatches(viewer, played, 120, 3)
    expect(pivotal.map(p => p.matchNum).sort((a, b) => a - b))
      .toEqual(openMatches.map(m => m.matchNum).sort((a, b) => a - b))
  })

  test('each fixture matches its standalone podiumByAdvancer (same shared sim plan)', () => {
    const n = 120, seed = 3
    const pivotal = pivotalMatches(viewer, played, n, seed)
    for (const p of pivotal) {
      const solo = podiumByAdvancer(viewer, played, p.matchNum, n, seed)!
      expect(p).toEqual(solo)
    }
  })

  test('returns nothing once every knockout fixture is decided', () => {
    // Playing one round open the next (its feeders resolve), so we play the whole
    // bracket out until no known-teams fixture is left undecided.
    const allDecided: PredictionsState = { ...played }
    for (let round = 0; round < 10; round++) {
      const open = buildKnockoutBracket(allDecided)
        .filter(m => TEAMS[m.home] && TEAMS[m.away] && !allDecided[String(m.matchNum)])
      if (!open.length) break
      for (const m of open) allDecided[String(m.matchNum)] = { home: 1, away: 0 }
    }
    expect(pivotalMatches(viewer, allDecided, 50, 1)).toEqual([])
  })
})
