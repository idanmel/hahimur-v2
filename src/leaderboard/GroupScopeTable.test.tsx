import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import GroupScopeTable from './GroupScopeTable'

// Yossi leads total points; Dana leads combined hits and pgiyot; Yossi leads tzelifot
const ROWS = [
  { label: 'Dana', tzelifaCount: 1, pgiyaCount: 5, matchPoints: 14, advancementPoints: 0, placePoints: 0, goalsPoints: 0, total: 14, tournamentTotal: 14 },
  { label: 'Yossi', tzelifaCount: 3, pgiyaCount: 0, matchPoints: 12, advancementPoints: 10, placePoints: 0, goalsPoints: 0, total: 22, tournamentTotal: 22 },
]

function desktopTable() {
  return screen.getAllByRole('table')[0]
}

function rowNames() {
  return within(desktopTable()).getAllByRole('row').slice(2)
    .map(row => within(row).getAllByRole('cell')[1].textContent)
}

test('table sorts by total points by default', () => {
  render(<GroupScopeTable rows={ROWS} />)
  expect(rowNames()).toEqual(['Yossi', 'Dana'])
})

test('clicking ביחד header sorts by combined hits', async () => {
  render(<GroupScopeTable rows={ROWS} />)
  await userEvent.click(within(desktopTable()).getByRole('button', { name: 'ביחד' }))
  expect(rowNames()).toEqual(['Dana', 'Yossi'])
})

test('clicking through hit and point columns reorders accordingly', async () => {
  render(<GroupScopeTable rows={ROWS} />)
  await userEvent.click(within(desktopTable()).getByRole('button', { name: 'פגיעות' }))
  expect(rowNames()).toEqual(['Dana', 'Yossi'])
  await userEvent.click(within(desktopTable()).getByRole('button', { name: 'צליפות' }))
  expect(rowNames()).toEqual(['Yossi', 'Dana'])
  await userEvent.click(within(desktopTable()).getByRole('button', { name: 'משחקים' }))
  expect(rowNames()).toEqual(['Dana', 'Yossi'])
  await userEvent.click(within(desktopTable()).getByRole('button', { name: 'סה"כ' }))
  expect(rowNames()).toEqual(['Yossi', 'Dana'])
})

// Dana leads on goals and in-range total; Yossi leads on match points and tournament total
const LASTX_ROWS = [
  { label: 'Dana', tzelifaCount: 1, pgiyaCount: 0, matchPoints: 4, advancementPoints: 0, placePoints: 0, goalsPoints: 12, total: 16, tournamentTotal: 18 },
  { label: 'Yossi', tzelifaCount: 1, pgiyaCount: 1, matchPoints: 6, advancementPoints: 0, placePoints: 0, goalsPoints: 0, total: 6, tournamentTotal: 40 },
]

test('window variant breaks points into משחקים, שערים and בטווח, sortable by each', async () => {
  render(<GroupScopeTable variant="window" rows={LASTX_ROWS} />)
  expect(rowNames()).toEqual(['Dana', 'Yossi']) // default sort: in-range total
  await userEvent.click(within(desktopTable()).getByRole('button', { name: 'משחקים' }))
  expect(rowNames()).toEqual(['Yossi', 'Dana'])
  await userEvent.click(within(desktopTable()).getByRole('button', { name: 'שערים' }))
  expect(rowNames()).toEqual(['Dana', 'Yossi'])
})

test('window variant adds a בטורניר column sorting by full-tournament total', async () => {
  render(<GroupScopeTable variant="window" rows={LASTX_ROWS} />)
  expect(rowNames()).toEqual(['Dana', 'Yossi']) // default: בטווח keeps Dana on top
  await userEvent.click(within(desktopTable()).getByRole('button', { name: 'בטורניר' }))
  expect(rowNames()).toEqual(['Yossi', 'Dana']) // Yossi stands higher overall
})

test('active sort column is marked with aria-sort', async () => {
  render(<GroupScopeTable rows={ROWS} />)
  const headers = () => within(desktopTable()).getAllByRole('columnheader')
  expect(headers().filter(h => h.getAttribute('aria-sort') === 'descending')
    .map(h => h.textContent)).toEqual(['סה"כ'])
  await userEvent.click(within(desktopTable()).getByRole('button', { name: 'עולות' }))
  expect(headers().filter(h => h.getAttribute('aria-sort') === 'descending')
    .map(h => h.textContent)).toEqual(['עולות'])
})
