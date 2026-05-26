import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import FormsPage from './FormsPage'

vi.mock('../../Nav', () => ({ default: () => null }))

vi.mock('../../users/index', () => {
  const USERS = [
    { label: 'טל ליכטר',  predictions: {}, topGoalscorer: 'מבאפה' },
    { label: 'עידן מלמד', predictions: {}, topGoalscorer: 'מסי' },
    { label: 'אלרד גומא', predictions: {}, topGoalscorer: '' },
  ]
  return {
    USERS,
    USERS_SORTED: [...USERS].sort((a, b) => a.label.localeCompare(b.label, 'he')),
  }
})

function selectUser(name: string) {
  render(<FormsPage />)
  fireEvent.click(screen.getByRole('button', { name: /בחר שחקן/ }))
  fireEvent.click(screen.getByRole('option', { name: new RegExp(name) }))
}

test('forms page shows הטפסים heading', () => {
  render(<FormsPage />)
  expect(screen.getByRole('heading', { name: 'הטפסים' })).toBeInTheDocument()
})

test('shows a user dropdown on load', () => {
  render(<FormsPage />)
  expect(screen.getByRole('button', { name: /בחר שחקן/ })).toBeInTheDocument()
})

test('shows no predictions on initial load', () => {
  render(<FormsPage />)
  expect(screen.queryByRole('button', { name: 'א' })).not.toBeInTheDocument()
})

test('shows בחר שחקן prompt on initial load', () => {
  render(<FormsPage />)
  expect(screen.getByText('בחר שחקן')).toBeInTheDocument()
})

test('shows group navigation tabs when טל ליכטר is selected', () => {
  selectUser('טל ליכטר')
  expect(screen.getByRole('button', { name: 'א' })).toBeInTheDocument()
})

test('shows עידן מלמד predictions when selected', () => {
  selectUser('עידן מלמד')
  expect(screen.getByRole('button', { name: 'א' })).toBeInTheDocument()
})

test('אלרד גומא appears in dropdown and shows predictions section', () => {
  selectUser('אלרד גומא')
  expect(screen.getByRole('button', { name: 'א' })).toBeInTheDocument()
})
