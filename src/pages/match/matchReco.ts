import type { GroupMatch, PredictionsState, TournamentResults } from '../../shared/types'
import type { User } from '../../users'
import { GROUP_MATCHES } from '../../shared/groups'
import { realPlayedState } from '../../leaderboard/winprob/realPlayed'
import {
  buildContext,
  scoreGroupOutcome,
  repScore,
  dir,
  he,
  slotsWon,
  describeSlots,
  listTeams,
  type Want,
  type GroupScore,
  type SelfScoreContext,
} from '../stats/group/selfScore'

export type { Want }

function choiceText(m: GroupMatch, want: Want): string {
  if (want === 'draw') return `תיקו בין ${he(m.homeTeam)} ל${he(m.awayTeam)}`
  const winner = want === 'home' ? m.homeTeam : m.awayTeam
  const loser = want === 'home' ? m.awayTeam : m.homeTeam
  return `${he(winner)} מנצחת את ${he(loser)}`
}

// One concrete, illustrated line in the "why this result is good/bad for you"
// explanation. `good` tints it (a plus or a minus for you).
export interface OutcomeReason {
  good: boolean
  textHe: string
}

export interface OutcomeEval {
  want: Want
  text: string
  // The points you'd earn from this group under this result (your scoreline +
  // exact order + advancers). Higher is better — the whole basis of the ranking.
  expPoints: number
  // How many points worse this outcome is than the best one (0 for the best).
  gapFromBest: number
  // Whether this is the result your own bracket roots for.
  matchesBracket: boolean
  // The concrete reasons this result helps or hurts *your bet*.
  reasons: OutcomeReason[]
}

export interface MatchRecommendation {
  decided: boolean        // the match already has a final score — nothing to advise
  matchId: string
  homeHe: string
  awayHe: string
  scored: boolean
  outcomes: OutcomeEval[]  // sorted best (most points) first
  best?: OutcomeEval
  naive?: OutcomeEval      // the result your own bracket roots for
  counterIntuitive: boolean
  noPreference: boolean    // all three outcomes are a wash for your bet
}

function findGroupMatch(matchId: string): GroupMatch | null {
  return (GROUP_MATCHES[matchId[0]] ?? []).find(m => m.id === matchId) ?? null
}

// The full group state for one candidate direction of the target match: real
// scores where settled, your own predicted scorelines for the group's other
// not-yet-played matches, and the candidate's representative scoreline for the
// target match. (So the card answers: "given your predictions for the rest of
// the group, which result here is best for you?")
function groupStateForMatch(
  user: User,
  groupLetter: string,
  settled: PredictionsState,
  targetId: string,
  want: Want,
): PredictionsState {
  const state: PredictionsState = {}
  for (const m of GROUP_MATCHES[groupLetter] ?? []) {
    if (settled[m.id]) { state[m.id] = settled[m.id]; continue }
    if (m.id === targetId) { state[m.id] = repScore(want, user.predictions[targetId]); continue }
    const pred = user.predictions[m.id]
    state[m.id] = pred && pred.home != null && pred.away != null
      ? { home: pred.home, away: pred.away }
      : { home: 1, away: 0 }
  }
  return state
}

const CAT = 1e-9

