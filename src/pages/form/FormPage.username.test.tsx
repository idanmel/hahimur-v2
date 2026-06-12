import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import FormPage from './FormPage'

vi.mock('../../Nav', () => ({ default: () => null, USER_STORAGE_EVENT: 'userStorageUpdated' }))
vi.mock('../../formView/knockout/KnockoutTable', () => ({ default: () => null }))
vi.mock('../../formView/thirdPlace/ThirdPlaceTable', () => ({ default: () => null }))
vi.mock('../../formView/knockout/ChampionBanner', () => ({ default: () => null }))

beforeEach(() => localStorage.clear())

function setupSaveSpy() {
  const mockClick = vi.fn()
  const mockAnchor = { href: '', download: '', click: mockClick }
  const original = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag, ...args) => {
    if (tag === 'a') return mockAnchor as unknown as HTMLElement
    return original(tag, ...args)
  })
  vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:fake')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  return mockAnchor
}

describe('User name field', () => {
  test('name input is visible with Hebrew placeholder', () => {
    render(<FormPage />)
    expect(screen.getByPlaceholderText('שמך...')).toBeInTheDocument()
  })

  test('name persists across remount', () => {
    const { unmount } = render(<FormPage />)
    fireEvent.change(screen.getByPlaceholderText('שמך...'), { target: { value: 'idan' } })
    unmount()
    render(<FormPage />)
    expect(screen.getByPlaceholderText('שמך...')).toHaveValue('idan')
  })

  test('name is loaded from localStorage on mount', () => {
    localStorage.setItem('userName', 'idan')
    render(<FormPage />)
    expect(screen.getByPlaceholderText('שמך...')).toHaveValue('idan')
  })
})

describe('Save file with user name', () => {
  test('filename includes slugified name', () => {
    render(<FormPage />)
    fireEvent.change(screen.getByPlaceholderText('שמך...'), { target: { value: 'Idan Melamed' } })
    const anchor = setupSaveSpy()
    fireEvent.click(screen.getByRole('button', { name: /שמור/i }))
    expect(anchor.download).toBe('wc2026-predictions-idan-melamed.json')
    vi.restoreAllMocks()
  })

  test('filename is default when name is empty', () => {
    render(<FormPage />)
    const anchor = setupSaveSpy()
    fireEvent.click(screen.getByRole('button', { name: /שמור/i }))
    expect(anchor.download).toBe('wc2026-predictions.json')
    vi.restoreAllMocks()
  })

  test('slugify trims surrounding whitespace', () => {
    render(<FormPage />)
    fireEvent.change(screen.getByPlaceholderText('שמך...'), { target: { value: '  idan  ' } })
    const anchor = setupSaveSpy()
    fireEvent.click(screen.getByRole('button', { name: /שמור/i }))
    expect(anchor.download).toBe('wc2026-predictions-idan.json')
    vi.restoreAllMocks()
  })

  test('slugify lowercases the name', () => {
    render(<FormPage />)
    fireEvent.change(screen.getByPlaceholderText('שמך...'), { target: { value: 'IDAN' } })
    const anchor = setupSaveSpy()
    fireEvent.click(screen.getByRole('button', { name: /שמור/i }))
    expect(anchor.download).toBe('wc2026-predictions-idan.json')
    vi.restoreAllMocks()
  })

  test('slugify replaces spaces with hyphens', () => {
    render(<FormPage />)
    fireEvent.change(screen.getByPlaceholderText('שמך...'), { target: { value: 'tal lichtner' } })
    const anchor = setupSaveSpy()
    fireEvent.click(screen.getByRole('button', { name: /שמור/i }))
    expect(anchor.download).toBe('wc2026-predictions-tal-lichtner.json')
    vi.restoreAllMocks()
  })
})
