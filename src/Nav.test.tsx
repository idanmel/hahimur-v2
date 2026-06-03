import { render, screen, act } from '@testing-library/react'
import Nav, { USER_STORAGE_EVENT } from './Nav'

beforeEach(() => localStorage.clear())

test('regular user sees home and form links', () => {
  render(<Nav />)
  expect(screen.getByText('בית')).toBeInTheDocument()
  expect(screen.getByText('הטופס')).toBeInTheDocument()
  expect(screen.queryByText('תוצאות')).not.toBeInTheDocument()
})

test('ליכטטור sees home and admin links', () => {
  localStorage.setItem('userName', 'ליכטטור')
  render(<Nav />)
  expect(screen.getByText('בית')).toBeInTheDocument()
  expect(screen.getByText('הטופס')).toBeInTheDocument()
  expect(screen.getByText('טפסים')).toBeInTheDocument()
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

test('shows admin links when user storage event fires with admin name', () => {
  render(<Nav />)
  expect(screen.queryByText('טפסים')).not.toBeInTheDocument()

  act(() => {
    localStorage.setItem('user', JSON.stringify({ label: 'ליכטטור' }))
    window.dispatchEvent(new Event(USER_STORAGE_EVENT))
  })

  expect(screen.getByText('טפסים')).toBeInTheDocument()
})

test('hides admin links when user storage event fires with non-admin name', () => {
  localStorage.setItem('user', JSON.stringify({ label: 'ליכטטור' }))
  render(<Nav />)
  expect(screen.getByText('טפסים')).toBeInTheDocument()

  act(() => {
    localStorage.setItem('user', JSON.stringify({ label: 'דוגמה מלמד' }))
    window.dispatchEvent(new Event(USER_STORAGE_EVENT))
  })

  expect(screen.queryByText('טפסים')).not.toBeInTheDocument()
})
