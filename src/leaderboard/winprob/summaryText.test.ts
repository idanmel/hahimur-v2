import { describe, test, expect } from 'vitest'
import type { Row, AdvancementSummary, PickStatus, StageReach, StageStat } from '../../../sim-core'
import { deepPicksClause, groupPicksClause, edgeClause, buildBettorHeadline, advancersClause, crossingsClause, goldenBootClause, potentialClause, fragilityClause, nextStepClause, buildStageForecast, stageForecastTotalEdge } from './summaryText'

function pick(over: Partial<PickStatus> & { team: string; predictedRank: number; stage: PickStatus['stage'] }): PickStatus {
  return { teamHe: over.team, reach: 0, groupFirst: 0, topsGroup: false, ...over }
}
function summary(picks: PickStatus[]): AdvancementSummary {
  const c = (s: PickStatus['stage']) => picks.filter(p => p.stage === s).length
  return { picks, secured: c('secured'), likely: c('likely'), bubble: c('bubble'), longshot: c('longshot'), out: c('out'), total: picks.length, decided: c('bubble') + c('longshot') === 0 }
}
const sr = (over: Partial<StageReach>): StageReach => ({ r32: 0, r16: 0, qf: 0, sf: 0, final: 0, champion: 0, ...over })
function stage(key: string, label: string, edge: number, val = 0, field = 0): StageStat {
  return { key: key as StageStat['key'], label, val, field, edge }
}
function row(over: Partial<Row>): Row {
  return { label: 'מי', winPct: 0, top3Pct: 0, top5Pct: 0, avgPts: 0, std: 0, ceiling: 0, curRank: 1, expRank: 1, turkey: '', championHe: '', championTeam: '', championAlive: true, scorer: '', scorerBootPct: 0, reason: '', stages: [], ...over }
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

describe('advancersClause', () => {
  test('counts the backed teams that escaped the group and the points banked', () => {
    const adv = summary([
      pick({ team: 'ספרד', predictedRank: 1, stage: 'secured', reach: 1 }),
      pick({ team: 'גרמניה', predictedRank: 2, stage: 'secured', reach: 1 }),
      pick({ team: 'טורקיה', predictedRank: 2, stage: 'out', reach: 0 }),
    ])
    expect(advancersClause(adv)).toBe('2 מתוך 3 שבחרת עלו מהבתים — 8 נק׳ עלייה כבר בכיס')
  })
  test('reads honestly when none advanced', () => {
    expect(advancersClause(summary([pick({ team: 'טורקיה', predictedRank: 2, stage: 'out', reach: 0 })])))
      .toBe('אף אחת מ-1 הקבוצות שבחרת לא עלתה מהבתים')
  })
  test('returns null with no advancement picks', () => {
    expect(advancersClause(summary([]))).toBeNull()
  })
  test('adds the group-stage comparison vs the field when a row is given', () => {
    const adv = summary([pick({ team: 'ספרד', predictedRank: 1, stage: 'secured', reach: 1 })])
    const r = row({ stages: [stage('group', 'שלב הבתים', 18)] })
    r.stages[0] = { ...r.stages[0], val: 70, field: 52 }
    expect(advancersClause(adv, r)).toBe('1 מתוך 1 שבחרת עלו מהבתים — 4 נק׳ עלייה כבר בכיס · בשלב הבתים 70 נק׳ מול 52 בממוצע (+18)')
  })
})

describe('nextStepClause', () => {
  test('names each rare live deep pick with its depth, chance, and how lonely the call is', () => {
    expect(nextStepClause({ picks: [
      { teamHe: 'ספרד', predictedRank: 5, pct: 43, others: 0 },
      { teamHe: 'צרפת', predictedRank: 6, pct: 21, others: 2 },
    ] })).toBe('ספרד לחצי הגמר 43% (רק אתה עליה) · צרפת לגמר 21% (עוד 2 עליה)')
  })
  test('returns null when there is nothing differentiating to chase', () => {
    expect(nextStepClause({ picks: [] })).toBeNull()
  })
})

describe('advancersClause — compact once knockouts start', () => {
  test('drops the field-average tail and keeps only the banked-points note', () => {
    const adv = summary([pick({ team: 'ספרד', predictedRank: 1, stage: 'secured', reach: 1 })])
    const r = row({ stages: [stage('group', 'שלב הבתים', 18, 70, 52)] })
    expect(advancersClause(adv, r, true)).toBe('1 מתוך 1 שבחרת עלו מהבתים — 4 נק׳ עלייה כבר בכיס')
  })
})

describe('crossingsClause', () => {
  test('joins locked, still-possible (with the likeliest named), and broken', () => {
    expect(crossingsClause({ locked: 3, liveCount: 2, broken: 1, topLive: { a: 'ספרד', b: 'גרמניה', pct: 41 } }))
      .toBe('3 כבר נעולות — המפגש מובטח · 2 עוד אפשריות (הקרובה: ספרד–גרמניה 41%) · 1 כבר נשברו')
  })
  test('returns null when there is nothing to say', () => {
    expect(crossingsClause({ locked: 0, liveCount: 0, broken: 0 })).toBeNull()
  })
  test('appends the R32 points comparison vs the field when a row is given', () => {
    const r = row({ stages: [stage('r32', 'שלב 32', -9)] })
    r.stages[0] = { ...r.stages[0], val: 24, field: 33 }
    expect(crossingsClause({ locked: 2, liveCount: 0, broken: 1 }, r))
      .toBe('2 כבר נעולות — המפגש מובטח · 1 כבר נשברו · בשלב ה-32 24 נק׳ צפויות מול 33 בממוצע (−9)')
  })
  test('once the round is done it reads as a settled summary — no future tense', () => {
    const r = row({ stages: [stage('r32', 'שלב 32', -9)] })
    r.stages[0] = { ...r.stages[0], val: 24, field: 33 }
    expect(crossingsClause({ locked: 2, liveCount: 0, broken: 1, done: true }, r))
      .toBe('2 מתוך 3 מפגשים שחזית התקיימו · בשלב ה-32 24 נק׳ מול 33 בממוצע (−9)')
  })
})

describe('buildStageForecast', () => {
  const r = row({ stages: [
    stage('group', 'שלב הבתים', 22, 80, 58),
    stage('r32', 'שלב 32', -9, 24, 33),
    stage('r16', 'שמינית גמר', 4.4, 18.2, 13.8),
    stage('qf', 'רבע גמר', 6, 12, 6),
    stage('sf', 'חצי גמר', -2, 5, 7),
    stage('third', 'מקום שלישי', 3, 5, 2),
    stage('final', 'גמר', 8, 14, 6),
    stage('gb', 'נעל זהב', 3, 10, 7),
  ] })

  test('keeps only the knockout ladder, in bracket order (third place included), rounded', () => {
    const fc = buildStageForecast(r)
    expect(fc.map(s => s.key)).toEqual(['r32', 'r16', 'qf', 'sf', 'third', 'final'])
    // group and golden boot are shown elsewhere, so they're excluded here
    expect(fc.some(s => s.key === 'group' || s.key === 'gb')).toBe(false)
    // values are rounded for display
    expect(fc[1]).toMatchObject({ label: 'שמינית גמר', mine: 18, field: 14, edge: 4 })
  })

  test('marks each round with the phase it is given, defaulting to upcoming', () => {
    const fc = buildStageForecast(r, { r32: 'done', r16: 'live' })
    expect(fc.find(s => s.key === 'r32')!.phase).toBe('done')
    expect(fc.find(s => s.key === 'r16')!.phase).toBe('live')
    expect(fc.find(s => s.key === 'qf')!.phase).toBe('upcoming')
  })

  test('total edge sums the rounded knockout gaps for the takeaway line', () => {
    // −9 + 4 + 6 + (−2) + 3 + 8 = 10
    expect(stageForecastTotalEdge(buildStageForecast(r))).toBe(10)
  })
})

describe('potentialClause', () => {
  test('sums the per-stage edges into a total gap and names the biggest lever', () => {
    const r = row({ stages: [stage('group', 'שלב הבתים', 8), stage('final', 'גמר', 22), stage('gb', 'נעל זהב', -5)] })
    expect(potentialClause(r)).toBe('הצפי הכולל שלך כ-25 נק׳ מעל ממוצע המהמרים — עיקר היתרון: גמר +22 נק׳')
  })
  test('frames a deficit when the bettor trails the field', () => {
    const r = row({ stages: [stage('group', 'שלב הבתים', -4), stage('sf', 'חצי גמר', -16)] })
    expect(potentialClause(r)).toBe('הצפי הכולל שלך כ-20 נק׳ מתחת לממוצע המהמרים — עיקר הפיגור: חצי גמר −16 נק׳')
  })
  test('returns null without stage data', () => {
    expect(potentialClause(row({ stages: [] }))).toBeNull()
  })
})

describe('fragilityClause', () => {
  test('leads with the rare differentiating picks and notes the consensus ones', () => {
    expect(fragilityClause({
      rare: [{ teamHe: 'צרפת', others: 2 }, { teamHe: 'ספרד', others: 0 }],
      consensus: [{ teamHe: 'אנגליה', others: 11 }],
    })).toBe('מה שבאמת מזיז את הסיכוי שלך: צרפת (עוד 2), ספרד (ייחודית לך) — מעטים הימרו עליהן, שם נקבע הפער מול המתחרים. אנגליה (עוד 11) קונצנזוס — אם ייפלו, כל המתחרים נופלים יחד, אז מיקומך כמעט לא ישתנה')
  })
  test('shows only the consensus note when nothing is rare', () => {
    expect(fragilityClause({ rare: [], consensus: [{ teamHe: 'ספרד', others: 9 }] }))
      .toBe('ספרד (עוד 9) קונצנזוס — אם ייפלו, כל המתחרים נופלים יחד, אז מיקומך כמעט לא ישתנה')
  })
  test('returns null when there is nothing differentiating', () => {
    expect(fragilityClause({ rare: [], consensus: [] })).toBeNull()
  })
})

describe('goldenBootClause', () => {
  test('shows goals so far and the edge when meaningful', () => {
    expect(goldenBootClause({ scorerHe: 'הארי קיין', goalsSoFar: 4, alive: true, edge: 8 }))
      .toBe('הארי קיין — 4 שערים עד כה · +8 נק׳ מול הממוצע')
  })
  test('flags an eliminated scorer team over the edge', () => {
    expect(goldenBootClause({ scorerHe: 'ויניסיוס ג׳וניור', goalsSoFar: 0, alive: false, edge: 10 }))
      .toBe('ויניסיוס ג׳וניור — טרם כבש · הקבוצה הודחה')
  })
  test('returns null without a scorer pick', () => {
    expect(goldenBootClause({ scorerHe: '—', goalsSoFar: 0, alive: true, edge: 0 })).toBeNull()
  })
})

describe('buildBettorHeadline', () => {
  const ME = { self: true, firstName: 'דני' } as const

  test('shows standing, the deepest pick route, other marquee calls, advancers, edge, and eliminated picks', () => {
    const adv = summary([
      pick({ team: 'צרפת', predictedRank: 7, stage: 'likely', reach: 1 }),
      pick({ team: 'אנגליה', predictedRank: 6, stage: 'likely', reach: 1 }),
      pick({ team: 'ספרד', predictedRank: 5, stage: 'likely', reach: 1 }),
      pick({ team: 'טורקיה', predictedRank: 2, stage: 'out', reach: 0 }),
    ])
    const reach = {
      צרפת: sr({ r16: 0.82, qf: 0.55, sf: 0.3, final: 0.21, champion: 0.13 }),
      אנגליה: sr({ final: 0.16 }), ספרד: sr({ sf: 0.43 }),
    }
    const r = row({ curRank: 1, expRank: 5, winPct: 24, top5Pct: 63.6, avgPts: 402, stages: [stage('group', 'שלב הבתים', 22, 80, 58), stage('gb', 'נעל זהב', 7)] })
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
    // three of four backed teams escaped the group → 12 banked, plus the field comparison
    expect(h.advancers).toBe('3 מתוך 4 שבחרת עלו מהבתים — 12 נק׳ עלייה כבר בכיס · בשלב הבתים 80 נק׳ מול 58 בממוצע (+22)')
    // the gap-explainer: total edge summed across stages, biggest lever named
    expect(h.potential).toBe('הצפי הכולל שלך כ-29 נק׳ מעל ממוצע המהמרים — עיקר היתרון: שלב הבתים +22 נק׳')
    expect(h.eliminated).toBe('טורקיה')
  })

  test('writes the standing in third person for another bettor', () => {
    const r = row({ curRank: 9, expRank: 9, winPct: 0, top5Pct: 2, avgPts: 120, stages: [] })
    const h = buildBettorHeadline(r, null, {}, 27, { self: false, name: 'דנה' })
    expect(h.standing).toContain('דנה בחצי העליון, מקום 9 מתוך 27')
    expect(h.standing).toContain('כמעט מחוץ למרוץ על הזכייה')
    expect(h.standing).toContain('סיום סביב מקום 9')
  })

  test('flags an eliminated marquee pick and explains the points deficit', () => {
    const adv = summary([pick({ team: 'ברזיל', predictedRank: 7, stage: 'out' })])
    const r = row({ stages: [stage('gb', 'נעל זהב', -15), stage('group', 'שלב הבתים', 5, 30, 25)] })
    const h = buildBettorHeadline(r, adv, {}, 27, ME)
    expect(h.route).toBeUndefined()
    expect(h.bigBets).toBe('ברזיל (לאליפות) — הודחה')
    expect(h.potential).toBe('הצפי הכולל שלך כ-10 נק׳ מתחת לממוצע המהמרים — עיקר הפיגור: נעל זהב −15 נק׳')
    expect(h.eliminated).toBe('ברזיל')
  })

  test('threads the crossings and golden-boot digests into the read', () => {
    const adv = summary([pick({ team: 'ספרד', predictedRank: 5, stage: 'likely', reach: 1 })])
    const r = row({ scorer: 'הארי קיין', stages: [] })
    const h = buildBettorHeadline(r, adv, {}, 27, ME,
      { locked: 2, liveCount: 1, broken: 1, topLive: { a: 'גרמניה', b: 'ברזיל', pct: 38 } },
      { scorerHe: 'הארי קיין', goalsSoFar: 3, alive: true, edge: 6 })
    expect(h.crossings).toBe('2 כבר נעולות — המפגש מובטח · 1 עוד אפשריות (הקרובה: גרמניה–ברזיל 38%) · 1 כבר נשברו')
    expect(h.goldenBoot).toBe('הארי קיין — 3 שערים עד כה · +6 נק׳ מול הממוצע')
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

  test('once knockouts start: compresses advancers, keeps only knockout losses in eliminated, and leads with the forward line', () => {
    const adv = summary([
      pick({ team: 'ספרד', predictedRank: 5, stage: 'likely', reach: 1 }),    // deep, alive
      pick({ team: 'ברזיל', predictedRank: 7, stage: 'out', reach: 1 }),       // reached R32 then fell → a knockout loss
      pick({ team: 'ארגנטינה', predictedRank: 6, stage: 'out', reach: 0 }),    // deep pick that never left the group → not a KO loss
      pick({ team: 'טורקיה', predictedRank: 2, stage: 'out', reach: 0 }),      // shallow group bust → dropped
    ])
    const r = row({ stages: [stage('group', 'שלב הבתים', 18, 70, 52)] })
    const nextStep = { picks: [{ teamHe: 'ספרד', predictedRank: 5, pct: 43, others: 0 }] }
    const h = buildBettorHeadline(r, adv, {}, 27, ME, null, null, null, true, nextStep)
    expect(h.nextStep).toBe('ספרד לחצי הגמר 43% (רק אתה עליה)')
    // advancers has no field-average tail once the group is history
    expect(h.advancers).toBe('2 מתוך 4 שבחרת עלו מהבתים — 8 נק׳ עלייה כבר בכיס')
    // only teams that reached the bracket and then lost remain; group flops (deep or not) are gone
    expect(h.eliminated).toBe('ברזיל')
  })

  test('a leader the model expects to slip gets a blunt "leading now, but" verdict', () => {
    const h = buildBettorHeadline(row({ curRank: 1, expRank: 4, avgPts: 402 }), null, {}, 27, ME)
    expect(h.standing).toContain('מוביל כעת אך המודל צופה נסיגה למקום 4')
  })
})