// The reasons one outcome is good/bad for you, read off the point components vs
// a reference scenario: for the best result the reference is the *worst*
// alternative (so it reads "what you secure"); for the others it's the best
// result (so it reads "what you give up"). Only your own bet is involved.
function buildReasons(
  m: GroupMatch,
  user: User,
  ctx: SelfScoreContext,
  want: Want,
  cur: GroupScore,
  ref: GroupScore,
  isBest: boolean,
  // True only when ALL three results give you the exact same number of place +
  // advancement points — i.e. this match can't change your standings *points* at
  // all, so the match prediction is the whole story. NOTE: this is about points,
  // not the literal order — two different orders can score the same place points,
  // so we never claim "the order comes out the same".
  standingsInvariant: boolean,
): OutcomeReason[] {
  const reasons: OutcomeReason[] = []
  const pred = user.predictions[m.id]
  const predDir = dir(pred)
  const isMatch = !!pred && predDir === want

  // 1) Your scoreline — the match points this result wins or misses.
  if (pred && predDir) {
    if (isMatch) {
      reasons.push({
        good: true,
        textHe: `ניחשת ${pred.home}–${pred.away} — התוצאה בכיוון הזה, אז יש פגיעה (ובול עליה צליפה).`,
      })
    } else {
      reasons.push({
        good: false,
        textHe: `ניחשת ${pred.home}–${pred.away} — תוצאה בכיוון אחר, אז אין פה פגיעה.`,
      })
    }
  }

  // 2) Your exact standings order — name the slots this result locks in or loses.
  const placeD = cur.placePoints - ref.placePoints
  if (placeD > CAT) {
    const won = slotsWon(cur.order, ref.order, ctx.predOrder).slice(0, 2)
    const nk = placeD > 1 ? `${placeD} נקודות מיקום` : 'נקודת מיקום'
    reasons.push({
      good: true,
      textHe: won.length
        ? `${describeSlots(won)} — בדיוק כמו שניחשת, ${nk} בזכות התוצאה הזו.`
        : `הסדר שניחשת בבית מסתדר טוב יותר כך — ${nk}.`,
    })
  } else if (placeD < -CAT) {
    const lost = slotsWon(ref.order, cur.order, ctx.predOrder).slice(0, 2)
    const nk = Math.abs(placeD) > 1 ? `${Math.abs(placeD)} נקודות מיקום` : 'נקודת מיקום'
    reasons.push({
      good: false,
      textHe: lost.length
        ? `${describeSlots(lost)} — לא קורה בתרחיש הזה, ${nk} פחות.`
        : `הסדר שניחשת בבית פחות מסתדר כך — ${nk} פחות.`,
    })
  }

  // 3) Your advancers — name the team whose advancement this result wins or costs.
  const advD = cur.advPoints - ref.advPoints
  if (advD > CAT) {
    const gained = cur.advancers.filter(t => !ref.advancers.includes(t))
    reasons.push({
      good: true,
      textHe: gained.length
        ? `${listTeams(gained)} ${gained.length > 1 ? 'עולות' : 'עולה'} מהבית כמו שניחשת — ${advD} נק' עלייה.`
        : `יותר מהקבוצות שניחשת עולות כך — ${advD} נק' עלייה.`,
    })
  } else if (advD < -CAT) {
    const dropped = ref.advancers.filter(t => !cur.advancers.includes(t))
    reasons.push({
      good: false,
      textHe: dropped.length
        ? `${listTeams(dropped)} כבר לא ${dropped.length > 1 ? 'עולות' : 'עולה'} מהבית בתרחיש הזה — ${Math.abs(advD)} נק' עלייה פחות.`
        : `פחות מהקבוצות שניחשת עולות כך — ${Math.abs(advD)} נק' עלייה פחות.`,
    })
  }

  // 4) A best-third pick that lands exactly 3rd here — the explained judgment.
  if (cur.thirdStatus && cur.thirdPick) {
    const teamHe = he(cur.thirdPick)
    if (cur.thirdStatus === 'in') {
      reasons.push({ good: true, textHe: `${teamHe} תסיים שלישית — ובטוח עולה כאחת מ‑8 השלישיות הטובות.` })
    } else if (cur.thirdStatus === 'out') {
      reasons.push({ good: false, textHe: `${teamHe} תסיים שלישית עם ${cur.thirdPoints} נק' — לא יספיק, כבר יש 8 שלישיות עם יותר נקודות.` })
    } else {
      reasons.push({ good: true, textHe: `${teamHe} תסיים שלישית — העלייה כשלישית עדיין פתוחה, תלוי בבתים שטרם נסגרו.` })
    }
  }

  // 5) No place/advancement *points* gap vs the reference. We speak strictly in
  //    points here — never about the literal order, since equal place points can
  //    hide a reshuffled table:
  //    - invariant: the match can't change your place/advancement points at all;
  //    - otherwise (a non-best result): it earns the same place/advancement points
  //      as the recommended result, so the only gap is the match prediction.
  const standingsMovedVsRef = Math.abs(placeD) > CAT || Math.abs(advD) > CAT || !!cur.thirdStatus
  if (!standingsMovedVsRef) {
    if (standingsInvariant) {
      reasons.push({
        good: isMatch,
        textHe: isMatch
          ? 'איך שהמשחק לא ייגמר, נקודות המיקום והעלייה שלך בבית לא משתנות — לכן עדיף פשוט לקחת את נקודות הניחוש על המשחק.'
          : 'איך שהמשחק לא ייגמר, נקודות המיקום והעלייה שלך בבית לא משתנות — ההפרש הוא רק נקודות הניחוש שתפספס כאן.',
      })
    } else if (!isBest) {
      reasons.push({
        good: false,
        textHe: 'נקודות המיקום והעלייה כאן זהות לתוצאה המומלצת — ההפרש היחיד הוא נקודות הניחוש שתפספס כאן.',
      })
    }
  }

  return reasons.slice(0, 4)
}

