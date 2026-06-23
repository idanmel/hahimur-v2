import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import MatchPredictionsPage from './MatchPredictionsPage'
import { findMatch } from './matchUtils'
import { TEAMS } from '../../shared/groups'
import type { User } from '../../users/index'
import type { PredictionsState } from '../../shared/types'

// Skip the 27 prediction files that load transitively via useCurrentUser.
vi.mock('../../users/index', () => ({ get USERS() { return [] }, get USERS_SORTED() { return [] } }))

// A1 is played (2–0), A2 is played (2–1), A3 is unplayed
vi.mock('../../tournament-results', () => ({
  tournamentResults: {
    groupMatches: {
      A: [
        { id: 'A1', homeTeam: 'Mexico', awayTeam: 'South Africa', scores: { home: 2, away: 0 } },
        { id: 'A2', homeTeam: 'Korea Republic', awayTeam: 'Honduras', scores: { home: 2, away: 1 } },
        { id: 'A3', homeTeam: 'Panama', awayTeam: 'Jamaica', scores: { home: null, away: null } },
      ],
    },
    groupTables: {},
    playerGoals: { 'קיליאן אמבפה': 2 },
    playerMatchGoals: { 'קיליאן אמבפה': { A1: 2 } },
    thirdPlaceQualification: { resolved: false, all: [], tied: [] },
    knockoutStages: { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] },
  },
}))

function u(label: string, predictions: PredictionsState, topGoalscorer = ''): User {
  return { label, predictions, topGoalscorer, groupMatches: {}, groupTables: {}, thirdPlaceQualification: { resolved: true, all: [], qualifiers: [] }, knockoutStages: { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] } }
}

// Fixed clock before any kickoff, so isLive never flips tests during real match windows
const NOW = new Date('2026-06-01T12:00:00')

function renderPage(matchId: string, users: User[]) {
  const match = findMatch(matchId)
  const home = match ? TEAMS[match.homeTeam] : null
  const away = match ? TEAMS[match.awayTeam] : null
  return render(<MatchPredictionsPage match={match ?? null} home={home} away={away} users={users} now={NOW} />)
}

test('played match shows the real score as fixed text with a final badge, no inputs', () => {
  renderPage('A1', [])
  expect(screen.getByText('נגמר')).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  const scoreArea = screen.getByTestId('real-score')
  expect(scoreArea).toHaveTextContent('0–2')
})

// Per-row points are covered by scoreFrequency.test.ts; the outcome→DOM wiring
// is proven by the highlight/recap tests below.
test('unplayed match keeps the editable what-if inputs and shows no badge', () => {
  renderPage('A3', [])
  expect(screen.getAllByRole('textbox')).toHaveLength(2)
  expect(screen.queryByText('נגמר')).not.toBeInTheDocument()
})

test('frequency table highlights the exact scoreline and tints correct outcomes', () => {
  renderPage('A1', [
    u('בול', { A1: { home: 2, away: 0 } }),
    u('כיוון', { A1: { home: 1, away: 0 } }),
    u('פספוס', { A1: { home: 0, away: 3 } }),
  ])
  const rows = screen.getAllByTestId('score-freq-row')
  const rowFor = (label: string) => rows.find(r => r.querySelector('.score-freq__score')?.textContent === label)!
  expect(rowFor('0–2')).toHaveClass('score-freq__row--exact')
  expect(rowFor('0–1')).toHaveClass('score-freq__row--outcome')
  expect(rowFor('3–0')).not.toHaveClass('score-freq__row--exact')
  expect(rowFor('3–0')).not.toHaveClass('score-freq__row--outcome')
  rows.forEach(r => expect(r).not.toHaveClass('score-freq__row--leader'))
})

test('summary bar marks the actual outcome column and dims the others', () => {
  const { container } = renderPage('A1', [u('א', { A1: { home: 2, away: 0 } })])
  expect(container.querySelector('.pred-summary__col--home')).toHaveClass('pred-summary__col--actual')
  expect(container.querySelector('.pred-summary__col--draw')).toHaveClass('pred-summary__col--off')
  expect(container.querySelector('.pred-summary__col--away')).toHaveClass('pred-summary__col--off')
})

test('summary bar has no actual/off marks while unplayed', () => {
  const { container } = renderPage('A3', [u('א', { A3: { home: 1, away: 1 } })])
  expect(container.querySelector('.pred-summary__col--actual')).toBeNull()
  expect(container.querySelector('.pred-summary__col--off')).toBeNull()
})

test('shows a points recap line with exact/outcome/miss counts', () => {
  renderPage('A1', [
    u('בול', { A1: { home: 2, away: 0 } }),
    u('כיוון א', { A1: { home: 1, away: 0 } }),
    u('כיוון ב', { A1: { home: 3, away: 0 } }),
    u('פספוס', { A1: { home: 0, away: 3 } }),
    u('ריק', { A1: { home: null, away: null } }),
  ])
  const recap = screen.getByTestId('points-recap')
  expect(recap).toHaveTextContent('1 צליפה')
  expect(recap).toHaveTextContent('2 פגיעה')
  expect(recap).toHaveTextContent('1 פספוס')
})

test('shows real goals scored by picked players in this match', () => {
  renderPage('A1', [])
  const scorers = screen.getByTestId('match-scorers')
  expect(scorers).toHaveTextContent('קיליאן אמבפה')
  expect(scorers).toHaveTextContent('×2')
})

test('played match meta shows the date but drops kickoff time', () => {
  renderPage('A1', [])
  expect(screen.queryByText('שעון ישראל')).not.toBeInTheDocument()
})

test('unplayed match meta still shows kickoff time', () => {
  renderPage('A3', [])
  expect(screen.getByText('שעון ישראל')).toBeInTheDocument()
  expect(screen.queryByTestId('match-scorers')).not.toBeInTheDocument()
  expect(screen.queryByTestId('points-recap')).not.toBeInTheDocument()
})
