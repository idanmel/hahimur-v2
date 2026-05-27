import { render, screen } from '@testing-library/react'
import StatsPage from './StatsPage'

test('stats page renders', () => {
  render(<StatsPage />)
  expect(screen.getByRole('heading', { name: /stats/i })).toBeInTheDocument()
})
