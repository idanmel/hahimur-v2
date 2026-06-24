import { render, screen } from '@testing-library/react'
import KnockoutSurvivorsList from './KnockoutSurvivorsList'
import type { KnockoutMatch } from '../../shared/types'
import type { User } from '../../users/index'

const makeUser = (label: string, home: string, away: string): User =>
  ({
    label,
    knockoutStages: { r32: [{ matchNum: 73, home, away, resolved: true }], r16: [], qf: [], sf: [], thirdPlace: [], final: [] },
  } as unknown as User)

// Half-resolved: Canada (away) is known, runner-up A (home) is not.
const half: KnockoutMatch = { matchNum: 73, home: 'סגנית א', away: 'Canada', resolved: false }

const users = [
  makeUser('ניחש קנדה בית', 'Canada', 'South Korea'),
  makeUser('ניחש קנדה חוץ', 'Mexico', 'Canada'),
  makeUser('לא ניחש קנדה', 'Mexico', 'Switzerland'),
]

test('names the bettors who called the known team', () => {
  render(<KnockoutSurvivorsList actualMatch={half} users={users} />)
  expect(screen.getByText('ניחש קנדה בית')).toBeInTheDocument()
  expect(screen.getByText('ניחש קנדה חוץ')).toBeInTheDocument()
  expect(screen.queryByText('לא ניחש קנדה')).not.toBeInTheDocument()
  expect(screen.getAllByTestId('survivor')).toHaveLength(2)
})

test('shows the known team Hebrew name and how many of the pool called it', () => {
  render(<KnockoutSurvivorsList actualMatch={half} users={users} />)
  expect(screen.getByText('קנדה')).toBeInTheDocument()
  expect(screen.getByText('2 מתוך 3')).toBeInTheDocument()
})

test('renders the known team flag', () => {
  const { container } = render(<KnockoutSurvivorsList actualMatch={half} users={users} />)
  expect(container.querySelector('.fi-ca')).toBeInTheDocument()
})

test('renders nothing once both teams are resolved (the full list takes over)', () => {
  const resolved: KnockoutMatch = { matchNum: 73, home: 'South Korea', away: 'Canada', resolved: true }
  const { container } = render(<KnockoutSurvivorsList actualMatch={resolved} users={users} />)
  expect(container.firstChild).toBeNull()
})

test('renders nothing while both teams are still descriptors', () => {
  const unresolved: KnockoutMatch = { matchNum: 73, home: 'סגנית א', away: 'סגנית ב', resolved: false }
  const { container } = render(<KnockoutSurvivorsList actualMatch={unresolved} users={users} />)
  expect(container.firstChild).toBeNull()
})

test('still renders the header with an empty roster when nobody called the known team', () => {
  const nobody = [makeUser('אחר', 'Mexico', 'Switzerland')]
  render(<KnockoutSurvivorsList actualMatch={half} users={nobody} />)
  expect(screen.getByText('0 מתוך 1')).toBeInTheDocument()
  expect(screen.queryAllByTestId('survivor')).toHaveLength(0)
})
