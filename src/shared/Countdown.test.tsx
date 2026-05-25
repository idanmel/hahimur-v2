import { render, screen } from '@testing-library/react'
import { vi, afterEach } from 'vitest'
import Countdown from './Countdown'

const TARGET = new Date('2026-06-11T00:00:00')

afterEach(() => vi.useRealTimers())

test('shows countdown labels', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-10T00:00:00'))
  render(<Countdown targetDate={TARGET} />)
  expect(screen.getByText('ימים')).toBeInTheDocument()
  expect(screen.getByText('שעות')).toBeInTheDocument()
  expect(screen.getByText('דקות')).toBeInTheDocument()
  expect(screen.getByText('שניות')).toBeInTheDocument()
})

test('shows correct days when 2 days remain', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-09T00:00:00'))
  render(<Countdown targetDate={TARGET} />)
  expect(screen.getByText('02')).toBeInTheDocument()
})

test('shows zeros when target date has passed', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-12T00:00:00'))
  render(<Countdown targetDate={TARGET} />)
  expect(screen.getAllByText('00').length).toBe(4)
})
