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
  expect(screen.getByRole('columnheader', { name: 'שלב הבתים' })).toBeInTheDocument()
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

test('tapping a bettor on mobile reveals their rank trajectory', () => {
  const row = makeRow({ matchPoints: 8, advancementPoints: 0 }) // label 'Dana'
  render(<LeaderboardTable rows={[row]} trajectories={{ Dana: [1, 4, 1] }} />)

  // collapsed by default — no trajectory shown yet
  expect(screen.queryByTestId('lb-traj-Dana')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /Dana/ }))
  const panel = screen.getByTestId('lb-traj-Dana')
  // the panel now holds the rank line graph
  expect(within(panel).getByTestId('lb-traj-line')).toBeInTheDocument()
})

test('no row is flagged when me is absent from the table', () => {
  const row = { ...makeRow({ matchPoints: 8, advancementPoints: 5 }), label: 'עידן' }
  render(<LeaderboardTable rows={[row]} me="someone-else" />)
  expect(screen.queryByText('אני')).not.toBeInTheDocument()
})