// The result that's best for you in `matchId`, judged only on your group bet:
// your scoreline points, your exact standings order (goal-difference aware) and
// your advancers (top-2 and, when it applies, a best-third pick). Deterministic —
// no simulation, no other players.
export function recommendMatchOutcome(
  user: User,
  matchId: string,
  results: TournamentResults,
): MatchRecommendation | null {
  const m = findGroupMatch(matchId)
  if (!m) return null

  const live = results.live ?? {}
  const settled: PredictionsState = {}
  for (const [id, s] of Object.entries(realPlayedState(results))) {
    if (!live[id]) settled[id] = s
  }

  const base = {
    decided: false, matchId, homeHe: he(m.homeTeam), awayHe: he(m.awayTeam),
    counterIntuitive: false, noPreference: false,
  }

  // Already finished (final score, not a live in-progress one) → decided.
  if (settled[matchId]) {
    return { ...base, decided: true, scored: false, outcomes: [] }
  }

  const groupLetter = matchId[0]
  const ctx: SelfScoreContext = buildContext(user, groupLetter, settled)

  const wants: Want[] = ['home', 'draw', 'away']
  const scores = new Map<Want, GroupScore>()
  for (const want of wants) {
    const state = groupStateForMatch(user, groupLetter, settled, matchId, want)
    scores.set(want, scoreGroupOutcome(user, ctx, state))
  }

  const naiveW: Want = dir(user.predictions[matchId]) ?? 'home'
  const totalOf = (w: Want) => scores.get(w)!.total

  // Best = most of *your* points; ties stay on the result you predicted, then
  // prefer the safer third (more points for an at-risk best-third pick).
  const bestW = [...wants].sort((a, b) => {
    const d = totalOf(b) - totalOf(a)
    if (Math.abs(d) > CAT) return d
    if (a === naiveW) return -1
    if (b === naiveW) return 1
    return (scores.get(b)!.thirdPoints ?? 0) - (scores.get(a)!.thirdPoints ?? 0)
  })[0]

  const totals = wants.map(totalOf)
  const spread = Math.max(...totals) - Math.min(...totals)
  const noPreference = spread <= CAT

  // Does this match leave your place + advancement POINTS untouched no matter how
  // it ends? Only then is it honest to say "this match can't change your standings
  // points". (We compare points, not the literal order: a different order can earn
  // you the same place points, and your advancers can swap while the count holds.)
  const scoreList = wants.map(w => scores.get(w)!)
  const standingsInvariant = scoreList.every(s =>
    Math.abs(s.placePoints - scoreList[0].placePoints) < CAT &&
    Math.abs(s.advPoints - scoreList[0].advPoints) < CAT &&
    (s.thirdStatus ?? '') === (scoreList[0].thirdStatus ?? ''))

  // Reference for the best outcome: the worst alternative (what you secure).
  const worstAltW = [...wants].filter(w => w !== bestW).sort((a, b) => totalOf(a) - totalOf(b))[0]
  const bestScore = scores.get(bestW)!

  const outcomes: OutcomeEval[] = wants.map(want => {
    const cur = scores.get(want)!
    const ref = want === bestW ? scores.get(worstAltW)! : bestScore
    return {
      want,
      text: choiceText(m, want),
      expPoints: cur.total,
      gapFromBest: bestScore.total - cur.total,
      matchesBracket: want === naiveW,
      reasons: noPreference ? [] : buildReasons(m, user, ctx, want, cur, ref, want === bestW, standingsInvariant),
    }
  })

  return {
    ...base,
    scored: true,
    outcomes: [...outcomes].sort((a, b) => b.expPoints - a.expPoints),
    best: outcomes.find(o => o.want === bestW)!,
    naive: outcomes.find(o => o.want === naiveW)!,
    counterIntuitive: !noPreference && bestW !== naiveW,
    noPreference,
  }
}
