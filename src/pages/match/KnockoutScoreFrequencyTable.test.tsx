import { render, screen } from '@testing-library/react'
import KnockoutScoreFrequencyTable from './KnockoutScoreFrequencyTable'
import type { KnockoutMatch } from '../../shared/types'
import type { User } from '../../users/index'

// A user whose only knockout entry is their predicted match 73.
function makeUser(label: string, match: KnockoutMatch): User {
  return {
    label,
    knockoutStages: { r32: [match], r16: [], qf: [], sf: [], thirdPlace: [], final: [] },
  } as unknown as User
}

const ko = (home: string, away: string, h: number, a: number, drawWinner?: 'home' | 'away'): KnockoutMatch =>
  ({ matchNum: 73, home, away, resolved: true, scores: { home: h, away: a, drawWinner } })

// The real fixture: South Korea (home) vs Canada (away).
const actual: KnockoutMatch = { matchNum: 73, home: 'South Korea', away: 'Canada', resolved: true }

test('only bettors who predicted both real teams are counted', () => {
  const users = [
    makeUser('משתתף', ko('South Korea', 'Canada', 1, 0)),
    makeUser('לא משתתף', ko('Mexico', 'Canada', 2, 0)),
  ]
  render(<KnockoutScoreFrequencyTable actualMatch={actual} users={users} />)

  expect(screen.getByText('משתתף')).toBeInTheDocument()
  expect(screen.queryByText('לא משתתף')).not.toBeInTheDocument()
})

test('a reversed-order prediction is oriented to the real home/away and grouped together', () => {
  const users = [
    // both predicted South Korea to win 1-0, but stored in opposite orders
    makeUser('א', ko('South Korea', 'Canada', 1, 0)),
    makeUser('ב', ko('Canada', 'South Korea', 0, 1)),
  ]
  render(<KnockoutScoreFrequencyTable actualMatch={actual} users={users} />)

  const rows = screen.getAllByTestId('score-freq-row')
  expect(rows).toHaveLength(1)
  expect(rows[0]).toHaveTextContent('א')
  expect(rows[0]).toHaveTextContent('ב')
  // displayed away–home, South Korea home 1 / Canada away 0
  expect(rows[0].querySelector('.score-freq__score')?.textContent).toBe('0–1')
})

test('on a drawn KO result, the penalty winner decides exact vs miss', () => {
  // Actual: 1-1, South Korea win on penalties.
  const drawn: KnockoutMatch = { matchNum: 73, home: 'South Korea', away: 'Canada', resolved: true, scores: { home: 1, away: 1, drawWinner: 'home' } }
  const users = [
    makeUser('בול', ko('South Korea', 'Canada', 1, 1, 'home')),   // 1-1, SK on pens → צליפה
    makeUser('פספוס פנדלים', ko('South Korea', 'Canada', 1, 1, 'away')), // 1-1, wrong pen winner → פספוס
    makeUser('ניחש נצחון', ko('South Korea', 'Canada', 2, 1)),     // home win, not a draw → פספוס
  ]
  render(<KnockoutScoreFrequencyTable actualMatch={drawn} users={users} />)

  const recap = screen.getByTestId('points-recap')
  expect(recap).toHaveTextContent('1 צליפה')
  expect(recap).toHaveTextContent('0 פגיעה')
  expect(recap).toHaveTextContent('2 פספוס')

  // the two 1-1 calls split into separate rows by who they had winning on pens
  const drawRows = screen.getAllByTestId('score-freq-row').filter(r => r.textContent?.includes('פנדלים'))
  expect(drawRows).toHaveLength(2)
  expect(drawRows.some(r => r.textContent?.includes('פנדלים לדרום קוריאה'))).toBe(true)
})

test('renders nothing until the real match has resolved its two teams', () => {
  const unresolved: KnockoutMatch = { matchNum: 73, home: 'סגנית א', away: 'סגנית ב', resolved: false }
  const users = [makeUser('א', ko('South Korea', 'Canada', 1, 0))]
  const { container } = render(<KnockoutScoreFrequencyTable actualMatch={unresolved} users={users} />)

  expect(container.firstChild).toBeNull()
})
