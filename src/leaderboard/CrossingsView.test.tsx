import { render, screen, fireEvent, within } from '@testing-library/react'
import { CrossingsList, ROUNDS } from './CrossingsView'
import type { KnockoutMatch } from '../shared/types'
import type { User } from '../users'

const km = (matchNum: number, home: string, away: string, scores?: { home: number; away: number }): KnockoutMatch => ({
  matchNum,
  home,
  away,
  resolved: false,
  ...(scores ? { scores } : {}),
})

// Minimal User stub — the list only reads label + knockoutStages[round].
function userWith(r32: KnockoutMatch[], label = 'אני שחקן'): User {
  return { label, knockoutStages: { r32, r16: [], qf: [], sf: [], thirdPlace: [], final: [] } } as unknown as User
}

// Same, but seeded on an arbitrary round so we can drive the stage tabs.
function userOnRound(roundKey: string, matches: KnockoutMatch[], label = 'אני שחקן'): User {
  const stages = { r32: [], r16: [], qf: [], sf: [], thirdPlace: [], final: [] } as Record<string, KnockoutMatch[]>
  stages[roundKey] = matches
  return { label, knockoutStages: stages } as unknown as User
}

const r16Cfg = ROUNDS.find(r => r.key === 'r16')!

test('prompts to pick a player when none is selected', () => {
  render(<CrossingsList user={undefined} users={[]} actualMatches={[km(73, 'Mexico', 'Canada')]} probByMatch={{}} probStatus="ready" />)
  expect(screen.getByText(/בחרו שחקן/)).toBeInTheDocument()
})

test('shows an empty state when the bettor has no live crossings', () => {
  const actual = [km(73, 'Mexico', 'Canada')]
  const user = userWith([km(73, 'Brazil', 'Spain')])
  render(<CrossingsList user={user} users={[user]} actualMatches={actual} probByMatch={{}} probStatus="ready" />)
  expect(screen.getByText(/עוד אין הצלבות/)).toBeInTheDocument()
})

test('renders locked and potential crossings with their counts', () => {
  const actual = [
    km(73, 'Mexico', 'Canada'),     // both in -> locked
    km(75, 'Brazil', 'סגנית ו'),    // half open -> potential
  ]
  const user = userWith([
    km(73, 'Mexico', 'Canada'),
    km(75, 'Brazil', 'Netherlands'),
  ])
  render(<CrossingsList user={user} users={[user]} actualMatches={actual} probByMatch={{}} probStatus="ready" />)

  expect(screen.getByText('✓ נעולות')).toBeInTheDocument()
  expect(screen.getByText('⏳ עוד פתוחות')).toBeInTheDocument()
  expect(screen.getAllByTestId('crossing-card')).toHaveLength(2)
  expect(screen.getByText(/סגנית ו/)).toBeInTheDocument()
})

test('shows the bettor predicted scoreline on a locked crossing', () => {
  const actual = [km(73, 'Mexico', 'Canada')]
  const user = userWith([km(73, 'Mexico', 'Canada', { home: 1, away: 2 })])
  render(<CrossingsList user={user} users={[user]} actualMatches={actual} probByMatch={{}} probStatus="ready" />)
  // away–home orientation, matching the app-wide score format
  expect(screen.getByText('2–1')).toBeInTheDocument()
})

test('shows the simulated chance on an open crossing', () => {
  const actual = [km(75, 'Brazil', 'סגנית ו')]
  const user = userWith([km(75, 'Brazil', 'Netherlands')])
  const probByMatch = { 75: { 'Brazil|Netherlands': 0.42 } }
  render(<CrossingsList user={user} users={[user]} actualMatches={actual} probByMatch={probByMatch} probStatus="ready" />)
  expect(screen.getByText('42%')).toBeInTheDocument()
})

test('reads the chance regardless of team order', () => {
  const actual = [km(75, 'Brazil', 'סגנית ו')]
  const user = userWith([km(75, 'Netherlands', 'Brazil')])
  const probByMatch = { 75: { 'Brazil|Netherlands': 0.3 } }
  render(<CrossingsList user={user} users={[user]} actualMatches={actual} probByMatch={probByMatch} probStatus="ready" />)
  expect(screen.getByText('30%')).toBeInTheDocument()
})

