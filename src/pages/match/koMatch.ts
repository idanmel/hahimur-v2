import { buildKnockoutBracket } from '../../formView/knockout/knockout'
import { allKO } from '../../formView/knockout/koRounds'
import { tournamentResults } from '../../tournament-results'
import { matchSortKey } from '../../shared/matchOrder'
import type { KnockoutMatch, KnockoutStages, PredictionsState } from '../../shared/types'

// The actual group scores, flattened into the predictions-shaped map the bracket
// builder consumes. Unresolved knockout slots come back as descriptor strings
// ("סגנית א") until the feeding groups are complete.
export function realGroupScores(): PredictionsState {
  const scores: PredictionsState = {}
  for (const matches of Object.values(tournamentResults.groupMatches))
    for (const m of matches) if (m.scores) scores[m.id] = m.scores
  return scores
}

// TEMP / local testing only: the Round-of-32 teams aren't decided until the
// groups finish, so the participating-bettors pages can't be exercised yet. With
// `?mockko` on a dev build, stand in the full set of resolved R32 fixtures so the
// pages light up. Never fires in a production build. Remove once R32 resolves.
const MOCK_KO: Record<number, KnockoutMatch> = {
  73: { matchNum: 73, home: 'South Korea', away: 'Canada', resolved: true, scores: { home: 1, away: 0 }, matchDate: '28 ביוני', kickoffIST: '22:00' },
  74: { matchNum: 74, home: 'Germany', away: 'Scotland', resolved: true, scores: { home: 1, away: 0 }, matchDate: '29 ביוני', kickoffIST: '23:30' },
  75: { matchNum: 75, home: 'Netherlands', away: 'Morocco', resolved: true, scores: { home: 0, away: 1 }, matchDate: '30 ביוני', kickoffIST: '04:00' },
  76: { matchNum: 76, home: 'Brazil', away: 'Japan', resolved: true, scores: { home: 1, away: 0 }, matchDate: '29 ביוני', kickoffIST: '20:00' },
  77: { matchNum: 77, home: 'France', away: 'Sweden', resolved: true, scores: { home: 1, away: 0 }, matchDate: '1 ביולי', kickoffIST: '00:00' },
  78: { matchNum: 78, home: 'Ivory Coast', away: 'Norway', resolved: true, scores: { home: 0, away: 0, drawWinner: 'away' }, matchDate: '30 ביוני', kickoffIST: '20:00' },
  79: { matchNum: 79, home: 'Mexico', away: 'Ecuador', resolved: true, scores: { home: 1, away: 1, drawWinner: 'home' }, matchDate: '1 ביולי', kickoffIST: '04:00' },
  80: { matchNum: 80, home: 'England', away: 'Senegal', resolved: true, scores: { home: 1, away: 0 }, matchDate: '1 ביולי', kickoffIST: '19:00' },
  81: { matchNum: 81, home: 'United States', away: 'Austria', resolved: true, scores: { home: 1, away: 0 }, matchDate: '2 ביולי', kickoffIST: '03:00' },
  82: { matchNum: 82, home: 'Belgium', away: 'Czech Republic', resolved: true, scores: { home: 0, away: 1 }, matchDate: '1 ביולי', kickoffIST: '23:00' },
  83: { matchNum: 83, home: 'Colombia', away: 'Croatia', resolved: true, scores: { home: 1, away: 0 }, matchDate: '3 ביולי', kickoffIST: '02:00' },
  84: { matchNum: 84, home: 'Spain', away: 'Algeria', resolved: true, scores: { home: 2, away: 0 }, matchDate: '2 ביולי', kickoffIST: '22:00' },
  85: { matchNum: 85, home: 'Switzerland', away: 'Iran', resolved: true, scores: { home: 1, away: 0 }, matchDate: '3 ביולי', kickoffIST: '06:00' },
  86: { matchNum: 86, home: 'Argentina', away: 'Uruguay', resolved: true, scores: { home: 1, away: 0 }, matchDate: '4 ביולי', kickoffIST: '01:00' },
  87: { matchNum: 87, home: 'Portugal', away: 'Ghana', resolved: true, scores: { home: 1, away: 0 }, matchDate: '4 ביולי', kickoffIST: '04:30' },
  88: { matchNum: 88, home: 'Turkey', away: 'Egypt', resolved: true, scores: { home: 0, away: 1 }, matchDate: '3 ביולי', kickoffIST: '21:00' },
}

