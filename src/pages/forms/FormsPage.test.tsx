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

beforeEach(() => localStorage.clear())

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

describe('Selected user shown first', () => {
  test('shows the current user\'s form on load without opening the dropdown', () => {
    localStorage.setItem('hahimur.me', 'עידן מלמד')
    render(<FormsPage users={USERS} usersSorted={USERS_SORTED} />)
    expect(screen.getByRole('button', { name: 'עידן מלמד' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'א' })).toBeInTheDocument()
  })

  test('falls back to the placeholder when no current user is set', () => {
    render(<FormsPage users={USERS} usersSorted={USERS_SORTED} />)
    expect(screen.getByText('בחר שחקן')).toBeInTheDocument()
  })
})

describe('Compare mode', () => {
  function enterCompare() {
    render(<FormsPage users={USERS} usersSorted={USERS_SORTED} />)
    fireEvent.click(screen.getByRole('button', { name: 'השוואה' }))
  }

  test('switching to compare shows two player pickers', () => {
    enterCompare()
    expect(screen.getByText('שחקן ראשון')).toBeInTheDocument()
    expect(screen.getByText('שחקן שני')).toBeInTheDocument()
  })

  test('prompts to pick two players before any are selected', () => {
    enterCompare()
    expect(screen.getByText('בחרו שני שחקנים כדי להשוות בין הטפסים')).toBeInTheDocument()
  })

  test('renders the comparison once both players are selected', () => {
    enterCompare()
    fireEvent.click(screen.getByRole('button', { name: /שחקן ראשון/ }))
    fireEvent.click(screen.getByRole('option', { name: /טל ליכטר/ }))
    fireEvent.click(screen.getByRole('button', { name: /שחקן שני/ }))
    fireEvent.click(screen.getByRole('option', { name: /עידן מלמד/ }))
    expect(screen.getByText('פירוט נקודות')).toBeInTheDocument()
    expect(screen.getByText('השוואת ניחושים')).toBeInTheDocument()
  })

  test('the single-view picker is hidden in compare mode', () => {
    enterCompare()
    expect(screen.queryByText('בחר שחקן')).not.toBeInTheDocument()
  })
})

describe('By-date toggle', () => {
  test('toggle buttons are visible after selecting a user', () => {
    selectUser('טל ליכטר')
    expect(screen.getByRole('button', { name: 'לפי בית' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'לפי תאריך' })).toBeInTheDocument()
  })

  test('switching to by-date hides the group grid and shows date bands', () => {
    selectUser('טל ליכטר')
    fireEvent.click(screen.getByRole('button', { name: 'לפי תאריך' }))
    expect(screen.queryByRole('button', { name: 'א' })).not.toBeInTheDocument()
    expect(screen.getByText('11 ביוני')).toBeInTheDocument()
  })

  test('switching back to by-group restores the group grid', () => {
    selectUser('טל ליכטר')
    fireEvent.click(screen.getByRole('button', { name: 'לפי תאריך' }))
    fireEvent.click(screen.getByRole('button', { name: 'לפי בית' }))
    expect(screen.getByRole('button', { name: 'א' })).toBeInTheDocument()
  })
})
