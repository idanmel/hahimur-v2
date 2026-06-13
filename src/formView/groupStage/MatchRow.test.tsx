import { render, screen } from '@testing-library/react'
import MatchRow from './MatchRow'

const match = { id: 'A1', homeTeam: 'Mexico', awayTeam: 'South Africa' }

// --- Slice 3: read-only mode ---

test('readOnly: shows home score as text', () => {
  render(<MatchRow match={match} scores={{ home: 2, away: 1 }} onChange={() => {}} readOnly />)
  expect(screen.getByTestId('score-home')).toHaveTextContent('2')
})

test('readOnly: shows away score as text', () => {
  render(<MatchRow match={match} scores={{ home: 2, away: 1 }} onChange={() => {}} readOnly />)
  expect(screen.getByTestId('score-away')).toHaveTextContent('1')
})

test('readOnly: shows dash when score is null', () => {
  render(<MatchRow match={match} scores={{ home: null, away: null }} onChange={() => {}} readOnly />)
  expect(screen.getAllByText('–')).toHaveLength(2)
})

test('readOnly: no input elements rendered', () => {
  render(<MatchRow match={match} scores={{ home: 2, away: 1 }} onChange={() => {}} readOnly />)
  expect(document.querySelector('input')).toBeNull()
})

test('readOnly with href: card is a link', () => {
  render(<MatchRow match={match} scores={{ home: 2, away: 1 }} onChange={() => {}} readOnly href="/matches/a1" />)
  const link = document.querySelector('a.match-card')
  expect(link).not.toBeNull()
  expect(link).toHaveAttribute('href', '/matches/a1')
})

test('readOnly without href: card is not a link', () => {
  render(<MatchRow match={match} scores={{ home: 2, away: 1 }} onChange={() => {}} readOnly />)
  expect(document.querySelector('a.match-card')).toBeNull()
})

test('editable: card is not a link', () => {
  render(<MatchRow match={match} scores={{ home: 2, away: 1 }} onChange={() => {}} />)
  expect(document.querySelector('a.match-card')).toBeNull()
})

// --- Slice: outcome badge ---

test('readOnly with outcome=tzelifa: renders badge with צליפה and +4', () => {
  render(<MatchRow match={match} scores={{ home: 2, away: 1 }} onChange={() => {}} readOnly outcome="tzelifa" points={4} />)
  const badge = screen.getByTestId('match-outcome')
  expect(badge).toHaveTextContent('צליפה')
  expect(badge).toHaveTextContent('+4')
})

test('readOnly with outcome=pgiya: renders badge with פגיעה and +2', () => {
  render(<MatchRow match={match} scores={{ home: 2, away: 1 }} onChange={() => {}} readOnly outcome="pgiya" points={2} />)
  const badge = screen.getByTestId('match-outcome')
  expect(badge).toHaveTextContent('פגיעה')
  expect(badge).toHaveTextContent('+2')
})

test('readOnly with outcome=miss: renders badge with פספוס and 0', () => {
  render(<MatchRow match={match} scores={{ home: 2, away: 1 }} onChange={() => {}} readOnly outcome="miss" points={0} />)
  const badge = screen.getByTestId('match-outcome')
  expect(badge).toHaveTextContent('פספוס')
  expect(badge).toHaveTextContent('0')
})

test('readOnly without outcome: no badge is rendered', () => {
  render(<MatchRow match={match} scores={{ home: 2, away: 1 }} onChange={() => {}} readOnly />)
  expect(screen.queryByTestId('match-outcome')).toBeNull()
})
