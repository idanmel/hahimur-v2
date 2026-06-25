import { render, screen, within, fireEvent } from '@testing-library/react'
import { expect, test } from 'vitest'
import LeaderboardTable, { type LeaderboardRow } from './LeaderboardTable'

const EMPTY_ROUND = { matchPoints: 0, advancementPoints: 0, total: 0 }

function makeRow(group: { matchPoints: number; advancementPoints: number }): LeaderboardRow {
  const total = group.matchPoints + group.advancementPoints
  return {
    label: 'Dana',
    group: { placePoints: 0, ...group, total },
    r32: EMPTY_ROUND,
    r16: EMPTY_ROUND,
    qf: EMPTY_ROUND,
    sf: EMPTY_ROUND,
    third: { matchPoints: 0, thirdPlaceWinner: 0, total: 0 },
    final: { matchPoints: 0, champion: 0, total: 0 },
    goldenBoot: { goalsPoints: 0, winnerBonus: 0, total: 0 },
    total,
  }
}

function withR32(row: LeaderboardRow, points: number): LeaderboardRow {
  return { ...row, r32: { matchPoints: points, advancementPoints: 0, total: points }, total: row.total + points }
}

function desktopHeaders() {
  return screen.getAllByRole('columnheader').map(h => h.textContent)
}

test('a single active round duplicates the total, so its column is dropped', () => {
  render(<LeaderboardTable rows={[makeRow({ matchPoints: 8, advancementPoints: 0 })]} />)
  expect(desktopHeaders().slice(0, 3)).toEqual(['#', 'מהמר', 'סה"כ'])
  expect(screen.queryByRole('columnheader', { name: 'שלב הבתים' })).not.toBeInTheDocument()
})

test('a lone active round returns once עולות points split its breakdown', () => {
  render(<LeaderboardTable rows={[makeRow({ matchPoints: 8, advancementPoints: 5 })]} />)
  // header appears in both desktop and mobile tables once the column returns
  expect(screen.getAllByRole('columnheader', { name: 'שלב הבתים' }).length).toBeGreaterThan(0)
  expect(screen.getByText('תוצאה')).toBeInTheDocument()
  expect(screen.getByText('עולות')).toBeInTheDocument()
})

test('two active rounds: flat per-round columns appear, no phase grouping row', () => {
  const row = withR32(makeRow({ matchPoints: 8, advancementPoints: 0 }), 3)
  render(<LeaderboardTable rows={[row]} />)
  expect(desktopHeaders().slice(0, 5)).toEqual(['#', 'מהמר', 'שלב הבתים', 'שלב 32', 'סה"כ'])
  expect(screen.queryByRole('columnheader', { name: 'נוקאאוט' })).not.toBeInTheDocument()
})

test('all rounds active: flat columns named per round', () => {
  const row = makeRow({ matchPoints: 8, advancementPoints: 0 })
  const scored = { matchPoints: 3, advancementPoints: 0, total: 3 }
  row.r32 = scored
  row.r16 = scored
  row.qf = scored
  row.sf = scored
  row.third = { matchPoints: 3, thirdPlaceWinner: 0, total: 3 }
  row.final = { matchPoints: 3, champion: 0, total: 3 }
  row.total = 8 + 6 * 3
  render(<LeaderboardTable rows={[row]} />)
  expect(desktopHeaders().slice(0, 10)).toEqual([
    '#', 'מהמר', 'שלב הבתים', 'שלב 32', 'שמינית', 'רבע', 'חצי', 'ארד', 'גמר', 'סה"כ',
  ])
})

test('hides the sub-breakdown when only one sub-field has points', () => {
  const row = withR32(makeRow({ matchPoints: 8, advancementPoints: 0 }), 3)
  render(<LeaderboardTable rows={[row]} />)
  expect(screen.queryByText('תוצאה')).not.toBeInTheDocument()
})

test('shows the sub-breakdown when more than one sub-field has points', () => {
  const row = withR32(makeRow({ matchPoints: 8, advancementPoints: 5 }), 3)
  render(<LeaderboardTable rows={[row]} />)
  expect(screen.getByText('תוצאה')).toBeInTheDocument()
  expect(screen.getByText('עולות')).toBeInTheDocument()
})

test('flags the viewer\'s own row with an "אני" badge, leaving others unmarked', () => {
  const mine = { ...makeRow({ matchPoints: 8, advancementPoints: 5 }), label: 'עידן' }
  const theirs = { ...makeRow({ matchPoints: 6, advancementPoints: 3 }), label: 'דנה' }
  render(<LeaderboardTable rows={[mine, theirs]} me="עידן" />)

  screen.getAllByText('עידן').map(el => el.closest('tr')!).forEach(tr => {
    expect(tr).toHaveClass('lb-row--me')
    expect(within(tr).getByText('אני')).toBeInTheDocument()
  })
  screen.getAllByText('דנה').map(el => el.closest('tr')!).forEach(tr => {
    expect(tr).not.toHaveClass('lb-row--me')
    expect(within(tr).queryByText('אני')).not.toBeInTheDocument()
  })
})

