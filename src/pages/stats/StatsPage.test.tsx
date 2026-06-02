import { render, within } from '@testing-library/react'
import StatsPage from './StatsPage'
import type { User } from '../../users/index'
import type { ThirdPlaceQualification, KnockoutStages, GroupMatch } from '../../shared/types'

const emptyKO: KnockoutStages = { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] }
const emptyTP: ThirdPlaceQualification = { resolved: false, all: [], tied: [] }

function makeUser(
  label: string,
  predictedChampion: string,
  predictedFinalTeams?: string[],
  predictedSFTeams?: string[],
  predictedQFTeams?: string[],
  predictedR16Teams?: string[],
): User {
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
    predictedSFTeams,
    predictedQFTeams,
    predictedR16Teams,
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

function getFinalsSection() {
  return document.querySelector('[data-section="finals"]')!
}

test('each team appears exactly once in finals section', () => {
  render(<StatsPage users={USERS} />)
  const finals = getFinalsSection()
  expect(within(finals as HTMLElement).getAllByText('צרפת')).toHaveLength(1)
  expect(within(finals as HTMLElement).getAllByText('ברזיל')).toHaveLength(1)
  expect(within(finals as HTMLElement).getAllByText('ארגנטינה')).toHaveLength(1)
})

test('France row shows champion count 3', () => {
  render(<StatsPage users={USERS} />)
  const finals = getFinalsSection()
  const row = within(finals as HTMLElement).getByText('צרפת').closest('li')!
  expect(row.querySelector('[data-col="champion"]')).toHaveTextContent('3')
})

test('France row shows runner-up count 3', () => {
  render(<StatsPage users={USERS} />)
  const finals = getFinalsSection()
  const row = within(finals as HTMLElement).getByText('צרפת').closest('li')!
  expect(row.querySelector('[data-col="runner-up"]')).toHaveTextContent('3')
})

test('Argentina appears with champion count 0 and runner-up count 2', () => {
  render(<StatsPage users={USERS} />)
  const finals = getFinalsSection()
  const row = within(finals as HTMLElement).getByText('ארגנטינה').closest('li')!
  expect(row.querySelector('[data-col="champion"]')).toHaveTextContent('0')
  expect(row.querySelector('[data-col="runner-up"]')).toHaveTextContent('2')
})

test('France row appears before Argentina row (sorted by champion count)', () => {
  render(<StatsPage users={USERS} />)
  const rows = Array.from(getFinalsSection().querySelectorAll('li'))
  const franceIdx = rows.findIndex(r => r.textContent?.includes('צרפת'))
  const argIdx = rows.findIndex(r => r.textContent?.includes('ארגנטינה'))
  expect(franceIdx).toBeLessThan(argIdx)
})

test('France row shows total finals count of 6 out of 8', () => {
  render(<StatsPage users={USERS} />)
  const finals = getFinalsSection()
  const row = within(finals as HTMLElement).getByText('צרפת').closest('li')!
  expect(row.querySelector('[data-col="total"]')).toHaveTextContent('6 מתוך 8 העלו אותה לגמר')
})

test('France row shows champion pickers', () => {
  render(<StatsPage users={USERS} />)
  const finals = getFinalsSection()
  const row = within(finals as HTMLElement).getByText('צרפת').closest('li')!
  expect(row).toHaveTextContent('עידן')
  expect(row).toHaveTextContent('ינייב')
  expect(row).toHaveTextContent('תומר')
})

// ── Matchups section ────────────────────────────────────────────

test('matchups section shows France vs Brazil with count 3', () => {
  render(<StatsPage users={USERS} />)
  const list = document.querySelector('[data-section="matchups"]')!
  const row = Array.from(list.querySelectorAll('li')).find(
    li => li.textContent?.includes('צרפת') && li.textContent?.includes('ברזיל')
  )!
  expect(row.querySelector('[data-col="count"]')).toHaveTextContent('3')
})

test('matchups section shows each unique final once', () => {
  render(<StatsPage users={USERS} />)
  const list = document.querySelector('[data-section="matchups"]')!
  const rows = list.querySelectorAll('li')
  expect(rows.length).toBe(4)
})

test('France vs Brazil matchup appears before France vs Argentina (higher count)', () => {
  render(<StatsPage users={USERS} />)
  const list = document.querySelector('[data-section="matchups"]')!
  const rows = Array.from(list.querySelectorAll('li'))
  const fbIdx = rows.findIndex(r => r.textContent?.includes('צרפת') && r.textContent?.includes('ברזיל'))
  const faIdx = rows.findIndex(r => r.textContent?.includes('צרפת') && r.textContent?.includes('ארגנטינה'))
  expect(fbIdx).toBeLessThan(faIdx)
})

test('matchup row shows picker names', () => {
  render(<StatsPage users={USERS} />)
  const list = document.querySelector('[data-section="matchups"]')!
  const fbRow = Array.from(list.querySelectorAll('li')).find(
    li => li.textContent?.includes('צרפת') && li.textContent?.includes('ברזיל')
  )!
  expect(fbRow).toHaveTextContent('עידן')
  expect(fbRow).toHaveTextContent('אורן')
  expect(fbRow).toHaveTextContent('אלדד')
})

// ── Team stage table section ─────────────────────────────────────

const STAGE_USERS: User[] = [
  makeUser('א', 'France', ['France', 'Brazil'], ['France', 'Brazil', 'Germany', 'Spain'], ['France', 'Brazil', 'Germany', 'Spain', 'Argentina', 'Portugal', 'England', 'Netherlands'], ['France', 'Brazil', 'Germany', 'Spain', 'Argentina', 'Portugal', 'England', 'Netherlands', 'Belgium', 'Italy', 'Japan', 'Morocco', 'Uruguay', 'Mexico', 'Denmark', 'Australia']),
  makeUser('ב', 'France', ['France', 'Germany'], ['France', 'Germany', 'Brazil', 'Spain'], ['France', 'Germany', 'Brazil', 'Spain', 'Argentina', 'Portugal', 'England', 'Netherlands'], ['France', 'Germany', 'Brazil', 'Spain', 'Argentina', 'Portugal', 'England', 'Netherlands', 'Belgium', 'Italy', 'Japan', 'Morocco', 'Uruguay', 'Mexico', 'Denmark', 'Australia']),
  makeUser('ג', 'Brazil', ['France', 'Brazil'], ['France', 'Brazil', 'Germany', 'Argentina'], ['France', 'Brazil', 'Germany', 'Argentina', 'Spain', 'Portugal', 'England', 'Netherlands'], ['France', 'Brazil', 'Germany', 'Argentina', 'Spain', 'Portugal', 'England', 'Netherlands', 'Belgium', 'Italy', 'Japan', 'Morocco', 'Uruguay', 'Mexico', 'Denmark', 'Australia']),
]

function getStageSection() {
  return document.querySelector('[data-section="team-stages"]')!
}

test('team stages section renders', () => {
  render(<StatsPage users={STAGE_USERS} />)
  expect(getStageSection()).toBeTruthy()
})

test('France shows r16 count 3, champion count 2', () => {
  render(<StatsPage users={STAGE_USERS} />)
  const table = getStageSection()
  const franceRow = Array.from(table.querySelectorAll('tr')).find(
    r => r.textContent?.includes('צרפת')
  )!
  expect(franceRow.querySelector('[data-col="r16"]')).toHaveTextContent('3')
  expect(franceRow.querySelector('[data-col="champion"]')).toHaveTextContent('2')
})

test('Brazil shows final count 2, champion count 1', () => {
  render(<StatsPage users={STAGE_USERS} />)
  const table = getStageSection()
  const brazilRow = Array.from(table.querySelectorAll('tr')).find(
    r => r.textContent?.includes('ברזיל')
  )!
  expect(brazilRow.querySelector('[data-col="final"]')).toHaveTextContent('2')
  expect(brazilRow.querySelector('[data-col="champion"]')).toHaveTextContent('1')
})

test('France row appears before Germany row (higher score)', () => {
  render(<StatsPage users={STAGE_USERS} />)
  const table = getStageSection()
  const rows = Array.from(table.querySelectorAll('tbody tr'))
  const franceIdx = rows.findIndex(r => r.textContent?.includes('צרפת'))
  const germanyIdx = rows.findIndex(r => r.textContent?.includes('גרמניה'))
  expect(franceIdx).toBeLessThan(germanyIdx)
})

test('r32 count reflects teams from knockoutStages.r32', () => {
  const userWithR32: User = {
    label: 'test',
    predictions: {},
    topGoalscorer: '',
    groupTables: {},
    thirdPlaceQualification: emptyTP,
    groupMatches: {} as Record<string, GroupMatch[]>,
    knockoutStages: {
      ...emptyKO,
      r32: [
        { matchNum: 1, home: 'France', away: 'Germany', resolved: false },
        { matchNum: 2, home: 'Brazil', away: 'Spain', resolved: false },
      ],
    },
    predictedChampion: 'France',
    predictedFinalTeams: ['France', 'Brazil'],
  }
  render(<StatsPage users={[userWithR32]} />)
  const table = getStageSection()
  const franceRow = Array.from(table.querySelectorAll('tr')).find(r => r.textContent?.includes('צרפת'))!
  const germanyRow = Array.from(table.querySelectorAll('tr')).find(r => r.textContent?.includes('גרמניה'))!
  expect(franceRow.querySelector('[data-col="r32"]')).toHaveTextContent('1')
  expect(germanyRow.querySelector('[data-col="r32"]')).toHaveTextContent('1')
})
