import { render, screen } from '@testing-library/react'
import Nav from './Nav'

beforeEach(() => localStorage.clear())

test('regular user sees only home and form links', () => {
  render(<Nav />)
  expect(screen.getByText('בית')).toBeInTheDocument()
  expect(screen.getByText('הטופס')).toBeInTheDocument()
  expect(screen.queryByText('תוצאות')).not.toBeInTheDocument()
})

test('ליכטטור sees admin links in addition to regular links', () => {
  localStorage.setItem('userName', 'ליכטטור')
  render(<Nav />)
  expect(screen.getByText('בית')).toBeInTheDocument()
  expect(screen.getByText('הטופס')).toBeInTheDocument()
  expect(screen.getByText('טפסים')).toBeInTheDocument()
  expect(screen.getByText('הטבלה')).toBeInTheDocument()
})

test('ליכטטור sees stats link', () => {
  localStorage.setItem('userName', 'ליכטטור')
  render(<Nav />)
  expect(screen.getByText('סטטיסטיקות')).toBeInTheDocument()
})

test('regular user does not see stats link', () => {
  render(<Nav />)
  expect(screen.queryByText('סטטיסטיקות')).not.toBeInTheDocument()
})
