import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import FormsPage from './FormsPage'
import type { User } from '../../users/index'

vi.mock('../../Nav', () => ({ default: () => null }))

const USERS: User[] = [
  { label: 'טל ליכטר',  predictions: {}, topGoalscorer: 'מבאפה', groupMatches: {}, groupTables: {}, thirdPlaceQualification: { resolved: true, all: [], qualifiers: [] }, knockoutStages: { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] } },
  { label: 'עידן מלמד', predictions: {}, topGoalscorer: 'מסי',   groupMatches: {}, groupTables: {}, thirdPlaceQualification: { resolved: true, all: [], qualifiers: [] }, knockoutStages: { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] } },
  { label: 'אלרד גומא', predictions: {}, topGoalscorer: '',      groupMatches: {}, groupTables: {}, thirdPlaceQualification: { resolved: true, all: [], qualifiers: [] }, knockoutStages: { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] } },
]
const USERS_SORTED = [...USERS].sort((a, b) => a.label.localeCompare(b.label, 'he'))

function selectUser(name: string) {
  render(<FormsPage users={USERS} usersSorted={USERS_SORTED} />)
  fireEvent.click(screen.getByRole('button', { name: /בחר שחקן/ }))
  fireEvent.click(screen.getByRole('option', { name: new RegExp(name) }))
}

test('forms page shows הטפסים heading', () => {
  render(<FormsPage users={USERS} usersSorted={USERS_SORTED} />)
  expect(screen.getByRole('heading', { name: 'הטפסים' })).toBeInTheDocument()
})

test('shows a user dropdown on load', () => {
  render(<FormsPage users={USERS} usersSorted={USERS_SORTED} />)
  expect(screen.getByRole('button', { name: /בחר שחקן/ })).toBeInTheDocument()
})

test('shows no predictions on initial load', () => {
  render(<FormsPage users={USERS} usersSorted={USERS_SORTED} />)
  expect(screen.queryByRole('button', { name: 'א' })).not.toBeInTheDocument()
})

test('shows בחר שחקן prompt on initial load', () => {
  render(<FormsPage users={USERS} usersSorted={USERS_SORTED} />)
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
