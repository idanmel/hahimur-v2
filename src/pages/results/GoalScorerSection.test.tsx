import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import GoalScorerSection from './GoalScorerSection'

function setup(
  players = ['Messi', 'Ronaldo'],
  realGoals: Record<string, number> = {},
  defaultWinner: string[] = [],
  eliminatedPlayers: string[] = [],
) {
  const onChange = vi.fn()
  render(
    <GoalScorerSection
      players={players}
      realGoals={realGoals}
      defaultWinner={defaultWinner}
      eliminatedPlayers={eliminatedPlayers}
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
    await userEvent.tab()
    expect(checkbox('Messi')).toBeEnabled()
    expect(checkbox('Ronaldo')).toBeDisabled()
  })

  test('checking a player sets them as golden boot winner', async () => {
    const { onChange } = setup()
    await userEvent.type(goalInput('Messi'), '5')
    await userEvent.click(checkbox('Messi'))
    const lastCall = onChange.mock.calls.at(-1)!
    expect(lastCall[1]).toEqual(['Messi'])
  })

  test('unchecking the winner clears the selection', async () => {
    const { onChange } = setup()
    await userEvent.type(goalInput('Messi'), '5')
    await userEvent.click(checkbox('Messi'))
    await userEvent.click(checkbox('Messi'))
    const lastCall = onChange.mock.calls.at(-1)!
    expect(lastCall[1]).toEqual([])
  })

  test('checking one tied player auto-selects all tied players', async () => {
    const { onChange } = setup()
    await userEvent.type(goalInput('Messi'), '5')
    await userEvent.type(goalInput('Ronaldo'), '5')
    await userEvent.click(checkbox('Messi'))
    const lastCall = onChange.mock.calls.at(-1)!
    expect(lastCall[1]).toEqual(['Messi', 'Ronaldo'])
  })

  test('newly tied player is auto-added to winners', async () => {
    const { onChange } = setup()
    await userEvent.type(goalInput('Messi'), '5')
    await userEvent.click(checkbox('Messi'))
    await userEvent.type(goalInput('Ronaldo'), '5')
    await userEvent.tab()
    const lastCall = onChange.mock.calls.at(-1)!
    expect(lastCall[1]).toEqual(['Messi', 'Ronaldo'])
  })

  test('winner is cleared when their goals drop below another player', async () => {
    const { onChange } = setup()
    await userEvent.type(goalInput('Messi'), '5')
    await userEvent.click(checkbox('Messi'))
    await userEvent.type(goalInput('Ronaldo'), '7')
    await userEvent.tab()
    const lastCall = onChange.mock.calls.at(-1)!
    expect(lastCall[1]).toEqual([])
  })

  test('winner is cleared when their goals drop to zero', async () => {
    const { onChange } = setup()
    await userEvent.type(goalInput('Messi'), '1')
    await userEvent.click(checkbox('Messi'))
    fireEvent.change(goalInput('Messi'), { target: { value: '0' } })
    fireEvent.blur(goalInput('Messi'))
    const lastCall = onChange.mock.calls.at(-1)!
    expect(lastCall[1]).toEqual([])
  })

  test('goals cannot go below the real floor', () => {
    const { onChange } = setup(['Messi'], { Messi: 3 })
    fireEvent.change(goalInput('Messi'), { target: { value: '1' } })
    fireEvent.blur(goalInput('Messi'))
    const lastCall = onChange.mock.calls.at(-1)!
    expect(lastCall[0]['Messi']).toBe(3)
  })

  test('rows are sorted by goals descending', () => {
    setup(['Kane', 'Messi', 'Haaland'], { Kane: 2, Messi: 6, Haaland: 5 })
    const rendered = screen.getAllByRole('spinbutton').map(el => el.getAttribute('aria-label'))
    expect(rendered).toEqual(['Messi', 'Haaland', 'Kane'])
  })

  test('the current leader is badged "מוביל", chasers are not', () => {
    setup(['Messi', 'Haaland'], { Messi: 6, Haaland: 5 })
    const badges = screen.getAllByText('מוביל')
    expect(badges).toHaveLength(1)
    // The badge sits inside Messi's name row, not Haaland's.
    expect(badges[0].closest('.pg-scorer-row')).toContainElement(checkbox('Messi'))
  })

  test('the leader badge is shown even when no winner is checked (no premature bonus)', () => {
    const { onChange } = setup(['Messi'], { Messi: 6 })
    expect(screen.getByText('מוביל')).toBeInTheDocument()
    // No winner committed unless the checkbox is used.
    expect(onChange).not.toHaveBeenCalled()
    expect(checkbox('Messi')).not.toBeChecked()
  })

  test('a trailing player whose team is out is marked "מחוץ למירוץ"', () => {
    setup(['Messi', 'Kane'], { Messi: 6, Kane: 3 }, [], ['Kane'])
    const badge = screen.getByText('מחוץ למירוץ')
    expect(badge.closest('.pg-scorer-row')).toContainElement(checkbox('Kane'))
    // The leader is untouched.
    expect(checkbox('Messi').closest('.pg-scorer-row')).not.toHaveClass('pg-scorer-row--out')
  })

  test('an eliminated player who is still (co-)leading is NOT out of the race', () => {
    // Kane's team is out but he is level with the lead — he can still co-win.
    setup(['Messi', 'Kane'], { Messi: 6, Kane: 6 }, [], ['Kane'])
    expect(screen.queryByText('מחוץ למירוץ')).not.toBeInTheDocument()
  })

  test('nobody is marked out before any goals are scored', () => {
    setup(['Messi', 'Kane'], {}, [], ['Kane'])
    expect(screen.queryByText('מחוץ למירוץ')).not.toBeInTheDocument()
  })
})
