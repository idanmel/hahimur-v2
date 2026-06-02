import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import GoalScorerSection from './GoalScorerSection'

function setup(players = ['Messi', 'Ronaldo'], realGoals: Record<string, number> = {}, defaultWinner?: string) {
  const onChange = vi.fn()
  render(
    <GoalScorerSection
      players={players}
      realGoals={realGoals}
      defaultWinner={defaultWinner}
      onChange={onChange}
    />
  )
  return { onChange }
}

function checkbox(name: string) {
  return screen.getByRole('checkbox', { name })
}

function goalInput(name: string) {
  return screen.getByRole('spinbutton', { name })
}

describe('GoalScorerSection', () => {
  test('all checkboxes disabled when no goals entered', () => {
    setup()
    expect(checkbox('Messi')).toBeDisabled()
    expect(checkbox('Ronaldo')).toBeDisabled()
  })

  test('only the leader checkbox is enabled', async () => {
    setup()
    await userEvent.type(goalInput('Messi'), '5')
    expect(checkbox('Messi')).toBeEnabled()
    expect(checkbox('Ronaldo')).toBeDisabled()
  })

  test('checking a player sets them as golden boot winner', async () => {
    const { onChange } = setup()
    await userEvent.type(goalInput('Messi'), '5')
    await userEvent.click(checkbox('Messi'))
    const lastCall = onChange.mock.calls.at(-1)!
    expect(lastCall[1]).toBe('Messi')
  })

  test('unchecking the winner clears the selection', async () => {
    const { onChange } = setup()
    await userEvent.type(goalInput('Messi'), '5')
    await userEvent.click(checkbox('Messi'))
    await userEvent.click(checkbox('Messi'))
    const lastCall = onChange.mock.calls.at(-1)!
    expect(lastCall[1]).toBeUndefined()
  })

  test('winner is cleared when their goals drop below another player', async () => {
    const { onChange } = setup()
    await userEvent.type(goalInput('Messi'), '5')
    await userEvent.click(checkbox('Messi'))
    await userEvent.type(goalInput('Ronaldo'), '7')
    const lastCall = onChange.mock.calls.at(-1)!
    expect(lastCall[1]).toBeUndefined()
  })

  test('goals cannot go below the real floor', () => {
    const { onChange } = setup(['Messi'], { Messi: 3 })
    fireEvent.change(goalInput('Messi'), { target: { value: '1' } })
    const lastCall = onChange.mock.calls.at(-1)!
    expect(lastCall[0]['Messi']).toBe(3)
  })
})
