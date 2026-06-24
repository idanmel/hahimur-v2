import { render, screen } from '@testing-library/react'
import MatchHeader from './MatchHeader'

const home = { iso: 'mx', he: 'מקסיקו' }
const away = { iso: 'za', he: 'דרום אפריקה' }
const match = { id: 'A1', matchDate: '2026-06-11', kickoffIST: '21:00' }
const noop = () => {}
const scoreProps = { homeScore: null, awayScore: null, onHomeScore: noop, onAwayScore: noop }

test('renders home team name', () => {
  render(<MatchHeader match={match} home={home} away={away} {...scoreProps} />)
  expect(screen.getAllByText('מקסיקו').length).toBeGreaterThan(0)
})

test('renders away team name', () => {
  render(<MatchHeader match={match} home={home} away={away} {...scoreProps} />)
  expect(screen.getAllByText('דרום אפריקה').length).toBeGreaterThan(0)
})

test('renders match date', () => {
  render(<MatchHeader match={match} home={home} away={away} {...scoreProps} />)
  expect(screen.getByText('2026-06-11')).toBeInTheDocument()
})

test('renders kickoff time', () => {
  render(<MatchHeader match={match} home={home} away={away} {...scoreProps} />)
  expect(screen.getByText('21:00')).toBeInTheDocument()
})

test('renders group badge with group letter and match number', () => {
  render(<MatchHeader match={match} home={home} away={away} {...scoreProps} />)
  const badge = document.querySelector('.match-header__group-badge')!
  expect(badge.textContent).toContain('1')
})

test('shows live indicator and what-if hint when live', () => {
  render(<MatchHeader match={match} home={home} away={away} {...scoreProps} live />)
  expect(screen.getByTestId('live-indicator')).toBeInTheDocument()
  expect(screen.getByText('המשחק בעיצומו')).toBeInTheDocument()
  expect(screen.getByText('הזינו את התוצאה הנוכחית וראו מי לוקח נקודות')).toBeInTheDocument()
})

test('hides kickoff time while live', () => {
  render(<MatchHeader match={match} home={home} away={away} {...scoreProps} live />)
  expect(screen.queryByText('21:00')).not.toBeInTheDocument()
})

test('shows no live indicator by default', () => {
  render(<MatchHeader match={match} home={home} away={away} {...scoreProps} />)
  expect(screen.queryByTestId('live-indicator')).not.toBeInTheDocument()
})

test('final score wins over live: no live indicator once a real score exists', () => {
  render(<MatchHeader match={match} home={home} away={away} {...scoreProps} live realScore={{ home: 2, away: 1 }} />)
  expect(screen.queryByTestId('live-indicator')).not.toBeInTheDocument()
  expect(screen.getByTestId('real-score')).toBeInTheDocument()
})

test('shows a live badge with the match minute while a score is in progress', () => {
  render(<MatchHeader match={match} home={home} away={away} {...scoreProps} realScore={{ home: 1, away: 0 }} liveScore={{ clock: "67'" }} />)
  const badge = screen.getByTestId('live-score-badge')
  expect(badge).toHaveTextContent('חי')
  expect(badge).toHaveTextContent("67'")
  expect(screen.queryByText('נגמר')).not.toBeInTheDocument()
})

test('falls back to just "חי" when no minute is available', () => {
  render(<MatchHeader match={match} home={home} away={away} {...scoreProps} realScore={{ home: 1, away: 0 }} liveScore={{ clock: null }} />)
  expect(screen.getByTestId('live-score-badge')).toHaveTextContent('חי')
})

test('shows "נגמר", not "חי", once the match is finished even within its time window', () => {
  // live (time window) is still true, but there is no live status → the match is over.
  render(<MatchHeader match={match} home={home} away={away} {...scoreProps} live realScore={{ home: 2, away: 1 }} />)
  expect(screen.getByText('נגמר')).toBeInTheDocument()
  expect(screen.queryByTestId('live-score-badge')).not.toBeInTheDocument()
})

test('renders prev/next chevrons linking to the adjacent matches', () => {
  render(<MatchHeader match={match} home={home} away={away} {...scoreProps} prevId="A2" nextId="B1" />)
  expect(screen.getByLabelText('המשחק הקודם')).toHaveAttribute('href', '/matches/a2')
  expect(screen.getByLabelText('המשחק הבא')).toHaveAttribute('href', '/matches/b1')
})

test('omits a chevron at the schedule edge', () => {
  render(<MatchHeader match={match} home={home} away={away} {...scoreProps} nextId="B1" />)
  expect(screen.queryByLabelText('המשחק הקודם')).not.toBeInTheDocument()
  expect(screen.getByLabelText('המשחק הבא')).toBeInTheDocument()
})

// A knockout slot that hasn't resolved yet is a bare descriptor with no team, so
// it carries no flag.
test('renders a team name without a flag when it has no iso', () => {
  render(<MatchHeader match={match} home={home} away={{ he: 'סגנית א' }} {...scoreProps} />)
  expect(screen.getByText('סגנית א')).toBeInTheDocument()
  expect(document.querySelectorAll('.match-team__flag')).toHaveLength(1)
})

// A custom badge (knockout round label) replaces the group link; with no href it
// renders as plain text, not a link.
test('renders a custom badge as plain text when it has no href', () => {
  render(<MatchHeader match={match} home={home} away={away} {...scoreProps} badge={{ label: 'שלב ה-32 · משחק 73' }} />)
  const badge = document.querySelector('.match-header__group-badge')!
  expect(badge.textContent).toBe('שלב ה-32 · משחק 73')
  expect(badge.tagName).toBe('SPAN')
})
