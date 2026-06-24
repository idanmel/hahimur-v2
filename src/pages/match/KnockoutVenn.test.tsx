import { render, screen, within } from '@testing-library/react'
import KnockoutVenn from './KnockoutVenn'
import type { KnockoutMatch, KnockoutStages } from '../../shared/types'
import type { User } from '../../users/index'

const emptyStages = (): KnockoutStages =>
  ({ r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] })

// A user whose given knockout stage is exactly the given fixtures.
function makeUser(label: string, stage: keyof KnockoutStages, fixtures: KnockoutMatch[]): User {
  return { label, knockoutStages: { ...emptyStages(), [stage]: fixtures } } as unknown as User
}

const ko = (matchNum: number, home: string, away: string): KnockoutMatch =>
  ({ matchNum, home, away, resolved: true, scores: { home: 1, away: 0 } })

const both = makeUser('AB', 'r16', [ko(90, 'South Korea', 'Morocco'), ko(95, 'Canada', 'Egypt')])
const aOnly = makeUser('A', 'r16', [ko(90, 'South Korea', 'Morocco')])
const bOnly = makeUser('B', 'r16', [ko(90, 'Canada', 'Morocco')])

test('lists each bettor under the matching region', () => {
  render(<KnockoutVenn teamA="South Korea" teamB="Canada" stage="r16" users={[both, aOnly, bOnly]} />)

  expect(within(screen.getByTestId('venn-region-a')).getByText('A')).toBeInTheDocument()
  expect(within(screen.getByTestId('venn-region-b')).getByText('B')).toBeInTheDocument()
  expect(within(screen.getByTestId('venn-region-both')).getByText('AB')).toBeInTheDocument()
})

test('a team counts whether it sits home or away in the bettor\'s stage, regardless of path', () => {
  const homeSide = makeUser('home', 'r16', [ko(90, 'South Korea', 'Morocco')])
  const awaySide = makeUser('away', 'r16', [ko(95, 'Argentina', 'South Korea')])
  render(<KnockoutVenn teamA="South Korea" teamB="Canada" stage="r16" users={[homeSide, awaySide]} />)

  const a = screen.getByTestId('venn-region-a')
  expect(within(a).getByText('home')).toBeInTheDocument()
  expect(within(a).getByText('away')).toBeInTheDocument()
})

test('the diagram tallies each region and the legend carries the team totals', () => {
  render(<KnockoutVenn teamA="South Korea" teamB="Canada" stage="r16" users={[both, aOnly, bOnly]} />)

  expect(screen.getByText('דרום קוריאה')).toBeInTheDocument()
  expect(screen.getByText('קנדה')).toBeInTheDocument()
  expect(screen.getByTestId('venn-count-a')).toHaveTextContent('1')
  expect(screen.getByTestId('venn-count-both')).toHaveTextContent('1')
  expect(screen.getByTestId('venn-count-b')).toHaveTextContent('1')
})

test('reads the stage it is told to — e.g. who reached the quarter-finals', () => {
  // The same bettor lobes, but their picks live in the QF stage, not the R16.
  const inQf = makeUser('qfFan', 'qf', [ko(97, 'Brazil', 'Argentina')])
  const inR16Only = makeUser('r16Fan', 'r16', [ko(90, 'Brazil', 'Spain')])
  render(<KnockoutVenn teamA="Brazil" teamB="France" stage="qf" users={[inQf, inR16Only]} />)

  // Only the bettor who put Brazil in the QF counts; the R16-only pick is ignored.
  expect(within(screen.getByTestId('venn-region-a')).getByText('qfFan')).toBeInTheDocument()
  expect(screen.queryByText('r16Fan')).not.toBeInTheDocument()
})

test('a crowded lobe still names everyone in its list below', () => {
  const crowd = Array.from({ length: 25 }, (_, i) =>
    makeUser(`fan${i}`, 'r16', [ko(90, 'South Korea', 'Morocco')]))
  render(<KnockoutVenn teamA="South Korea" teamB="Canada" stage="r16" users={crowd} />)

  const a = screen.getByTestId('venn-region-a')
  expect(within(a).getAllByTestId('venn-name')).toHaveLength(25)
  expect(screen.getByTestId('venn-count-a')).toHaveTextContent('25')
})

test('omits a region list entirely when nobody falls in it', () => {
  render(<KnockoutVenn teamA="South Korea" teamB="Canada" stage="r16" users={[aOnly]} />)

  expect(screen.queryByTestId('venn-region-b')).not.toBeInTheDocument()
  expect(screen.queryByTestId('venn-region-both')).not.toBeInTheDocument()
})
