import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import MatchPredictionsPage from './MatchPredictionsPage'
import { findMatch } from './matchUtils'
import { TEAMS } from '../../shared/groups'
import type { User } from '../../users/index'
import type { PredictionsState } from '../../shared/types'

// A1 is played (2–1), A2 has no result yet
vi.mock('../../tournament-results', () => ({
  tournamentResults: {
    groupMatches: {
      A: [
        { id: 'A1', homeTeam: 'Mexico', awayTeam: 'South Africa', scores: { home: 2, away: 1 } },
        { id: 'A2', homeTeam: 'Korea Republic', awayTeam: 'Honduras', scores: { home: null, away: null } },
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

function renderPage(matchId: string, users: User[]) {
  const match = findMatch(matchId)
  const home = match ? TEAMS[match.homeTeam] : null
  const away = match ? TEAMS[match.awayTeam] : null
  return render(<MatchPredictionsPage match={match ?? null} home={home} away={away} users={users} />)
}

test('played match shows the real score as fixed text with a final badge, no inputs', () => {
  renderPage('A1', [])
  expect(screen.getByText('נגמר')).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  const scoreArea = screen.getByTestId('real-score')
  expect(scoreArea).toHaveTextContent('1–2')
})

test('played match scores each scoreline row against the real result', () => {
  renderPage('A1', [
    u('מדויק', { A1: { home: 2, away: 1 } }),
    u('כיוון', { A1: { home: 1, away: 0 } }),
    u('פספוס', { A1: { home: 0, away: 3 } }),
  ])
  const pts = (name: string) => screen.getByText(name).closest('[data-testid="score-freq-row"]')!.querySelector('.score-freq__pts')!.textContent
  expect(pts('מדויק')).toBe('4')
  expect(pts('כיוון')).toBe('2')
  expect(pts('פספוס')).toBe('0')
})

test('unplayed match keeps the editable what-if inputs and shows no badge', () => {
  renderPage('A2', [])
  expect(screen.getAllByRole('textbox')).toHaveLength(2)
  expect(screen.queryByText('נגמר')).not.toBeInTheDocument()
})

test('frequency table highlights the exact scoreline and tints correct outcomes', () => {
  renderPage('A1', [
    u('בול', { A1: { home: 2, away: 1 } }),
    u('כיוון', { A1: { home: 1, away: 0 } }),
    u('פספוס', { A1: { home: 0, away: 3 } }),
  ])
  const rows = screen.getAllByTestId('score-freq-row')
  const rowFor = (label: string) => rows.find(r => r.querySelector('.score-freq__score')?.textContent === label)!
  expect(rowFor('1–2')).toHaveClass('score-freq__row--exact')
  expect(rowFor('0–1')).toHaveClass('score-freq__row--outcome')
  expect(rowFor('3–0')).not.toHaveClass('score-freq__row--exact')
  expect(rowFor('3–0')).not.toHaveClass('score-freq__row--outcome')
  rows.forEach(r => expect(r).not.toHaveClass('score-freq__row--leader'))
})

test('summary bar marks the actual outcome column and dims the others', () => {
  const { container } = renderPage('A1', [u('א', { A1: { home: 2, away: 1 } })])
  expect(container.querySelector('.pred-summary__col--home')).toHaveClass('pred-summary__col--actual')
  expect(container.querySelector('.pred-summary__col--draw')).toHaveClass('pred-summary__col--off')
  expect(container.querySelector('.pred-summary__col--away')).toHaveClass('pred-summary__col--off')
})

test('summary bar has no actual/off marks while unplayed', () => {
  const { container } = renderPage('A2', [u('א', { A2: { home: 1, away: 1 } })])
  expect(container.querySelector('.pred-summary__col--actual')).toBeNull()
  expect(container.querySelector('.pred-summary__col--off')).toBeNull()
})

test('shows a points recap line with exact/outcome/miss counts', () => {
  renderPage('A1', [
    u('בול', { A1: { home: 2, away: 1 } }),
    u('כיוון א', { A1: { home: 1, away: 0 } }),
    u('כיוון ב', { A1: { home: 3, away: 2 } }),
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
  renderPage('A2', [])
  expect(screen.getByText('שעון ישראל')).toBeInTheDocument()
  expect(screen.queryByTestId('match-scorers')).not.toBeInTheDocument()
  expect(screen.queryByTestId('points-recap')).not.toBeInTheDocument()
})
