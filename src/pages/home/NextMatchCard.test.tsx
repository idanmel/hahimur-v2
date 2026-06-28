import { render, screen } from '@testing-library/react'
import NextMatchCard from './NextMatchCard'
import { makeUser } from '../../leaderboard/testFixtures'
import type { GroupMatch, KnockoutMatch } from '../../shared/types'

const NOW = new Date('2026-06-11T20:00:00Z') // A1 finished (score in), A2 is next

// Fixture matches so tests don't depend on the live results file.
const MATCHES: GroupMatch[] = [
  { id: 'A1', homeTeam: 'Mexico', awayTeam: 'South Africa', matchDate: '11 ביוני', kickoffIST: '22:00', scores: { home: 2, away: 1 } },
  { id: 'A2', homeTeam: 'South Korea', awayTeam: 'Czech Republic', matchDate: '12 ביוני', kickoffIST: '05:00' },
]

const users = [
  makeUser({ predictions: { A2: { home: 2, away: 1 } } }),
  makeUser({ predictions: { A2: { home: 2, away: 1 } } }),
  makeUser({ predictions: { A2: { home: 0, away: 0 } } }),
]

test('shows the next match teams, kickoff and a link to its page', () => {
  render(<NextMatchCard users={users} now={NOW} matches={MATCHES} />)
  expect(screen.getByText('דרום קוריאה')).toBeInTheDocument()
  expect(screen.getByText('צ׳כיה')).toBeInTheDocument()
  expect(screen.getByText(/12 ביוני/)).toBeInTheDocument()
  expect(screen.getByText(/05:00/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /לעמוד המשחק/ })).toHaveAttribute('href', '/matches/A2')
})

test('home team comes first in DOM so it renders on the right in RTL', () => {
  render(<NextMatchCard users={users} now={NOW} matches={MATCHES} />)
  const names = [...document.querySelectorAll('.next-match__name')].map(e => e.textContent)
  expect(names).toEqual(['דרום קוריאה', 'צ׳כיה']) // A2: South Korea (home) vs Czech Republic (away)
})

test('marks a match in progress with a live indicator instead of the kickoff time', () => {
  // A2 kicks off 12 June 05:00 IST (02:00 UTC); an hour later it's in progress.
  const live = new Date('2026-06-12T03:00:00Z')
  render(<NextMatchCard users={users} now={live} matches={MATCHES} />)
  expect(screen.getByTestId('live-indicator')).toHaveTextContent('משחק חי')
})

test('shows the live badge when the live feed lists the match as in progress', () => {
  const live = new Date('2026-06-12T03:00:00Z')
  render(<NextMatchCard users={users} now={live} matches={MATCHES} liveMatches={{ A2: { clock: "30'" } }} />)
  expect(screen.getByTestId('live-indicator')).toHaveTextContent('משחק חי')
})

test('shows the live score and minute on the card while the match is in progress', () => {
  // A2 is South Korea (home) vs Czech Republic (away); live 1–0 at 30'.
  const live = new Date('2026-06-12T03:00:00Z')
  render(<NextMatchCard users={users} now={live} matches={MATCHES} liveMatches={{ A2: { clock: "30'", home: 1, away: 0 } }} />)
  expect(screen.getByTestId('live-match-result')).toHaveTextContent('0–1') // away–home, matching consensus order
  expect(screen.getByTestId('live-indicator')).toHaveTextContent("30'")
})

test('hides the live badge once the live feed no longer lists the match, even within the kickoff window', () => {
  // A2 is still inside the kickoff window, but the live feed (liveMatches)
  // has dropped it — the match has finished — so it must not show "live" anymore.
  const live = new Date('2026-06-12T03:00:00Z')
  render(<NextMatchCard users={users} now={live} matches={MATCHES} liveMatches={{}} />)
  expect(screen.queryByTestId('live-indicator')).not.toBeInTheDocument()
  expect(screen.getByText(/05:00/)).toBeInTheDocument() // falls back to showing kickoff time
})

