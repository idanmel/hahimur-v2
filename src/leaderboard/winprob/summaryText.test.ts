import { describe, test, expect } from 'vitest'
import type { Row, AdvancementSummary, PickStatus, StageReach, StageStat } from '../../../sim-core'
import { deepPicksClause, groupPicksClause, edgeClause, buildMyHeadline } from './summaryText'

function pick(over: Partial<PickStatus> & { team: string; predictedRank: number; stage: PickStatus['stage'] }): PickStatus {
  return { teamHe: over.team, reach: 0, groupFirst: 0, topsGroup: false, ...over }
}
function summary(picks: PickStatus[]): AdvancementSummary {
  const c = (s: PickStatus['stage']) => picks.filter(p => p.stage === s).length
  return { picks, secured: c('secured'), likely: c('likely'), bubble: c('bubble'), longshot: c('longshot'), out: c('out'), total: picks.length, decided: c('bubble') + c('longshot') === 0 }
}
const sr = (over: Partial<StageReach>): StageReach => ({ r32: 0, r16: 0, qf: 0, sf: 0, final: 0, champion: 0, ...over })
function stage(key: string, label: string, edge: number): StageStat {
  return { key: key as StageStat['key'], label, val: 0, field: 0, edge }
}
function row(over: Partial<Row>): Row {
  return { label: 'מי', winPct: 0, top3Pct: 0, top5Pct: 0, avgPts: 0, std: 0, ceiling: 0, curRank: 1, expRank: 1, turkey: '', championHe: '', championTeam: '', championAlive: true, scorer: '', reason: '', stages: [], ...over }
}

describe('deepPicksClause', () => {
  test('groups by depth with reach-% and flags eliminated picks', () => {
    const adv = summary([
      pick({ team: 'ספרד', predictedRank: 7, stage: 'secured' }),
      pick({ team: 'אנגליה', predictedRank: 5, stage: 'likely' }),
      pick({ team: 'ארגנטינה', predictedRank: 6, stage: 'out' }),
    ])
    const reach = { ספרד: sr({ champion: 0.18 }), אנגליה: sr({ sf: 0.31 }), ארגנטינה: sr({ final: 0.2 }) }
    expect(deepPicksClause(adv, reach)).toBe('אלופה: ספרד 18% · לגמר: ארגנטינה (הודחה) · לחצי הגמר: אנגליה 31%')
  })
})

describe('groupPicksClause', () => {
  test('leads with dead picks, then at-risk with odds, then a safe count', () => {
    const adv = summary([
      pick({ team: 'טורקיה', predictedRank: 2, stage: 'out' }),
      pick({ team: 'אקוודור', predictedRank: 2, stage: 'longshot', reach: 0.12 }),
      pick({ team: 'אורוגוואי', predictedRank: 2, stage: 'bubble', reach: 0.41 }),
      pick({ team: 'ספרד', predictedRank: 1, stage: 'secured', reach: 0.99 }),
      pick({ team: 'גרמניה', predictedRank: 1, stage: 'likely', reach: 0.7 }),
    ])
    expect(groupPicksClause(adv)).toBe('כבר לא יעלו: טורקיה · בסיכון: אקוודור 12%, אורוגוואי 41% · עוד 2 בדרך בטוחה לעלות')
  })
  test('returns null when the bettor has no group-only picks', () => {
    expect(groupPicksClause(summary([pick({ team: 'ספרד', predictedRank: 7, stage: 'secured' })]))).toBeNull()
  })
})

describe('edgeClause', () => {
  test('names the biggest gains and losses vs the field, skipping small gaps', () => {
    const r = row({ stages: [stage('group', 'שלב הבתים', 22), stage('gb', 'נעל זהב', -10), stage('r32', 'שלב 32', 2)] })
    expect(edgeClause(r)).toBe('מרוויח על המתחרים בנקודות: שלב הבתים +22 · מפסיד: נעל זהב −10')
  })
  test('returns null when nothing exceeds the threshold', () => {
    expect(edgeClause(row({ stages: [stage('group', 'שלב הבתים', 1)] }))).toBeNull()
  })
})

describe('buildMyHeadline', () => {
  test('shows standing, the deepest pick route, other marquee calls, strengths/weaknesses, and fallen picks', () => {
    const adv = summary([
      pick({ team: 'צרפת', predictedRank: 7, stage: 'likely' }),
      pick({ team: 'אנגליה', predictedRank: 6, stage: 'likely' }),
      pick({ team: 'ספרד', predictedRank: 5, stage: 'likely' }),
      pick({ team: 'טורקיה', predictedRank: 2, stage: 'out' }),
    ])
    const reach = {
      צרפת: sr({ r16: 0.82, qf: 0.55, sf: 0.3, final: 0.21, champion: 0.13 }),
      אנגליה: sr({ final: 0.16 }), ספרד: sr({ sf: 0.43 }),
    }
    const r = row({ curRank: 1, expRank: 5, winPct: 24, top5Pct: 63.6, avgPts: 402, stages: [stage('group', 'שלב הבתים', 22), stage('gb', 'נעל זהב', 7)] })
    const h = buildMyHeadline(r, adv, reach, 27)
    expect(h.standing).toContain('אתה במקום 1 מתוך 27')
    expect(h.standing).toContain('24.0%')
    expect(h.standing).toContain('(צפוי לרדת)')
    expect(h.standing).toContain('402 נק׳')
    // the route ladder of the deepest live pick (champion), encoding bracket difficulty
    expect(h.route).toEqual({ teamHe: 'צרפת', ladder: 'שמינית 82% → רבע 55% → חצי 30% → גמר 21% → אלופה 13%' })
    // the *other* marquee calls, deepest first (the route team is not repeated)
    expect(h.bigBets).toBe('אנגליה לגמר (16%), ספרד לחצי הגמר (43%)')
    expect(h.strength).toBe('שלב הבתים +22, נעל זהב +7 (נק׳ מעל ממוצע המהמרים)')
    expect(h.weakness).toBeUndefined()
    expect(h.fallen).toBe('טורקיה')
  })

  test('flags an eliminated marquee pick and reports a weakness', () => {
    const adv = summary([pick({ team: 'ברזיל', predictedRank: 7, stage: 'out' })])
    const r = row({ stages: [stage('gb', 'נעל זהב', -15), stage('group', 'שלב הבתים', 5)] })
    const h = buildMyHeadline(r, adv, {}, 27)
    expect(h.route).toBeUndefined()
    expect(h.bigBets).toBe('ברזיל (לאליפות) — הודחה')
    expect(h.strength).toBe('שלב הבתים +5 (נק׳ מעל ממוצע המהמרים)')
    expect(h.weakness).toBe('נעל זהב −15 (נק׳ מתחת לממוצע)')
  })

  test('routes a semifinal pick only as deep as it was backed', () => {
    const adv = summary([
      pick({ team: 'ספרד', predictedRank: 5, stage: 'likely' }),
      pick({ team: 'הולנד', predictedRank: 4, stage: 'bubble' }),
    ])
    const reach = { ספרד: sr({ r16: 0.8, qf: 0.6, sf: 0.43 }), הולנד: sr({ r16: 0.7, qf: 0.35 }) }
    const h = buildMyHeadline(row({}), adv, reach, 27)
    expect(h.route).toEqual({ teamHe: 'ספרד', ladder: 'שמינית 80% → רבע 60% → חצי 43%' })
    expect(h.bigBets).toBeUndefined()
  })
})