test('counts and reveals other bettors who called the same crossing', () => {
  const actual = [km(73, 'Mexico', 'Canada')]
  const me = userWith([km(73, 'Mexico', 'Canada')], 'אני')
  const mate1 = userWith([km(73, 'Canada', 'Mexico')], 'דני') // reversed order, same pair
  const mate2 = userWith([km(73, 'Mexico', 'Canada')], 'רוני')
  const other = userWith([km(73, 'Brazil', 'Spain')], 'יוסי') // different pair
  render(<CrossingsList user={me} users={[me, mate1, mate2, other]} actualMatches={actual} probByMatch={{}} probStatus="ready" />)

  // Scope to the crossing card (names also appear in the standing below).
  const card = within(screen.getByTestId('crossing-card'))
  const toggle = card.getByText(/עוד 2 ניחשו כמוך/)
  expect(toggle).toBeInTheDocument()
  // names hidden until clicked
  expect(card.queryByText('דני')).not.toBeInTheDocument()
  fireEvent.click(toggle)
  expect(card.getByText('דני')).toBeInTheDocument()
  expect(card.getByText('רוני')).toBeInTheDocument()
})

test('renders the crossings standing ranked by expected hits', () => {
  const actual = [
    km(73, 'Mexico', 'Canada'),   // locked for whoever called it
    km(75, 'Brazil', 'סגנית ו'),  // open
  ]
  const leader = userWith([km(73, 'Mexico', 'Canada'), km(75, 'Brazil', 'Netherlands')], 'המוביל')
  const second = userWith([km(73, 'Mexico', 'Canada')], 'השני')
  const probByMatch = { 75: { 'Brazil|Netherlands': 0.5 } }
  render(<CrossingsList user={leader} users={[leader, second]} actualMatches={actual} probByMatch={probByMatch} probStatus="ready" />)

  expect(screen.getByText(/מי יפגע בהכי הרבה הצלבות/)).toBeInTheDocument()
  // leader: 1 locked + 0.5 open = 1.5 ; second: 1 locked = 1.0
  expect(screen.getByText('1.5')).toBeInTheDocument()
  expect(screen.getByText('1.0')).toBeInTheDocument()
})

test('groups a ruled-out crossing (0%) in its own section, not under open', () => {
  const actual = [km(75, 'Brazil', 'סגנית ו')]   // half-open -> potential
  const user = userWith([km(75, 'Brazil', 'Netherlands')])
  const probByMatch = { 75: { 'Brazil|Netherlands': 0 } } // simulated, never happens
  render(<CrossingsList user={user} users={[user]} actualMatches={actual} probByMatch={probByMatch} probStatus="ready" />)

  // it's not presented as a live open chance...
  expect(screen.queryByText('⏳ עוד פתוחות')).not.toBeInTheDocument()
  // ...but it does appear, in a dedicated "ruled out" section, for a full picture
  expect(screen.getByText('❌ כבר לא ריאליות')).toBeInTheDocument()
  expect(screen.getByTestId('crossing-card')).toBeInTheDocument()
  expect(screen.getByText(/אין סיכוי שייפגשו/)).toBeInTheDocument()
})

test('renders the stage tabs and switches round on click', () => {
  const user = userWith([km(73, 'Mexico', 'Canada')])
  const onRoundChange = vi.fn()
  render(
    <CrossingsList
      user={user} users={[user]} actualMatches={[km(73, 'Mexico', 'Canada')]}
      probByMatch={{}} probStatus="ready" onRoundChange={onRoundChange}
    />,
  )
  // all five knockout stages are offered
  for (const r of ROUNDS) expect(screen.getByRole('tab', { name: r.tab })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('tab', { name: 'שמינית' }))
  expect(onRoundChange).toHaveBeenCalledWith('r16')
})

test('reads the bettor predictions for the selected round', () => {
  // a locked round-of-16 matchup, scored with the R16 payouts in the note
  const actual = [km(89, 'Brazil', 'France')]
  const user = userOnRound('r16', [km(89, 'Brazil', 'France')])
  render(<CrossingsList user={user} users={[user]} round={r16Cfg} actualMatches={actual} probByMatch={{}} probStatus="ready" />)
  expect(screen.getByText('✓ נעולות')).toBeInTheDocument()
  expect(screen.getByText(/ניקוד השמינית/)).toBeInTheDocument()
  expect(screen.getByText(/מי יפגע בהכי הרבה מפגשים/)).toBeInTheDocument()
})

test('expands a standing row to reveal that bettor pairs and chances', () => {
  const actual = [km(73, 'Mexico', 'Canada'), km(75, 'Brazil', 'סגנית ו')]
  const leader = userWith([km(73, 'Mexico', 'Canada'), km(75, 'Brazil', 'Netherlands')], 'המוביל')
  const probByMatch = { 75: { 'Brazil|Netherlands': 0.5 } }
  render(<CrossingsList user={leader} users={[leader]} actualMatches={actual} probByMatch={probByMatch} probStatus="ready" />)

  // the per-bettor breakdown (the "ודאי" tag) is hidden until you tap the name
  expect(screen.queryByText('ודאי')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /המוביל/ }))
  expect(screen.getByText('ודאי')).toBeInTheDocument()
  expect(screen.getByText(/פתוחות \(1\)/)).toBeInTheDocument()
})
