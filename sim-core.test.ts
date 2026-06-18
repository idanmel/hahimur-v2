// @vitest-environment node
import { describe, expect, test } from 'vitest'
import type { KnockoutMatch, PredictionsState, Standing, TournamentResults } from './src/shared/types'
import { makeUser } from './src/leaderboard/testFixtures'
import { USERS } from './src/users'
import { realEliminations, bracketSurvival, currentResults, simulateTournament, realGamesByTeam, explainMatchForUser, he } from './sim-core'

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
