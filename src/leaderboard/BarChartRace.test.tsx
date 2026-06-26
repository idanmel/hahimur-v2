import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test } from 'vitest'
import BarChartRace from './BarChartRace'
import type { RaceFrame } from './raceFrames'

const frames: RaceFrame[] = [
  { matchId: 'A1', date: '11 ביוני', matchLabel: 'מקסיקו 2–0 דרום אפריקה', bars: [{ label: 'Alice', total: 4 }, { label: 'Bob', total: 2 }] },
  { matchId: 'A2', date: '12 ביוני', matchLabel: 'דרום קוריאה 1–1 צ׳כיה', bars: [{ label: 'Alice', total: 8 }, { label: 'Bob', total: 4 }] },
]
const colors = { Alice: '#4e79a7', Bob: '#f28e2b' }

test('shows the date of the first frame as the running counter', () => {
  render(<BarChartRace frames={frames} colors={colors} autoPlay={false} />)
  expect(screen.getByTestId('bcr-date')).toHaveTextContent('11 ביוני')
})

test('draws one bar per bettor, each in its own color', () => {
  const { container } = render(<BarChartRace frames={frames} colors={colors} autoPlay={false} />)
  const rects = [...container.querySelectorAll('rect.bcr-rect')]
  expect(rects).toHaveLength(2)
  expect(new Set(rects.map(r => r.getAttribute('fill')))).toEqual(new Set(['#4e79a7', '#f28e2b']))
})

test('scrubbing forward advances the date counter', () => {
  render(<BarChartRace frames={frames} colors={colors} autoPlay={false} />)
  fireEvent.change(screen.getByLabelText('מיקום בזמן'), { target: { value: '1' } })
  expect(screen.getByTestId('bcr-date')).toHaveTextContent('12 ביוני')
})

test('with no played matches it invites the user to wait', () => {
  render(<BarChartRace frames={[]} colors={{}} />)
  expect(screen.getByText(/עדיין אין משחקים/)).toBeInTheDocument()
})
