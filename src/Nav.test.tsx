import { render, screen } from '@testing-library/react'
import Nav from './Nav'

test('shows all nav links', () => {
  render(<Nav />)
  expect(screen.getByText('בית')).toBeInTheDocument()
  expect(screen.getByText('טפסים')).toBeInTheDocument()
  expect(screen.getByText('תוצאות')).toBeInTheDocument()
  expect(screen.getByText('סטטיסטיקות')).toBeInTheDocument()
})