export function mockEnabled(): boolean {
  return import.meta.env.DEV
    && typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).has('mockko')
}

// Pure lookup across every round of a derived bracket. Fixtures in knockoutStages
// already carry their baked result (regulation score + advancer) when one's been
// entered, so the match page renders the score straight off what this returns.
export function findInStages(stages: KnockoutStages, matchNum: number): KnockoutMatch | null {
  return allKO(stages).find(m => m.matchNum === matchNum) ?? null
}

export function findKnockoutMatch(matchNum: number): KnockoutMatch | null {
  if (mockEnabled() && MOCK_KO[matchNum]) return MOCK_KO[matchNum]
  return findInStages(tournamentResults.knockoutStages, matchNum)
}

const ROUND_LABELS: { upTo: number; label: string }[] = [
  { upTo: 88,  label: 'שלב ה-32' },
  { upTo: 96,  label: 'שמינית גמר' },
  { upTo: 100, label: 'רבע גמר' },
  { upTo: 102, label: 'חצי גמר' },
  { upTo: 103, label: 'מקום שלישי' },
  { upTo: 104, label: 'גמר' },
]

export function roundLabel(matchNum: number): string {
  return ROUND_LABELS.find(r => matchNum <= r.upTo)?.label ?? ''
}

// Which knockout stage the Venn diagram checks for a given match: the round the
// two teams had to reach to meet here. A R32 winner reaches the R16, a R16 winner
// the QF, and so on; the final asks about who was predicted as a finalist. Nobody
// *advances* into the third-place match — its teams are the semi losers — so it
// feeds no Venn; the page shows outright third-place picks instead (ThirdPlacePicks).
export type VennStage = 'r16' | 'qf' | 'sf' | 'final'

export const THIRD_PLACE_MATCH_NUM = 103

const VENN_STAGES: { upTo: number; stage: VennStage; label: string }[] = [
  { upTo: 88,  stage: 'r16',   label: 'שמינית גמר' },
  { upTo: 96,  stage: 'qf',    label: 'רבע גמר' },
  { upTo: 100, stage: 'sf',    label: 'חצי גמר' },
  { upTo: 102, stage: 'final', label: 'גמר' },
  { upTo: 104, stage: 'final', label: 'גמר' },
]

export function vennStage(matchNum: number): { stage: VennStage; label: string } | null {
  if (matchNum === THIRD_PLACE_MATCH_NUM) return null
  const match = VENN_STAGES.find(v => matchNum <= v.upTo)
  return match ? { stage: match.stage, label: match.label } : null
}

// The knockout opener (Jun 28, 22:00) — chronologically the first KO match and the
// one whose "previous" arrow steps back into the group stage.
export const FIRST_KO_MATCH_NUM = 73

// Previous/next knockout match in kickoff order. The numbers run by round, not by
// clock (76 kicks off before 74), so the nav arrows step through the bracket in the
// order matches are actually played. Null at the schedule's edges.
export function knockoutChronoNav(matchNum: number): { prevNum: number | null; nextNum: number | null } {
  const sorted = buildKnockoutBracket(realGroupScores())
    .sort((a, b) => matchSortKey(a.matchDate, a.kickoffIST) - matchSortKey(b.matchDate, b.kickoffIST))
  const i = sorted.findIndex(m => m.matchNum === matchNum)
  if (i === -1) return { prevNum: null, nextNum: null }
  return {
    prevNum: i > 0 ? sorted[i - 1].matchNum : null,
    nextNum: i < sorted.length - 1 ? sorted[i + 1].matchNum : null,
  }
}
