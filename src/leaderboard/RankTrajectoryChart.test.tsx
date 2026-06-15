import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import RankTrajectoryChart from './RankTrajectoryChart'

function points(): { x: number; y: number }[] {
  const polyline = screen.getByTestId('lb-traj-line')
  return polyline.getAttribute('points')!.trim().split(/\s+/).map(pair => {
    const [x, y] = pair.split(',').map(Number)
    return { x, y }
  })
}

test('draws one point per played match, left to right', () => {
  render(<RankTrajectoryChart ranks={[1, 4, 1]} />)
  expect(screen.getByRole('img')).toBeInTheDocument() // the svg
  const p = points()
  expect(p).toHaveLength(3)
  expect(p[0].x).toBeLessThan(p[1].x)
  expect(p[1].x).toBeLessThan(p[2].x)
})

test('maps rank 1 to the top and lower ranks further down', () => {
  render(<RankTrajectoryChart ranks={[1, 4, 1]} />)
  const p = points()
  // rank 1 sits above (smaller y) rank 4
  expect(p[0].y).toBeLessThan(p[1].y)
  expect(p[2].y).toBeLessThan(p[1].y)
  expect(p[0].y).toEqual(p[2].y) // same rank → same height
})

test('fits the vertical span to the ranks actually held, so small moves still fill the chart', () => {
  const span = (ranks: number[]) => {
    const { container, unmount } = render(<RankTrajectoryChart ranks={ranks} />)
    const ys = container.querySelector('[data-testid="lb-traj-line"]')!
      .getAttribute('points')!.trim().split(/\s+/).map(p => Number(p.split(',')[1]))
    unmount()
    return Math.max(...ys) - Math.min(...ys)
  }
  // a 1↔4 swing and an 8↔9 swing both use the full height — the line is auto-fit
  expect(span([8, 9, 8])).toEqual(span([1, 4, 1]))
})

test('summarises best, worst and current rank in the stat line', () => {
  render(<RankTrajectoryChart ranks={[2, 5, 3]} />)
  const stats = screen.getByTestId('lb-traj-caption')
  expect(within(stats).getByText('2')).toBeInTheDocument() // best
  expect(within(stats).getByText('5')).toBeInTheDocument() // worst
  expect(within(stats).getByText('3')).toBeInTheDocument() // current
})

test('labels only the endpoints when the run is monotonic', () => {
  render(<RankTrajectoryChart ranks={[5, 4, 3, 2, 1]} />)
  const labels = [...screen.getByRole('img').querySelectorAll('text')].map(t => t.textContent)
  expect(labels).toEqual(['5', '1']) // start + current, nothing in between
})

test('labels turning points as well as the endpoints', () => {
  render(<RankTrajectoryChart ranks={[1, 4, 1]} />)
  const labels = [...screen.getByRole('img').querySelectorAll('text')].map(t => t.textContent)
  expect(labels).toEqual(['1', '4', '1']) // start, the dip, current
})

