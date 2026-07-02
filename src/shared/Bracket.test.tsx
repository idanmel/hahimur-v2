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

  test('a live match shows a חי badge with the minute in place of the kickoff time', () => {
    const stages = withR32({ matchNum: 73, home: 'Brazil', away: 'Korea Republic', resolved: true, matchDate: '28 ביוני', kickoffIST: '22:00' })
    const { container } = render(
      <Bracket stages={stages} predictions={{ '73': { home: 1, away: 0 } }} onChange={() => {}} liveMatches={{ '73': { clock: "67'" } }} />,
    )
    const live = container.querySelector('[data-testid="bk-live"]')!
    expect(live.textContent).toContain('חי')
    expect(live.textContent).toContain("67'")
    // The live badge stands in for the kickoff schedule line.
    expect(container.querySelector('.bk-meta')!.textContent).not.toContain('22:00')
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

  test('shows the predicted score as one gold digit per team, home then away', () => {
    const stages = withR32({ matchNum: 73, home: 'Brazil', away: 'Korea Republic', resolved: true })
    const { container } = render(
      <Bracket
        stages={stages}
        predictions={{}}
        onChange={() => {}}
        participatingMatchIds={new Set(['73'])}
        participatingPredictions={{ '73': { home: 2, away: 1 } }}
      />,
    )
    const digits = container.querySelectorAll('.bk-pred')
    expect(digits.length).toBe(2)
    expect(digits[0].textContent).toBe('2') // home row
    expect(digits[1].textContent).toBe('1') // away row
  })

  test('shows the predicted digits on a read-only participating card too', () => {
    const stages = withR32({ matchNum: 73, home: 'Brazil', away: 'Korea Republic', resolved: true })
    const { container } = render(
      <Bracket
        stages={stages}
        participatingMatchIds={new Set(['73'])}
        participatingPredictions={{ '73': { home: 0, away: 3 } }}
      />,
    )
    const digits = container.querySelectorAll('.bk-pred')
    expect(digits.length).toBe(2)
    expect(digits[0].textContent).toBe('0')
    expect(digits[1].textContent).toBe('3')
  })

  test('marks the advancing side on the team row when the participant predicted a level scoreline', () => {
    const stages = withR32({ matchNum: 73, home: 'Brazil', away: 'Korea Republic', resolved: true })
    const { container } = render(
      <Bracket
        stages={stages}
        participatingMatchIds={new Set(['73'])}
        participatingPredictions={{ '73': { home: 1, away: 1, drawWinner: 'away' } }}
      />,
    )
    const digits = container.querySelectorAll('.bk-pred')
    expect(digits[0].classList.contains('bk-pred--adv')).toBe(false) // home: not advancing
    expect(digits[1].classList.contains('bk-pred--adv')).toBe(true)  // away: advances
  })

  test('no predicted digits when the participant left the score blank', () => {
    const stages = withR32({ matchNum: 73, home: 'Brazil', away: 'Korea Republic', resolved: true })
    const { container } = render(
      <Bracket
        stages={stages}
        participatingMatchIds={new Set(['73'])}
        participatingPredictions={{ '73': { home: null, away: null } }}
      />,
    )
    expect(container.querySelector('.bk-pred')).toBeNull()
  })
})

describe('by-date view', () => {
  // Fixtures spanning rounds and dates, deliberately out of chronological
  // order within their rounds, so the sort is actually exercised.
  const stages: KnockoutStages = {
    r32: [
      { matchNum: 77, home: 'France', away: 'Senegal', resolved: true, matchDate: '1 ביולי', kickoffIST: '00:00' },
      { matchNum: 73, home: 'Brazil', away: 'Korea Republic', resolved: true, matchDate: '28 ביוני', kickoffIST: '22:00' },
    ],
    r16: [{ matchNum: 89, home: 'מנצח 74', away: 'מנצח 77', resolved: false, matchDate: '4 ביולי', kickoffIST: '23:00' }],
    qf: [],
    sf: [],
    thirdPlace: [{ matchNum: 103, home: 'מפסיד 101', away: 'מפסיד 102', resolved: false, matchDate: '18 ביולי', kickoffIST: '23:00' }],
    final: [{ matchNum: 104, home: 'מנצח 101', away: 'מנצח 102', resolved: false, matchDate: '19 ביולי', kickoffIST: '22:00' }],
  }

  test('lists all knockout matches chronologically under date bands', () => {
    const { container } = render(<Bracket stages={stages} view="byDate" />)
    const bands = [...container.querySelectorAll('.bk-date-band__date')].map(b => b.textContent)
    expect(bands).toEqual(['28 ביוני', '1 ביולי', '4 ביולי', '18 ביולי', '19 ביולי'])
    const cards = [...container.querySelectorAll('a.bk-match')].map(a => a.getAttribute('href'))
    expect(cards).toEqual(['/matches/73', '/matches/77', '/matches/89', '/matches/103', '/matches/104'])
  })

  test('names the round on each card', () => {
    const { container } = render(<Bracket stages={stages} view="byDate" />)
    const metas = [...container.querySelectorAll('.bk-meta')].map(m => m.textContent)
    expect(metas[0]).toContain('שלב ה-32')
    expect(metas[2]).toContain('שמינית גמר')
    expect(metas[3]).toContain('מקום שלישי')
    expect(metas[4]).toContain('גמר')
  })

  test('the date band carries the date, so the card meta shows only the kickoff time', () => {
    const { container } = render(<Bracket stages={stages} view="byDate" />)
    const meta = container.querySelector('.bk-meta')!
    expect(meta.textContent).toContain('22:00')
    expect(meta.textContent).not.toContain('28 ביוני')
  })

  test('stays editable: score inputs render and report changes', () => {
    const onChange = vi.fn()
    render(<Bracket stages={stages} view="byDate" predictions={{}} onChange={onChange} />)
    const inputs = [...document.querySelectorAll<HTMLInputElement>('input.score-input')]
    expect(inputs.length).toBe(10) // five matches, two inputs each
    fireEvent.change(inputs[0], { target: { value: '3' } })
    expect(onChange).toHaveBeenCalledWith('73', { home: 3, away: null })
  })
})
