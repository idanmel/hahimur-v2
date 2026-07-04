/**
 * Decisive test for the "Karni saw the forms and optimized to win" claim.
 *
 * We build FIELD-BLIND strong brackets straight from the model (no knowledge of
 * any rival form) and drop them into the same field, then compare their win% to
 * Karni's under identical sims:
 *   - MODAL     : each match = the single most-likely scoreline (Poisson mode).
 *   - FAV-LEAN  : modal, but break near-draws toward the stronger side (what a
 *                 sensible favorites-AI produces).
 *
 * Logic:
 *   - If a field-blind optimal bracket wins ~as often as Karni  -> his 17% is
 *     just "what the best forecast gets" vs this field; NO field-specific edge.
 *   - If Karni wins MUCH more than the best field-blind bracket -> his edge is
 *     field-SPECIFIC (differentiated against the actual rivals) = the fingerprint
 *     of having optimized against the forms.
 */
import { runSims, buildRows } from '../sim-core'
import { USERS, type User } from '../src/users'
import { GROUP_MATCHES, ALL_GROUP_LETTERS } from '../src/shared/groups'
import { calculateStandings } from '../src/shared/standings'
import { getThirdPlaceTeams, qualifyBestThirdPlace } from '../src/formView/thirdPlace/thirdPlace'
import { resolveRound32, resolveKnockout } from '../src/formView/knockout/knockout'
import { matchLambdas } from '../src/shared/lambdas'
import { SCORERS } from '../golden-boot'
import type { PredictionsState, MatchScores, KnockoutMatch, Standing, ThirdPlaceQualification } from '../src/shared/types'

type Mode = 'modal' | 'fav'
function score(home: string, away: string, mode: Mode): MatchScores {
  const [lh, la] = matchLambdas(home, away)
  let h = Math.floor(lh), a = Math.floor(la)
  if (mode === 'fav' && h === a && Math.abs(lh - la) >= 0.2) {
    if (lh > la) h += 1; else a += 1
  }
  return { home: h, away: a }
}
function koScore(home: string, away: string, mode: Mode): MatchScores {
  const s = score(home, away, mode)
  if (s.home === s.away) {
    const [lh, la] = matchLambdas(home, away)
    return { ...s, drawWinner: lh >= la ? 'home' : 'away' }
  }
  return s
}
function koWinner(m: KnockoutMatch, preds: PredictionsState): string {
  const s = preds[String(m.matchNum)]
  if (!s || s.home == null || s.away == null) return ''
  if (s.home > s.away) return m.home
  if (s.away > s.home) return m.away
  return s.drawWinner === 'home' ? m.home : m.away
}
const withScore = (m: KnockoutMatch, preds: PredictionsState): KnockoutMatch => ({ ...m, scores: preds[String(m.matchNum)] ?? { home: null, away: null } })
function fillRound(matches: KnockoutMatch[], preds: PredictionsState, mode: Mode) {
  for (const m of matches) {
    if (!m.resolved || !m.home || !m.away) continue
    const cur = preds[String(m.matchNum)]
    if (cur && cur.home != null && cur.away != null) continue
    preds[String(m.matchNum)] = koScore(m.home, m.away, mode)
  }
}
function resolveThird(allGroupData: { group: string; standings: Standing[]; allFilled: boolean }[]): ThirdPlaceQualification {
  const q = qualifyBestThirdPlace(getThirdPlaceTeams(allGroupData))
  if (q.resolved) return q
  return { resolved: true, all: q.all, qualifiers: q.all.slice(0, 8) }
}

