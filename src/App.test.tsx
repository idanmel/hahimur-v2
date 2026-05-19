import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

test('predictions page shows title', () => {
  render(<App />)
  expect(screen.getByText('2026 World Cup Predictions')).toBeInTheDocument()
})

describe('Slice 2 — one match, fillable', () => {
  test('user enters valid scores for both teams', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Mexico score'), '2')
    await user.type(screen.getByLabelText('South Africa score'), '1')

    expect(screen.getByLabelText('Mexico score')).toHaveValue(2)
    expect(screen.getByLabelText('South Africa score')).toHaveValue(1)
  })

  test('valid input: zero is accepted', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Mexico score'), '0')
    expect(screen.getByLabelText('Mexico score')).toHaveValue(0)
  })

  test('invalid input: negative number is rejected', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Mexico score'), '-1')
    expect(screen.getByLabelText('Mexico score')).toHaveValue(null)
  })

  test('invalid input: decimal is rejected', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Mexico score'), '1.5')
    expect(screen.getByLabelText('Mexico score')).toHaveValue(null)
  })

  test('invalid input: letters are rejected', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Mexico score'), 'abc')
    expect(screen.getByLabelText('Mexico score')).toHaveValue(null)
  })

  test('invalid input: letters after a digit are dropped by the number input', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Typing "1a" in a number input: "1" is accepted, "a" is silently ignored
    // The field ends up with the valid prefix — this is correct browser behaviour
    await user.type(screen.getByLabelText('Mexico score'), '1a')
    expect(screen.getByLabelText('Mexico score')).toHaveValue(1)
  })

  test('invalid input: space is rejected', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Mexico score'), ' ')
    expect(screen.getByLabelText('Mexico score')).toHaveValue(null)
  })

  test('invalid input: special character is rejected', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('Mexico score'), '!')
    expect(screen.getByLabelText('Mexico score')).toHaveValue(null)
  })
})
