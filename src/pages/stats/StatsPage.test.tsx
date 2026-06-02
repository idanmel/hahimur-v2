import { render, screen } from '@testing-library/react'
import StatsPage from './StatsPage'
import type { User } from '../../users/index'
import type { ThirdPlaceQualification, KnockoutStages, GroupMatch } from '../../shared/types'

const emptyKO: KnockoutStages = { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] }
const emptyTP: ThirdPlaceQualification = { resolved: false, all: [], tied: [] }

function makeUser(label: string, predictedChampion: string, predictedFinalTeams?: string[]): User {
  return {
    label,
    predictions: {},
    topGoalscorer: '',
    groupTables: {},
    thirdPlaceQualification: emptyTP,
    groupMatches: {} as Record<string, GroupMatch[]>,
    knockoutStages: emptyKO,
    predictedChampion,
    predictedFinalTeams,
  }
}

const USERS: User[] = [
  makeUser('עידן', 'France', ['France', 'Brazil']),
  makeUser('ינייב', 'France', ['France', 'Argentina']),
  makeUser('תומר', 'France', ['France', 'Argentina']),
  makeUser('אורן', 'Brazil', ['France', 'Brazil']),
  makeUser('אלדד', 'Brazil', ['France', 'Brazil']),
  makeUser('טל', 'Portugal', ['Spain', 'Portugal']),
  makeUser('אלרד', 'Portugal', ['France', 'Portugal']),
  makeUser('רועי', 'Spain', ['Spain', 'Portugal']),
]

test('each team appears exactly once', () => {
  render(<StatsPage users={USERS} />)
  expect(screen.getAllByText('צרפת')).toHaveLength(1)
  expect(screen.getAllByText('ברזיל')).toHaveLength(1)
  expect(screen.getAllByText('ארגנטינה')).toHaveLength(1)
})

test('France row shows champion count 3', () => {
  render(<StatsPage users={USERS} />)
  const row = screen.getByText('צרפת').closest('li')!
  expect(row.querySelector('[data-col="champion"]')).toHaveTextContent('3')
})

test('France row shows runner-up count 3', () => {
  render(<StatsPage users={USERS} />)
  const row = screen.getByText('צרפת').closest('li')!
  expect(row.querySelector('[data-col="runner-up"]')).toHaveTextContent('3')
})

test('Argentina appears with champion count 0 and runner-up count 2', () => {
  render(<StatsPage users={USERS} />)
  const row = screen.getByText('ארגנטינה').closest('li')!
  expect(row.querySelector('[data-col="champion"]')).toHaveTextContent('0')
  expect(row.querySelector('[data-col="runner-up"]')).toHaveTextContent('2')
})

test('France row appears before Argentina row (sorted by champion count)', () => {
  render(<StatsPage users={USERS} />)
  const rows = screen.getAllByRole('listitem')
  const franceIdx = rows.findIndex(r => r.textContent?.includes('צרפת'))
  const argIdx = rows.findIndex(r => r.textContent?.includes('ארגנטינה'))
  expect(franceIdx).toBeLessThan(argIdx)
})

test('France row shows champion pickers', () => {
  render(<StatsPage users={USERS} />)
  const row = screen.getByText('צרפת').closest('li')!
  expect(row).toHaveTextContent('עידן')
  expect(row).toHaveTextContent('ינייב')
  expect(row).toHaveTextContent('תומר')
})
