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
