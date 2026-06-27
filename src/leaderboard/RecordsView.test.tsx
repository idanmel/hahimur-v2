import { render, screen, fireEvent, within } from '@testing-library/react'
import RecordsView from './RecordsView'
import type { GroupMatch, Standing, TournamentResults } from '../shared/types'
import type { User } from '../users'

const emptyKO = { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] }

const gm = (id: string, home: number, away: number): GroupMatch => ({
  id, homeTeam: '?', awayTeam: '?', scores: { home, away },
})
const st = (team: string): Standing => ({
  team, played: 1, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
})

function mkUser(label: string, groupScores: GroupMatch[], table: Standing[], topGoalscorer = 'X'): User {
  return {
    label, topGoalscorer,
    groupMatches: { A: groupScores },
    groupTables: { A: table },
    thirdPlaceQualification: { resolved: false, all: [], tied: [] },
    knockoutStages: { ...emptyKO },
  } as unknown as User
}

const results = {
  groupMatches: { A: [gm('A1', 2, 1)] },
  groupTables: { A: [st('T1'), st('T2')] },
  thirdPlaceQualification: { resolved: false, all: [], tied: [] },
  knockoutStages: { ...emptyKO },
  playerGoals: {},
} as TournamentResults

test('shows the empty state before any match is played', () => {
  const blank = { ...results, groupMatches: { A: [] }, groupTables: { A: [] } } as TournamentResults
  const user = mkUser('Alice', [], [])
  render(<RecordsView users={[user]} results={blank} />)
  expect(screen.getByText(/טרם נקבעו שיאים/)).toBeInTheDocument()
})

test('renders the record cards with the leader on top', () => {
  const alice = mkUser('Alice', [gm('A1', 2, 1)], [st('T1'), st('T2')])
  const bob = mkUser('Bob', [gm('A1', 1, 0)], [st('T2'), st('T1')])
  render(<RecordsView users={[alice, bob]} results={results} me="Alice" />)

  expect(screen.getByText('שיא צליפות')).toBeInTheDocument()
  expect(screen.getByText('שיא פגיעות')).toBeInTheDocument()
  expect(screen.getByText('שיא עולות')).toBeInTheDocument()
  expect(screen.getByText('שיא מיקומים')).toBeInTheDocument()
  // overall points leader appears in the hero banner
  expect(screen.getByText('מלך הניקוד')).toBeInTheDocument()
})

// A group of five played matches (A1..A5, all 1-0) lets us hand each bettor a
// precise צליפות count by how many they predict exactly right.
const FIVE = ['A1', 'A2', 'A3', 'A4', 'A5']
const fiveResults = {
  ...results,
  groupMatches: { A: FIVE.map(id => gm(id, 1, 0)) },
  groupTables: {},
} as TournamentResults

// k exact (1-0) predictions, the rest a clean miss (0-1) → exactly k צליפות.
const better = (label: string, k: number) =>
  mkUser(label, FIVE.map((id, i) => gm(id, i < k ? 1 : 0, i < k ? 0 : 1)), [])

const fiveUsers = [better('A5', 5), better('B4', 4), better('C3', 3), better('Me', 2), better('E1', 1)]

test('pins my own standing under the top three when I am outside it', () => {
  render(<RecordsView users={fiveUsers} results={fiveResults} me="Me" />)
  const card = screen.getByText('שיא צליפות').closest('.rec-card') as HTMLElement
  const scoped = within(card)

  // top three are shown...
  expect(scoped.getByText('A5')).toBeInTheDocument()
  expect(scoped.getByText('C3')).toBeInTheDocument()
  // ...my row is pinned even though I'm 4th, with the "אני" badge
  expect(scoped.getByText('Me')).toBeInTheDocument()
  expect(scoped.getByText('אני')).toBeInTheDocument()
  // ...but a bettor below me stays hidden until expanded
  expect(scoped.queryByText('E1')).not.toBeInTheDocument()
})

test('clicking a record card reveals the full ranked list', () => {
  render(<RecordsView users={fiveUsers} results={fiveResults} me="Me" />)
  const card = screen.getByText('שיא צליפות').closest('.rec-card') as HTMLElement
  const scoped = within(card)

  expect(scoped.queryByText('E1')).not.toBeInTheDocument()
  fireEvent.click(scoped.getByRole('button', { name: /כל המדורגים/ }))
  expect(scoped.getByText('E1')).toBeInTheDocument()
})
