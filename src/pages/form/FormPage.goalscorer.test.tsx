import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import FormPage from './FormPage'

vi.mock('../../Nav', () => ({ default: () => null }))
vi.mock('../../shared/Countdown', () => ({ default: () => null }))
vi.mock('../../formView/knockout/KnockoutTable', () => ({ default: () => null }))
vi.mock('../../formView/thirdPlace/ThirdPlaceTable', () => ({ default: () => null }))
vi.mock('../../formView/knockout/ChampionBanner', () => ({ default: () => null }))

beforeEach(() => localStorage.clear())

describe('Top Goalscorer (מלך השערים)', () => {
  test('section heading is visible', () => {
    render(<FormPage />)
    expect(screen.getByText('מלך השערים')).toBeInTheDocument()
  })

  test('input field is visible with Hebrew placeholder', () => {
    render(<FormPage />)
    const input = screen.getByPlaceholderText('שם השחקן...')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'text')
  })

  test('user can type a player name', () => {
    render(<FormPage />)
    const input = screen.getByPlaceholderText('שם השחקן...') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Lionel Messi' } })
    expect(input.value).toBe('Lionel Messi')
  })

  test('user can clear the input', () => {
    render(<FormPage />)
    const input = screen.getByPlaceholderText('שם השחקן...') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Cristiano Ronaldo' } })
    expect(input.value).toBe('Cristiano Ronaldo')
    fireEvent.change(input, { target: { value: '' } })
    expect(input.value).toBe('')
  })

  test('player name persists across remount (simulated refresh)', () => {
    const { unmount } = render(<FormPage />)
    const input = screen.getByPlaceholderText('שם השחקן...') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Kylian Mbappe' } })
    unmount()
    render(<FormPage />)
    const inputAfterRemount = screen.getByPlaceholderText('שם השחקן...') as HTMLInputElement
    expect(inputAfterRemount.value).toBe('Kylian Mbappe')
  })

  test('player name is stored in localStorage', () => {
    render(<FormPage />)
    const input = screen.getByPlaceholderText('שם השחקן...')
    fireEvent.change(input, { target: { value: 'Erling Haaland' } })
    expect(JSON.parse(localStorage.getItem('user')!).topGoalscorer).toBe('Erling Haaland')
  })

  test('empty string is persisted when input is cleared', () => {
    render(<FormPage />)
    const input = screen.getByPlaceholderText('שם השחקן...')
    fireEvent.change(input, { target: { value: 'Harry Kane' } })
    fireEvent.change(input, { target: { value: '' } })
    expect(JSON.parse(localStorage.getItem('user')!).topGoalscorer).toBe('')
  })

  test('player name is loaded from localStorage on mount', () => {
    localStorage.setItem('topGoalscorer', 'Neymar Jr')
    render(<FormPage />)
    const input = screen.getByPlaceholderText('שם השחקן...') as HTMLInputElement
    expect(input.value).toBe('Neymar Jr')
  })

  test('player name updates are independent of match predictions', () => {
    render(<FormPage />)
    const mexicoInput = screen.getAllByLabelText('מקסיקו')[0]
    const goalscorInput = screen.getByPlaceholderText('שם השחקן...')
    fireEvent.change(mexicoInput, { target: { value: '2' } })
    fireEvent.change(goalscorInput, { target: { value: 'Vinicius Jr' } })
    expect((mexicoInput as HTMLInputElement).value).toBe('2')
    expect((goalscorInput as HTMLInputElement).value).toBe('Vinicius Jr')
    const stored = JSON.parse(localStorage.getItem('user')!)
    expect(stored.topGoalscorer).toBe('Vinicius Jr')
    expect(JSON.stringify(stored.groupMatches)).not.toContain('Vinicius')
  })

  test('input has correct CSS class for styling', () => {
    render(<FormPage />)
    const input = screen.getByPlaceholderText('שם השחקן...')
    expect(input).toHaveClass('goalscorer-input')
  })

  test('input is in a card with correct styling class', () => {
    render(<FormPage />)
    const card = document.querySelector('.goalscorer-card')
    expect(card).toBeInTheDocument()
    const input = card?.querySelector('.goalscorer-input')
    expect(input).toBeInTheDocument()
  })
})
