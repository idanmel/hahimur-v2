import { render, screen } from '@testing-library/react'
import AllPredictionsPage from './AllPredictionsPage'

// --- Slice 1: /all-predictions route renders a heading ---

test('all predictions page shows הימורי כולם heading', () => {
  render(<AllPredictionsPage />)
  expect(screen.getByRole('heading', { name: 'הטפסים' })).toBeInTheDocument()
})