test.each([
  ['mobile', '.lb-mobile'],
  ['desktop', '.lb-desktop'],
])('tapping a bettor on %s reveals their rank trajectory', (_name, selector) => {
  const row = makeRow({ matchPoints: 8, advancementPoints: 0 }) // label 'Dana'
  const { container } = render(<LeaderboardTable rows={[row]} trajectories={{ Dana: [1, 4, 1] }} />)
  const table = within(container.querySelector(selector) as HTMLElement)

  // collapsed by default — no trajectory shown yet
  expect(table.queryByTestId('lb-traj-Dana')).not.toBeInTheDocument()

  fireEvent.click(table.getByRole('button', { name: /Dana/ }))
  const panel = table.getByTestId('lb-traj-Dana')
  // the panel now holds the rank line graph
  expect(within(panel).getByTestId('lb-traj-line')).toBeInTheDocument()
})

test.each([
  ['mobile', '.lb-mobile'],
  ['desktop', '.lb-desktop'],
])('tapping a bettor on %s reveals their golden-boot and champion picks', (_name, selector) => {
  const row = { ...makeRow({ matchPoints: 8, advancementPoints: 0 }), topGoalscorer: 'הארי קיין', predictedChampion: 'France' }
  const { container } = render(<LeaderboardTable rows={[row]} />)
  const table = within(container.querySelector(selector) as HTMLElement)

  // collapsed by default — no picks shown yet
  expect(table.queryByText('הארי קיין')).not.toBeInTheDocument()

  fireEvent.click(table.getByRole('button', { name: /Dana/ }))
  const panel = table.getByTestId('lb-traj-Dana')
  expect(within(panel).getByText('הארי קיין')).toBeInTheDocument()
  // champion shown in Hebrew (France → צרפת), not the raw English name
  expect(within(panel).getByText('צרפת')).toBeInTheDocument()
  expect(within(panel).queryByText('France')).not.toBeInTheDocument()
})

test('marks a pick correct when it earned its winner bonus', () => {
  const row = {
    ...makeRow({ matchPoints: 8, advancementPoints: 0 }),
    topGoalscorer: 'הארי קיין',
    predictedChampion: 'France',
    goldenBoot: { goalsPoints: 0, winnerBonus: 10, total: 10 },
    final: { matchPoints: 0, champion: 25, total: 25 },
  }
  render(<LeaderboardTable rows={[row]} />)
  fireEvent.click(within(document.querySelector('.lb-desktop') as HTMLElement).getByRole('button', { name: /Dana/ }))
  const panel = screen.getAllByTestId('lb-traj-Dana')[0]
  expect(within(panel).getAllByLabelText('ניחוש נכון')).toHaveLength(2)
})

test.each([
  ['mobile', '.lb-mobile'],
  ['desktop', '.lb-desktop'],
])('expanding a bettor on %s reveals a per-phase points breakdown', (_name, selector) => {
  const row = withR32(makeRow({ matchPoints: 8, advancementPoints: 5 }), 3) // group 13 + r32 3 = 16
  const { container } = render(<LeaderboardTable rows={[row]} />)
  const table = within(container.querySelector(selector) as HTMLElement)

  fireEvent.click(table.getByRole('button', { name: /Dana/ }))
  const panel = table.getByTestId('lb-traj-Dana')

  // both scoring phases are listed with their phase totals + sub-fields
  expect(within(panel).getByText('שלב הבתים')).toBeInTheDocument()
  expect(within(panel).getByText('שלב 32')).toBeInTheDocument()
  expect(within(panel).getByText('עולות')).toBeInTheDocument()
})

test('tapping anywhere on a mobile row toggles its breakdown panel', () => {
  const row = withR32(makeRow({ matchPoints: 8, advancementPoints: 5 }), 3) // group 13, r32 3, total 16
  const { container } = render(<LeaderboardTable rows={[row]} />)
  const mobile = within(container.querySelector('.lb-mobile') as HTMLElement)

  expect(mobile.queryByTestId('lb-traj-Dana')).not.toBeInTheDocument()

  // tap the group score cell (not the name button) — the row itself toggles open
  fireEvent.click(mobile.getByText('13'))
  expect(mobile.getByTestId('lb-traj-Dana')).toBeInTheDocument()
})

test('drilling into the group phase reveals the teams behind עולות and מיקומים', () => {
  const row: LeaderboardRow = {
    ...makeRow({ matchPoints: 8, advancementPoints: 4 }),
    group: { matchPoints: 8, advancementPoints: 4, placePoints: 1, total: 13 },
    total: 13,
    groupTeamDetail: {
      advancement: [{ team: 'Brazil', group: 'A' }],
      places: [{ team: 'Spain', group: 'A', position: 4 }],
    },
  }
  const { container } = render(<LeaderboardTable rows={[row]} />)
  const desktop = within(container.querySelector('.lb-desktop') as HTMLElement)

  // first click: open the bettor's breakdown panel
  fireEvent.click(desktop.getByRole('button', { name: /Dana/ }))
  const panel = desktop.getByTestId('lb-traj-Dana')

  // teams are hidden until the second click on the group phase row
  expect(within(panel).queryByText('בית A')).not.toBeInTheDocument()
  fireEvent.click(within(panel).getByRole('button', { name: /שלב הבתים/ }))

  expect(within(panel).getByText('בית A')).toBeInTheDocument()
  expect(within(panel).getByText('מקום 4 · בית A')).toBeInTheDocument()
})

test('no row is flagged when me is absent from the table', () => {
  const row = { ...makeRow({ matchPoints: 8, advancementPoints: 5 }), label: 'עידן' }
  render(<LeaderboardTable rows={[row]} me="someone-else" />)
  expect(screen.queryByText('אני')).not.toBeInTheDocument()
})
