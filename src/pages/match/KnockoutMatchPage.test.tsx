import { render, screen, within } from '@testing-library/react'
import { vi } from 'vitest'
import KnockoutMatchPage from './KnockoutMatchPage'
import { findKnockoutMatch } from './koMatch'
import { useLiveResults } from '../../shared/useLiveResults'
import { tournamentResults } from '../../tournament-results'
import type { KnockoutMatch } from '../../shared/types'
import type { User } from '../../users/index'

// Nav renders a participant picker we don't care about here.
vi.mock('../../Nav', () => ({ default: () => null, USER_STORAGE_EVENT: 'userStorageUpdated' }))

// The live feed is stubbed so a test can put a knockout match "in progress".
// Default: nothing live, so the page sees the baked (mocked) results unchanged.
vi.mock('../../shared/useLiveResults', () => ({ useLiveResults: vi.fn() }))
beforeEach(() => {
  vi.mocked(useLiveResults).mockReturnValue(tournamentResults)
})

// Pin the baked results to empty so the knockout points table reflects only the
// bettors' knockout predictions, not whatever live group scores happen to exist.
// knockoutStages is still derived the way production does (empty groups → all-
// placeholder fixtures, no baked scores), since findKnockoutMatch now sources the
// match the page renders from it.
vi.mock('../../tournament-results', async () => {
  const { deriveKnockoutStages } = await import('../../formView/knockout/deriveKnockoutStages')
  return {
    tournamentResults: { groupMatches: {}, groupTables: {}, playerMatchGoals: {}, knockoutStages: deriveKnockoutStages({}, {}), thirdPlaceQualification: { resolved: false, all: [], tied: [] } },
    derivePlayerGoals: () => ({}),
  }
})

// Keep the real bracket/labels, but make findKnockoutMatch swappable so a test
// can stand in a resolved fixture without the dev-only ?mockko path.
vi.mock('./koMatch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./koMatch')>()
  return { ...actual, findKnockoutMatch: vi.fn(actual.findKnockoutMatch) }
})

// When one slot has resolved to a real team but the other is still pending, the
// header mixes a flagged team name with a bare descriptor. Use a fixture so this
// doesn't depend on which groups happen to be complete in the live results.
test('shows a descriptor for the pending slot and the resolved team', () => {
  vi.mocked(findKnockoutMatch).mockReturnValueOnce({
    matchNum: 73, home: 'סגנית א', away: 'Canada', resolved: false,
    scores: { home: null, away: null }, matchDate: '28 ביוני', kickoffIST: '22:00',
  })
  // Pin "now" before kickoff so the header shows the kickoff meta row, not the
  // live indicator (this test is about the slot descriptors, not liveness).
  render(<KnockoutMatchPage matchNum={73} now={new Date('2026-06-27T12:00:00Z')} />)
  const teamNames = Array.from(document.querySelectorAll('.match-team__name')).map(n => n.textContent)
  expect(teamNames).toEqual(expect.arrayContaining(['סגנית א', 'קנדה']))
  expect(screen.getByText(/שלב ה-32/)).toBeInTheDocument()
  expect(screen.getByText('28 ביוני')).toBeInTheDocument()
  // The pending slot has no flag; the resolved one shows Canada's.
  expect(document.querySelector('.match-header__teams .fi-ca')).toBeInTheDocument()
  expect(document.querySelectorAll('.match-header__teams .fi')).toHaveLength(1)
})

// Match 74's away slot is a 3rd-place/allocation slot: before the qualification
// resolves we can't name the single source group, but the matrix narrows it to a
// fixed set of 5, so we list them instead of a bare placeholder.
test('lists the possible source groups for an unresolved third-place slot', () => {
  render(<KnockoutMatchPage matchNum={74} />)
  expect(screen.getByText('מנצח ה')).toBeInTheDocument()
  expect(screen.getByText('שלישית א/ב/ג/ד/ו')).toBeInTheDocument()
})

// Once the slots resolve to real teams, the header shows Hebrew names with flags.
test('shows Hebrew team names and flags for a resolved match', () => {
  vi.mocked(findKnockoutMatch).mockReturnValueOnce({
    matchNum: 73, home: 'South Korea', away: 'Canada', resolved: true,
    scores: { home: 1, away: 0 }, matchDate: '28 ביוני', kickoffIST: '22:00',
  })
  render(<KnockoutMatchPage matchNum={73} />)
  expect(screen.getByText('דרום קוריאה')).toBeInTheDocument()
  expect(screen.getByText('קנדה')).toBeInTheDocument()
  expect(document.querySelector('.fi-kr')).toBeInTheDocument()
  expect(document.querySelector('.fi-ca')).toBeInTheDocument()
})

