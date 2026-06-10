import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import HitsTable from './HitsTable'

// Dana leads the combined total, Yossi leads tzelifot, Dana leads pgiyot
const ROWS = [
  { label: 'Dana', tzelifaCount: 1, pgiyaCount: 5 },
  { label: 'Yossi', tzelifaCount: 3, pgiyaCount: 0 },
]

function desktopTable() {
  return screen.getAllByRole('table')[0]
}

function rowNames() {
  return within(desktopTable()).getAllByRole('row').slice(1)
    .map(row => within(row).getAllByRole('cell')[1].textContent)
}

test('combined table sorts by total by default', () => {
  render(<HitsTable rows={ROWS} />)
  expect(rowNames()).toEqual(['Dana', 'Yossi'])
})

test('clicking צליפות header sorts by tzelifot', async () => {
  render(<HitsTable rows={ROWS} />)
  await userEvent.click(within(desktopTable()).getByRole('button', { name: 'צליפות' }))
  expect(rowNames()).toEqual(['Yossi', 'Dana'])
})

test('clicking פגיעות then סה"כ returns to total order', async () => {
  render(<HitsTable rows={ROWS} />)
  await userEvent.click(within(desktopTable()).getByRole('button', { name: 'פגיעות' }))
  expect(rowNames()).toEqual(['Dana', 'Yossi'])
  await userEvent.click(within(desktopTable()).getByRole('button', { name: 'צליפות' }))
  expect(rowNames()).toEqual(['Yossi', 'Dana'])
  await userEvent.click(within(desktopTable()).getByRole('button', { name: 'סה"כ' }))
  expect(rowNames()).toEqual(['Dana', 'Yossi'])
})

test('active sort column is marked with aria-sort', async () => {
  render(<HitsTable rows={ROWS} />)
  const headers = () => within(desktopTable()).getAllByRole('columnheader')
  expect(headers().filter(h => h.getAttribute('aria-sort') === 'descending')
    .map(h => h.textContent)).toEqual(['סה"כ'])
  await userEvent.click(within(desktopTable()).getByRole('button', { name: 'צליפות' }))
  expect(headers().filter(h => h.getAttribute('aria-sort') === 'descending')
    .map(h => h.textContent)).toEqual(['צליפות'])
})