function buildOptimal(mode: Mode, label: string): User {
  const preds: PredictionsState = {}
  for (const l of ALL_GROUP_LETTERS) for (const m of GROUP_MATCHES[l]) preds[m.id] = score(m.homeTeam, m.awayTeam, mode)
  const allGroupData = ALL_GROUP_LETTERS.map(l => ({ group: l, standings: calculateStandings(GROUP_MATCHES[l], preds).standings, allFilled: true }))
  const third = resolveThird(allGroupData)
  const round32 = resolveRound32(allGroupData, third)
  fillRound(round32, preds, mode); let ko = resolveKnockout(round32, preds)
  fillRound(ko.r16, preds, mode); ko = resolveKnockout(round32, preds)
  fillRound(ko.qf, preds, mode); ko = resolveKnockout(round32, preds)
  fillRound(ko.sf, preds, mode); ko = resolveKnockout(round32, preds)
  fillRound([ko.thirdPlace, ko.final], preds, mode); ko = resolveKnockout(round32, preds)

  const knockoutStages = {
    r32: round32.map(m => withScore(m, preds)),
    r16: ko.r16.map(m => withScore(m, preds)),
    qf: ko.qf.map(m => withScore(m, preds)),
    sf: ko.sf.map(m => withScore(m, preds)),
    thirdPlace: [withScore(ko.thirdPlace, preds)],
    final: [withScore(ko.final, preds)],
  }
  // best scorer by expected goals over the depth this bracket takes their team
  const koMatches = [...knockoutStages.r32, ...knockoutStages.r16, ...knockoutStages.qf, ...knockoutStages.sf, ...knockoutStages.thirdPlace, ...knockoutStages.final]
  const games = (t: string) => 3 + koMatches.filter(m => m.home === t || m.away === t).length
  const scorer = [...SCORERS].sort((a, b) => b.ratePerMatch * games(b.team) - a.ratePerMatch * games(a.team))[0].name

  return {
    label,
    topGoalscorer: scorer,
    groupMatches: Object.fromEntries(ALL_GROUP_LETTERS.map(l => [l, GROUP_MATCHES[l].map(m => ({ ...m, scores: preds[m.id] }))])),
    groupTables: Object.fromEntries(allGroupData.map(d => [d.group, d.standings])),
    thirdPlaceQualification: third,
    knockoutStages,
    predictedChampion: koWinner(ko.final, preds),
    predictedThirdPlaceWinner: koWinner(ko.thirdPlace, preds),
    predictions: {} as never,
  } as User
}

const N = Number(process.argv[2] ?? 8000)
const modal = buildOptimal('modal', 'BASELINE-MODAL')
const fav = buildOptimal('fav', 'BASELINE-FAV')
console.log(`MODAL champion: ${modal.predictedChampion}; FAV champion: ${fav.predictedChampion}`)

USERS.push(modal, fav)
const real = runSims({}, N, 12345, true, {})
const rows = buildRows(real, N, {}, {})
const byWin = [...rows].sort((a, b) => b.winPct - a.winPct)
const byPts = [...rows].sort((a, b) => b.avgPts - a.avgPts)
const ptsRank = new Map(byPts.map((r, i) => [r.label, i + 1]))
const show = new Set(['יונתן קרני', 'ליאור מולדובן', 'BASELINE-MODAL', 'BASELINE-FAV', 'יניב קליין'])

console.log(`\nN=${N}, field now ${USERS.length} forms (26 real + 2 synthetic). avg win% ${(100 / USERS.length).toFixed(2)}%\n`)
console.log('#  name'.padEnd(26), 'win%'.padStart(7), 'xPts'.padStart(7), 'P95'.padStart(6), 'ptsRk'.padStart(6))
byWin.forEach((r, i) => {
  const mark = show.has(r.label) ? '  <--' : ''
  if (i < 8 || show.has(r.label)) console.log(
    `${String(i + 1).padStart(2)} ${r.label}`.padEnd(26),
    r.winPct.toFixed(2).padStart(7),
    r.avgPts.toFixed(0).padStart(7),
    r.ceiling.toFixed(0).padStart(6),
    String(ptsRank.get(r.label)).padStart(6),
    mark,
  )
})
const k = byWin.find(r => r.label === 'יונתן קרני')!
const bestBase = [modal, fav].map(b => byWin.find(r => r.label === b.label)!).sort((a, b) => b.winPct - a.winPct)[0]
console.log(`\nKarni win% ${k.winPct.toFixed(2)} vs best field-blind baseline (${bestBase.label}) ${bestBase.winPct.toFixed(2)} -> ratio ${(k.winPct / bestBase.winPct).toFixed(2)}x`)
console.log(`Karni xPts ${k.avgPts.toFixed(0)} vs baseline ${bestBase.avgPts.toFixed(0)}`)