// Parity with the group header: a finished knockout match shows its real score in
// the header, with the "נגמר" badge — not a bare dash.
test('shows the real score in the header for a finished match', () => {
  vi.mocked(findKnockoutMatch).mockReturnValueOnce({
    matchNum: 73, home: 'South Korea', away: 'Canada', resolved: true,
    scores: { home: 1, away: 0 }, matchDate: '28 ביוני', kickoffIST: '22:00',
  })
  render(<KnockoutMatchPage matchNum={73} />)
  const score = screen.getByTestId('real-score')
  // Away (Canada) digit first, then home (South Korea) — same orientation as the
  // rest of the page.
  expect(score.textContent).toContain('0')
  expect(score.textContent).toContain('1')
  expect(screen.getByText('נגמר')).toBeInTheDocument()
})

// Parity with the group page: while a knockout match is being played the header
// shows the live score from the feed with a "חי" badge and the minute — not the
// kickoff time and not the "נגמר" badge.
test('shows the live score with a חי badge while a knockout match is in progress', () => {
  vi.mocked(findKnockoutMatch).mockReturnValueOnce({
    matchNum: 73, home: 'South Korea', away: 'Canada', resolved: false,
    scores: { home: null, away: null }, matchDate: '28 ביוני', kickoffIST: '22:00',
  })
  const stages = tournamentResults.knockoutStages
  vi.mocked(useLiveResults).mockReturnValueOnce({
    ...tournamentResults,
    knockoutStages: {
      ...stages,
      r32: stages.r32.map(m => (m.matchNum === 73 ? { ...m, scores: { home: 1, away: 0 } } : m)),
    },
    live: { '73': { clock: "67'" } },
  })
  render(<KnockoutMatchPage matchNum={73} />)
  const score = screen.getByTestId('real-score')
  expect(score.textContent).toContain('1')
  expect(score.textContent).toContain('0')
  const badge = screen.getByTestId('live-score-badge')
  expect(badge).toHaveTextContent('חי')
  expect(badge).toHaveTextContent("67'")
  expect(screen.queryByText('נגמר')).not.toBeInTheDocument()
})

// Step to the neighbouring knockout matches in kickoff order, not by number: the
// bracket numbers run by round, so 74 (Jun 29 23:30) sits between 76 (Jun 29 20:00)
// and 75 (Jun 30 04:00) on the clock.
test('links prev/next to the chronologically neighbouring knockout matches', () => {
  render(<KnockoutMatchPage matchNum={74} />)
  expect(screen.getByLabelText('המשחק הקודם')).toHaveAttribute('href', '/matches/76')
  expect(screen.getByLabelText('המשחק הבא')).toHaveAttribute('href', '/matches/75')
})

// The knockout opener (73) is the seam with the group stage: its "previous" steps
// back into the last group match played (J6), and its "next" stays in the bracket.
test('the knockout opener links back to the last group match', () => {
  render(<KnockoutMatchPage matchNum={73} />)
  expect(screen.getByLabelText('המשחק הקודם')).toHaveAttribute('href', '/matches/j6')
  expect(screen.getByLabelText('המשחק הבא')).toHaveAttribute('href', '/matches/76')
})

// The points table mirrors the group match page: each bettor's predicted score
// for the fixture and the points it earned them.
const koUser = (label: string, r32: KnockoutMatch[]): User => ({
  label, predictions: {}, topGoalscorer: '',
  groupMatches: {}, groupTables: {}, thirdPlaceQualification: { resolved: false, all: [], tied: [] },
  knockoutStages: { r32, r16: [], qf: [], sf: [], thirdPlace: [], final: [] },
})

