import { render, screen } from '@testing-library/react'
import HomePage from './HomePage'

test('home page shows title', () => {
  render(<HomePage />)
  expect(screen.getByText('ההימור 2026')).toBeInTheDocument()
})

test('home page shows waiting message', () => {
  render(<HomePage />)
  expect(screen.getByText('מחכים למסר מהליכטטור')).toBeInTheDocument()
})
