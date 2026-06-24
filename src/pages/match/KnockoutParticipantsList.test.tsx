import { render, screen, within } from '@testing-library/react'
import KnockoutParticipantsList from './KnockoutParticipantsList'
import type { KnockoutMatch } from '../../shared/types'
import type { User } from '../../users/index'

// A user whose only knockout entry is their predicted match 73.
function makeUser(label: string, match: KnockoutMatch): User {
  return {
    label,
    knockoutStages: { r32: [match], r16: [], qf: [], sf: [], thirdPlace: [], final: [] },
  } as unknown as User
}

const ko = (home: string, away: string, h = 1, a = 0, drawWinner?: 'home' | 'away'): KnockoutMatch =>
  ({ matchNum: 73, home, away, resolved: true, scores: { home: h, away: a, drawWinner } })

// The real fixture: South Korea (home) vs Canada (away).
const actual: KnockoutMatch = { matchNum: 73, home: 'South Korea', away: 'Canada', resolved: true }

test('lists only bettors who predicted both real teams, regardless of order', () => {
  const users = [
    makeUser('משתתף', ko('South Korea', 'Canada')),
    makeUser('הפוך', ko('Canada', 'South Korea')),
    makeUser('לא משתתף', ko('Mexico', 'Canada')),
  ]
  render(<KnockoutParticipantsList actualMatch={actual} users={users} />)

  expect(screen.getByText('משתתף')).toBeInTheDocument()
  expect(screen.getByText('הפוך')).toBeInTheDocument()
  expect(screen.queryByText('לא משתתף')).not.toBeInTheDocument()
  expect(screen.getAllByTestId('participant')).toHaveLength(2)
})

test('shows each bettor predicted score oriented to the real home/away', () => {
  const users = [
    makeUser('ישר', ko('South Korea', 'Canada', 2, 0)),
    // stored reversed: Canada 0 - South Korea 2; oriented should read 2–0
    makeUser('הפוך', ko('Canada', 'South Korea', 0, 2)),
  ]
  render(<KnockoutParticipantsList actualMatch={actual} users={users} />)

  const rows = screen.getAllByTestId('participant')
  expect(rows).toHaveLength(2)
  rows.forEach(r => {
    expect(within(r).getByText('דרום קוריאה')).toBeInTheDocument()
    // away–home orientation, matching the match header (Canada 0 – S. Korea 2)
    expect(within(r).getByText('0–2')).toBeInTheDocument()
    expect(within(r).getByText('קנדה')).toBeInTheDocument()
  })
})

test('shows each team flag in the score chip', () => {
  const users = [makeUser('א', ko('South Korea', 'Canada', 1, 0))]
  const { container } = render(<KnockoutParticipantsList actualMatch={actual} users={users} />)

  expect(container.querySelector('.fi-kr')).toBeInTheDocument()
  expect(container.querySelector('.fi-ca')).toBeInTheDocument()
})

test('a drawn KO prediction shows the advancing team, oriented correctly', () => {
  const users = [
    // stored reversed as a 1-1 with Canada advancing (drawWinner home=Canada);
    // oriented to the real fixture the advancing team is still Canada (away)
    makeUser('עולה', ko('Canada', 'South Korea', 1, 1, 'home')),
  ]
  render(<KnockoutParticipantsList actualMatch={actual} users={users} />)

  const row = screen.getByTestId('participant')
  expect(within(row).getByText('דרום קוריאה')).toBeInTheDocument()
  expect(within(row).getByText('1–1')).toBeInTheDocument()
  expect(within(row).getByText('קנדה')).toBeInTheDocument()
  expect(within(row).getByText('קנדה עולה')).toBeInTheDocument()
})

test('renders nothing until the real match has resolved its two teams', () => {
  const unresolved: KnockoutMatch = { matchNum: 73, home: 'סגנית א', away: 'סגנית ב', resolved: false }
  const users = [makeUser('א', ko('South Korea', 'Canada'))]
  const { container } = render(<KnockoutParticipantsList actualMatch={unresolved} users={users} />)

  expect(container.firstChild).toBeNull()
})

test('shows an empty-state message when no bettor is participating', () => {
  const users = [makeUser('לא משתתף', ko('Mexico', 'Canada'))]
  render(<KnockoutParticipantsList actualMatch={actual} users={users} />)

  expect(screen.getByText('אין משתתפים שניחשו את המשחק הזה')).toBeInTheDocument()
  expect(screen.queryAllByTestId('participant')).toHaveLength(0)
})
