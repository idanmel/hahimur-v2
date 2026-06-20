import { describe, it, expect } from 'vitest'
import { bestRemainingResult } from './bestResult'
import { liveGroupScores } from '../shared/standings'
import { tournamentResults } from '../tournament-results'
import { USERS } from '../users'

const idan = USERS.find(u => u.label === 'עידן מלמד')!
const orderOf = (g: string) => (idan.groupTables[g] ?? []).map(s => s.team)
const real = (g: string) => liveGroupScores(tournamentResults, g)
const thirdQualifies = (g: string) => {
  const tpq = idan.thirdPlaceQualification
  const quals = tpq.resolved ? tpq.qualifiers : []
  return quals.some(t => t.team === orderOf(g)[2])
}
const best = (g: string) =>
  bestRemainingResult(g, idan.predictions, orderOf(g), real(g), { thirdQualifies: thirdQualifies(g) })!
const byId = (r: ReturnType<typeof best>, id: string) => r.ideal.find(m => m.id === id)!.scores

describe('bestRemainingResult (seeding + third-place aware)', () => {
  it('Group A: lift the third-place pick (Czech) over the line by beating Mexico', () => {
    const a = best('A')
    expect(a.thirdShouldAdvance).toBe(true)
    expect(a.resultingOrder).toEqual(['Mexico', 'South Korea', 'Czech Republic', 'South Africa'])
    const a5 = byId(a, 'A5') // Czech (home) vs Mexico (away)
    expect(a5.home!).toBeGreaterThan(a5.away!) // Czech win → 4 pts, clears the third cut
    expect(a.thirdTeam).toBe('Czech Republic')
    expect(a.thirdPoints).toBe(4)
  })

  it('Group B: Switzerland 1st, and keep Bosnia (tipped out) weak with a B6 draw', () => {
    const b = best('B')
    const b5 = byId(b, 'B5') // Switzerland (home) vs Canada (away)
    const b6 = byId(b, 'B6') // Bosnia (home) vs Qatar (away)
    expect(b5.home!).toBeGreaterThan(b5.away!)
    expect(b6.home).toBe(b6.away)             // draw → Bosnia stays on 2 pts
    expect(b.resultingOrder.slice(0, 2)).toEqual(['Switzerland', 'Canada'])
    expect(b.thirdShouldAdvance).toBe(false)
    expect(b.thirdPoints).toBe(2)
  })

  it('Group C: break the Brazil/Morocco tie while keeping Scotland strong at 3rd', () => {
    const c = best('C')
    expect(c.tieAtTop).toBe(false)
    expect(c.resultingOrder).toEqual(['Brazil', 'Morocco', 'Scotland', 'Haiti'])
    expect(byId(c, 'C5')).toEqual({ home: 0, away: 1 }) // Scotland loses 1-0 → 3 pts
    const c6 = byId(c, 'C6')
    expect(c6.home! - c6.away!).toBe(1)                 // Morocco by one → tie broken
    expect(c.thirdTeam).toBe('Scotland')
  })
})
