import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

beforeEach(() => localStorage.clear())

describe('Top Goalscorer (מלך השערים)', () => {
  test('section heading is visible', () => {
    render(<App />)
    expect(screen.getByText('מלך השערים')).toBeInTheDocument()
  })

  test('input field is visible with Hebrew placeholder', () => {
    render(<App />)
    const input = screen.getByPlaceholderText('שם השחקן...')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'text')
  })

  test('user can type a player name', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByPlaceholderText('שם השחקן...') as HTMLInputElement

    await user.type(input, 'Lionel Messi')
    expect(input.value).toBe('Lionel Messi')
  })

  test('user can clear the input', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByPlaceholderText('שם השחקן...') as HTMLInputElement

    await user.type(input, 'Cristiano Ronaldo')
    expect(input.value).toBe('Cristiano Ronaldo')

    await user.clear(input)
    expect(input.value).toBe('')
  })

  test('player name persists across remount (simulated refresh)', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)

    const input = screen.getByPlaceholderText('שם השחקן...') as HTMLInputElement
    await user.type(input, 'Kylian Mbappe')

    unmount()
    render(<App />)

    const inputAfterRemount = screen.getByPlaceholderText('שם השחקן...') as HTMLInputElement
    expect(inputAfterRemount.value).toBe('Kylian Mbappe')
  })

  test('player name is stored in localStorage under correct key', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByPlaceholderText('שם השחקן...')

    await user.type(input, 'Erling Haaland')

    const stored = localStorage.getItem('topGoalscorer')
    expect(stored).toBe('Erling Haaland')
  })

  test('empty string is persisted when input is cleared', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByPlaceholderText('שם השחקן...')

    await user.type(input, 'Harry Kane')
    await user.clear(input)

    const stored = localStorage.getItem('topGoalscorer')
    expect(stored).toBe('')
  })

  test('player name is loaded from localStorage on mount', () => {
    localStorage.setItem('topGoalscorer', 'Neymar Jr')
    render(<App />)

    const input = screen.getByPlaceholderText('שם השחקן...') as HTMLInputElement
    expect(input.value).toBe('Neymar Jr')
  })

  test('player name updates are independent of match predictions', async () => {
    const user = userEvent.setup()
    render(<App />)

    const mexicoInput = screen.getAllByLabelText('מקסיקו')[0]
    const goalscorInput = screen.getByPlaceholderText('שם השחקן...')

    await user.type(mexicoInput, '2')
    await user.type(goalscorInput, 'Vinicius Jr')

    expect((mexicoInput as HTMLInputElement).value).toBe('2')
    expect((goalscorInput as HTMLInputElement).value).toBe('Vinicius Jr')
    expect(localStorage.getItem('predictions')).not.toContain('Vinicius')
  })

  test('input has correct CSS class for styling', () => {
    render(<App />)
    const input = screen.getByPlaceholderText('שם השחקן...')
    expect(input).toHaveClass('goalscorer-input')
  })

  test('input is in a card with correct styling class', () => {
    render(<App />)
    const card = document.querySelector('.goalscorer-card')
    expect(card).toBeInTheDocument()
    const input = card?.querySelector('.goalscorer-input')
    expect(input).toBeInTheDocument()
  })
})
