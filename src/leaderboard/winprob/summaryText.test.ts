import { describe, test, expect } from 'vitest'
import type { Row, AdvancementSummary, PickStatus, StageReach, StageStat } from '../../../sim-core'
import { deepPicksClause, groupPicksClause, edgeClause, buildBettorHeadline } from './summaryText'

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

describe('buildBettorHeadline', () => {
  const ME = { self: true, firstName: 'דני' } as const

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
    const h = buildBettorHeadline(r, adv, reach, 27, ME)
    // standing reads as a verdict: place in words, the title odds, and the projected slip
    expect(h.standing).toContain('אתה בראש הטבלה, מקום 1 מתוך 27')
    expect(h.standing).toContain('24.0% לזכייה')
    expect(h.standing).toContain('נסיגה למקום 5')
    expect(h.standing).toContain('402 נק׳')
    // the route ladder reads forward in RTL — arrows point right→left (' ← ')
    expect(h.route).toEqual({ teamHe: 'צרפת', ladder: 'שמינית 82% ← רבע 55% ← חצי 30% ← גמר 21% ← אלופה 13%' })
    // the *other* marquee calls, deepest first (the route team is not repeated)
    expect(h.bigBets).toBe('אנגליה לגמר (16%), ספרד לחצי הגמר (43%)')
    expect(h.strength).toBe('שלב הבתים +22, נעל זהב +7 (נק׳ מעל ממוצע המהמרים)')
    expect(h.weakness).toBeUndefined()
    expect(h.fallen).toBe('טורקיה')
  })

  test('writes the standing in third person for another bettor', () => {
    const r = row({ curRank: 9, expRank: 9, winPct: 0, top5Pct: 2, avgPts: 120, stages: [] })
    const h = buildBettorHeadline(r, null, {}, 27, { self: false, name: 'דנה' })
    expect(h.standing).toContain('דנה בחצי העליון, מקום 9 מתוך 27')
    expect(h.standing).toContain('כמעט מחוץ למרוץ על הזכייה')
    expect(h.standing).toContain('סיום סביב מקום 9')
  })

  test('flags an eliminated marquee pick and reports a weakness', () => {
    const adv = summary([pick({ team: 'ברזיל', predictedRank: 7, stage: 'out' })])
    const r = row({ stages: [stage('gb', 'נעל זהב', -15), stage('group', 'שלב הבתים', 5)] })
    const h = buildBettorHeadline(r, adv, {}, 27, ME)
    expect(h.route).toBeUndefined()
    expect(h.bigBets).toBe('ברזיל (לאליפות) — הודחה')
    expect(h.strength).toBe('שלב הבתים +5 (נק׳ מעל ממוצע המהמרים)')
    expect(h.weakness).toBe('נעל זהב −15 (נק׳ מתחת לממוצע)')
  })

  test('frames a runaway leader against the equal-split baseline and the next bettor', () => {
    const peers = [
      { label: 'יונתן', winPct: 32.3 },
      { label: 'קרן', winPct: 12.0 },
      { label: 'דנה', winPct: 9.1 },
    ]
    const r = row({ label: 'יונתן', curRank: 1, expRank: 4, winPct: 32.3, top5Pct: 76.5, avgPts: 435 })
    const h = buildBettorHeadline(r, null, {}, 26, { self: true, firstName: 'יונתן' }, peers)
    // equal split of 26 ≈ 3.8%, and 32.3 / 3.8 ≈ 8×; 32.3 / 12.0 ≈ 2.7×, named
    expect(h.peers).toBe('אם הסיכוי היה מתחלק שווה בין 26 המהמרים כל אחד היה ב-3.8% — הסיכוי שלך פי 8 מזה ופי 2.7 מהמהמר הבא בתור (קרן 12.0%).')
  })

  test('frames a trailing bettor against the current leader, in third person', () => {
    const peers = [
      { label: 'יונתן', winPct: 32.3 },
      { label: 'דנה', winPct: 9.1 },
    ]
    const r = row({ label: 'דנה', curRank: 6, expRank: 6, winPct: 9.1 })
    const h = buildBettorHeadline(r, null, {}, 26, { self: false, name: 'דנה' }, peers)
    expect(h.peers).toBe('המוביל יונתן ב-32.3% — פי 4 מהסיכוי של דנה (9.1%).')
  })

  test('omits the peers line when no peer data is supplied', () => {
    const h = buildBettorHeadline(row({ winPct: 20 }), null, {}, 26, ME)
    expect(h.peers).toBeUndefined()
  })

  test('routes a semifinal pick only as deep as it was backed', () => {
    const adv = summary([
      pick({ team: 'ספרד', predictedRank: 5, stage: 'likely' }),
      pick({ team: 'הולנד', predictedRank: 4, stage: 'bubble' }),
    ])
    const reach = { ספרד: sr({ r16: 0.8, qf: 0.6, sf: 0.43 }), הולנד: sr({ r16: 0.7, qf: 0.35 }) }
    const h = buildBettorHeadline(row({}), adv, reach, 27, ME)
    expect(h.route).toEqual({ teamHe: 'ספרד', ladder: 'שמינית 80% ← רבע 60% ← חצי 43%' })
    expect(h.bigBets).toBeUndefined()
  })
})
