import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach } from 'vitest'
import UserPicker from './UserPicker'

afterEach(() => localStorage.clear())

test('defaults to the placeholder when no one is identified', () => {
  render(<UserPicker />)
  expect(screen.getByRole('combobox')).toHaveValue('')
  expect(screen.getByRole('option', { name: 'מי אתה?' })).toBeInTheDocument()
})

test('lists every participant as an option', () => {
  render(<UserPicker />)
  expect(screen.getByRole('option', { name: 'עידן מלמד' })).toBeInTheDocument()
})

test('picking a name persists the choice and collapses the picker', () => {
  render(<UserPicker />)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'עידן מלמד' } })
  expect(localStorage.getItem('hahimur.me')).toBe('עידן מלמד')
  // The picker is gone — what's left is a finished pass showing the name.
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(screen.getByText('עידן מלמד')).toBeInTheDocument()
})

test('once stamped, החלף re-opens the picker to switch identity', () => {
  localStorage.setItem('hahimur.me', 'עידן מלמד')
  render(<UserPicker />)
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /החלף/ }))
  expect(screen.getByRole('combobox')).toHaveValue('עידן מלמד')
})