test('shows a points table for the bettors on a resolved knockout match', () => {
  const resolved: KnockoutMatch = {
    matchNum: 73, home: 'South Korea', away: 'Canada', resolved: true,
    scores: { home: 1, away: 0 }, matchDate: '28 ביוני', kickoffIST: '22:00',
  }
  vi.mocked(findKnockoutMatch).mockReturnValueOnce(resolved)
  const users = [
    koUser('Alice', [{ matchNum: 73, home: 'South Korea', away: 'Canada', resolved: true, scores: { home: 1, away: 0 }, matchDate: '28 ביוני', kickoffIST: '22:00' }]),
    koUser('Bob', []),
  ]
  render(<KnockoutMatchPage matchNum={73} users={users} />)
  const lb = screen.getByTestId('match-leaderboard')
  const aliceRow = within(lb).getAllByTestId('match-lb-row').find(r => within(r).queryByText('Alice'))!
  // Exact R32 score → tzelifa, 7 points; away score shown first (0–1).
  expect(within(aliceRow).getByText('0–1')).toBeInTheDocument()
  expect(aliceRow.querySelector('.match-lb__pts')!.textContent).toBe('7')
})

// Parity with the group page: the knockout match also shows the win/draw/win
// "ניחושים · סך הכל" tally, counting participants by their (orientation-corrected)
// outcome so a reversed call still lands on the right side.
test('shows the predictions summary tally for the bettors on a resolved knockout match', () => {
  const resolved: KnockoutMatch = {
    matchNum: 73, home: 'South Korea', away: 'Canada', resolved: true,
    scores: { home: 1, away: 0 }, matchDate: '28 ביוני', kickoffIST: '22:00',
  }
  vi.mocked(findKnockoutMatch).mockReturnValueOnce(resolved)
  const users = [
    // South Korea win, stored straight
    koUser('Alice', [{ matchNum: 73, home: 'South Korea', away: 'Canada', resolved: true, scores: { home: 2, away: 1 }, matchDate: '28 ביוני', kickoffIST: '22:00' }]),
    // South Korea win, stored reversed (Canada 1 – S.Korea 2) → same side as Alice
    koUser('Bob', [{ matchNum: 73, home: 'Canada', away: 'South Korea', resolved: true, scores: { home: 1, away: 2 }, matchDate: '28 ביוני', kickoffIST: '22:00' }]),
    // didn't predict this fixture → not counted
    koUser('Carol', []),
  ]
  render(<KnockoutMatchPage matchNum={73} users={users} />)
  expect(screen.getByText('סך הכל')).toBeInTheDocument()
  // [away, draw, home] columns; both bettors are on the home (South Korea) side.
  const counts = screen.getAllByTestId('pred-count').map(el => Number(el.textContent))
  expect(counts).toEqual([0, 0, 2])
})

// The old per-bettor participants list is replaced by the same score-distribution
// summary the group pages show: bettors bucketed by their (orientation-corrected)
// scoreline, with the points recap once the match is decided.
test('shows the score-distribution summary for the bettors on a resolved knockout match', () => {
  const resolved: KnockoutMatch = {
    matchNum: 73, home: 'South Korea', away: 'Canada', resolved: true,
    scores: { home: 1, away: 0 }, matchDate: '28 ביוני', kickoffIST: '22:00',
  }
  vi.mocked(findKnockoutMatch).mockReturnValueOnce(resolved)
  const users = [
    // exact 1–0 (oriented), stored straight
    koUser('Alice', [{ matchNum: 73, home: 'South Korea', away: 'Canada', resolved: true, scores: { home: 1, away: 0 }, matchDate: '28 ביוני', kickoffIST: '22:00' }]),
    // same call, stored reversed (Canada 0 – S.Korea 1) → buckets with Alice
    koUser('Bob', [{ matchNum: 73, home: 'Canada', away: 'South Korea', resolved: true, scores: { home: 0, away: 1 }, matchDate: '28 ביוני', kickoffIST: '22:00' }]),
    // didn't predict this fixture → not a participant, not shown
    koUser('Carol', []),
  ]
  render(<KnockoutMatchPage matchNum={73} users={users} />)
  expect(screen.getByText('התפלגות תוצאות')).toBeInTheDocument()
  const table = screen.getByTestId('score-freq-table')
  // Both bettors land in one 0–1 (away–home) bucket; Carol is absent.
  expect(within(table).getByText('Alice')).toBeInTheDocument()
  expect(within(table).getByText('Bob')).toBeInTheDocument()
  expect(within(table).queryByText('Carol')).not.toBeInTheDocument()
  expect(within(table).getByText('0–1')).toBeInTheDocument()
  // Exact R32 hit for both → "2 צליפה" in the points recap.
  expect(screen.getByTestId('points-recap').textContent).toContain('2 צליפה')
})
