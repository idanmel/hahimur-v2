import { render, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
import Bracket from './Bracket'
import type { KnockoutStages } from './types'

const empty: KnockoutStages = { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] }
const withR32 = (m: KnockoutStages['r32'][number]): KnockoutStages => ({ ...empty, r32: [m] })

describe('interactive Bracket', () => {
  test('a resolved match exposes two enabled score inputs', () => {
    const stages = withR32({ matchNum: 73, home: 'Brazil', away: 'Korea Republic', resolved: true })
    render(<Bracket stages={stages} predictions={{}} onChange={() => {}} />)
    const inputs = [...document.querySelectorAll<HTMLInputElement>('input.score-input')]
    expect(inputs.length).toBe(2)
    expect(inputs.every(i => !i.disabled)).toBe(true)
  })

  test('an unresolved match disables its score inputs', () => {
    const stages = withR32({ matchNum: 73, home: 'מנצח א', away: 'מנצח ב', resolved: false })
    render(<Bracket stages={stages} predictions={{}} onChange={() => {}} />)
    const inputs = [...document.querySelectorAll<HTMLInputElement>('input.score-input')]
    expect(inputs.length).toBe(2)
    expect(inputs.every(i => i.disabled)).toBe(true)
  })

  test('typing a score reports the match number and the new scoreline', () => {
    const onChange = vi.fn()
    const stages = withR32({ matchNum: 73, home: 'Brazil', away: 'Korea Republic', resolved: true })
    render(<Bracket stages={stages} predictions={{ '73': { home: null, away: null } }} onChange={onChange} />)
    const inputs = document.querySelectorAll<HTMLInputElement>('input.score-input')
    fireEvent.change(inputs[0], { target: { value: '2' } })
    expect(onChange).toHaveBeenCalledWith('73', { home: 2, away: null })
  })

  test('picking a team on a level scoreline records the advancing side', () => {
    const onChange = vi.fn()
    const stages = withR32({ matchNum: 73, home: 'Brazil', away: 'Korea Republic', resolved: true })
    render(<Bracket stages={stages} predictions={{ '73': { home: 1, away: 1 } }} onChange={onChange} />)
    // The level scoreline makes both team slots selectable; click the home side.
    const homeTeam = document.querySelector<HTMLElement>('.bk-team--selectable')!
    fireEvent.click(homeTeam)
    expect(onChange).toHaveBeenCalledWith('73', { home: 1, away: 1, drawWinner: 'home' })
  })

  test('without onChange the cards stay read-only links (no inputs)', () => {
    const stages = withR32({ matchNum: 73, home: 'Brazil', away: 'Korea Republic', resolved: true })
    render(<Bracket stages={stages} />)
    expect(document.querySelectorAll('input.score-input').length).toBe(0)
    expect(document.querySelector('a[href="/matches/73"]')).not.toBeNull()
  })

  test('a read-only card shows the match date and kickoff time', () => {
    const stages = withR32({ matchNum: 73, home: 'Brazil', away: 'Korea Republic', resolved: true, matchDate: '28 ביוני', kickoffIST: '22:00' })
    const { container } = render(<Bracket stages={stages} />)
    const meta = container.querySelector('.bk-meta')!
    expect(meta.textContent).toContain('28 ביוני')
    expect(meta.textContent).toContain('22:00')
  })

  test('an editable card shows the match date and kickoff time', () => {
    const stages = withR32({ matchNum: 73, home: 'Brazil', away: 'Korea Republic', resolved: true, matchDate: '28 ביוני', kickoffIST: '22:00' })
    const { container } = render(<Bracket stages={stages} predictions={{}} onChange={() => {}} />)
    const meta = container.querySelector('.bk-meta')!
    expect(meta.textContent).toContain('28 ביוני')
    expect(meta.textContent).toContain('22:00')
  })

  test('marks a match the current user participates in', () => {
    const stages = withR32({ matchNum: 73, home: 'Brazil', away: 'Korea Republic', resolved: true })
    const { container } = render(
      <Bracket stages={stages} predictions={{}} onChange={() => {}} participatingMatchIds={new Set(['73'])} />,
    )
    expect(container.querySelector('.bk-match--mine')).not.toBeNull()
    expect(container.querySelector('.bk-mine')).not.toBeNull()
  })

  test('marks a participating match on a read-only card too', () => {
    const stages = withR32({ matchNum: 73, home: 'Brazil', away: 'Korea Republic', resolved: true })
    const { container } = render(<Bracket stages={stages} participatingMatchIds={new Set(['73'])} />)
    expect(container.querySelector('.bk-mine')).not.toBeNull()
  })

  test('no marker when the user does not participate in the match', () => {
    const stages = withR32({ matchNum: 73, home: 'Brazil', away: 'Korea Republic', resolved: true })
    const { container } = render(
      <Bracket stages={stages} predictions={{}} onChange={() => {}} participatingMatchIds={new Set()} />,
    )
    expect(container.querySelector('.bk-mine')).toBeNull()
  })
})