test('shows the most common prediction', () => {
  render(<NextMatchCard users={users} now={NOW} matches={MATCHES} />)
  expect(screen.getByTestId('consensus')).toHaveTextContent('1–2')
  expect(screen.getByTestId('consensus')).toHaveTextContent('2 מתוך 3')
})

test('shows no personal prediction when no user is selected', () => {
  render(<NextMatchCard users={users} now={NOW} matches={MATCHES} />)
  expect(screen.queryByTestId('your-prediction')).not.toBeInTheDocument()
})

test('shows the selected user\'s own prediction for the match', () => {
  const me = makeUser({ label: 'עידן מלמד', predictions: { A2: { home: 3, away: 1 } } })
  render(<NextMatchCard users={users} now={NOW} matches={MATCHES} currentUser={me} />)
  expect(screen.getByTestId('your-prediction')).toHaveTextContent('1–3') // away–home, matching consensus order
})

test('shows no personal prediction when the selected user has none for that match', () => {
  const me = makeUser({ label: 'עידן מלמד', predictions: {} })
  render(<NextMatchCard users={users} now={NOW} matches={MATCHES} currentUser={me} />)
  expect(screen.queryByTestId('your-prediction')).not.toBeInTheDocument()
})

test('shows a card per match when two matches kick off simultaneously', () => {
  const round3: GroupMatch[] = [
    { id: 'A3', homeTeam: 'Czech Republic', awayTeam: 'South Africa', matchDate: '24 ביוני', kickoffIST: '22:00' },
    { id: 'A4', homeTeam: 'Mexico', awayTeam: 'South Korea', matchDate: '24 ביוני', kickoffIST: '22:00' },
  ]
  render(<NextMatchCard users={users} now={new Date('2026-06-24T12:00:00Z')} matches={round3} />)
  expect(screen.getAllByTestId('next-match')).toHaveLength(2)
  const links = screen.getAllByRole('link', { name: /לעמוד המשחק/ })
  expect(links.map(l => l.getAttribute('href'))).toEqual(['/matches/A3', '/matches/A4'])
})

test('renders nothing when nothing is upcoming', () => {
  const { container } = render(<NextMatchCard users={users} now={new Date('2026-07-20T00:00:00Z')} matches={MATCHES} koMatches={[]} />)
  expect(container).toBeEmptyDOMElement()
})

test('rolls into the knockouts: shows the R32 opener as a card like a group match', () => {
  // Groups done, no group match upcoming; the R32 opener (28 June 22:00 IST) is next.
  const koOpener: KnockoutMatch = {
    matchNum: 73, home: 'South Korea', away: 'Canada', resolved: true,
    matchDate: '28 ביוני', kickoffIST: '22:00',
  }
  // A bettor who predicted exactly this pairing plays the match — matched by team.
  const r32Pick = (home: number, away: number) => ({
    r32: [{ matchNum: 73, home: 'South Korea', away: 'Canada', resolved: true, scores: { home, away } }],
    r16: [], qf: [], sf: [], thirdPlace: [], final: [],
  })
  const koUsers = [
    makeUser({ knockoutStages: r32Pick(2, 1) }),
    makeUser({ knockoutStages: r32Pick(2, 1) }),
  ]
  const me = makeUser({ label: 'עידן מלמד', knockoutStages: r32Pick(3, 0) })
  const now = new Date('2026-06-28T18:00:00Z')
  render(<NextMatchCard users={koUsers} now={now} matches={[]} koMatches={[koOpener]} currentUser={me} />)

  expect(screen.getByText('דרום קוריאה')).toBeInTheDocument()
  expect(screen.getByText('קנדה')).toBeInTheDocument()
  expect(screen.getByText(/שלב ה-32/)).toBeInTheDocument() // round label, not "בית"
  expect(screen.getByRole('link', { name: /לעמוד המשחק/ })).toHaveAttribute('href', '/matches/73')
  expect(screen.getByTestId('consensus')).toHaveTextContent('1–2') // away–home, team-matched
  expect(screen.getByTestId('your-prediction')).toHaveTextContent('0–3') // my own pick
})
