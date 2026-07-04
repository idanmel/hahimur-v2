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
const thirdCfg = ROUNDS.find(r => r.key === 'thirdPlace')!

test('prompts to pick a player when none is selected', () => {
  render(<CrossingsList user={undefined} users={[]} actualMatches={[km(73, 'Mexico', 'Canada')]} probByMatch={{}} probStatus="ready" />)
  expect(screen.getByText(/בחרו שחקן/)).toBeInTheDocument()
})

test('shows an empty state when there is no bracket yet', () => {
  const user = userWith([km(73, 'Brazil', 'Spain')])
  render(<CrossingsList user={user} users={[user]} actualMatches={[]} probByMatch={{}} probStatus="ready" />)
  expect(screen.getByText(/עוד אין הצלבות/)).toBeInTheDocument()
})

test('shows a broken crossing under "התפספסו" with what actually happened', () => {
  const actual = [km(73, 'Mexico', 'Canada')]      // a team the bettor didn't pick
  const user = userWith([km(73, 'Brazil', 'Spain')])
  render(<CrossingsList user={user} users={[user]} actualMatches={actual} probByMatch={{}} probStatus="ready" />)

  expect(screen.getByText('❌ לא יקרו')).toBeInTheDocument()
  expect(screen.getByTestId('crossing-card')).toBeInTheDocument()
  expect(screen.getByText(/בפועל/)).toBeInTheDocument()
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

test('clicking the chance explains what must happen for your own pick', () => {
  const actual = [km(75, 'Brazil', 'סגנית ו')] // Brazil locked in, the other side open
  const user = userWith([km(75, 'Brazil', 'Netherlands')])
  const probByMatch = { 75: { 'Brazil|Netherlands': 0.3 } }
  render(<CrossingsList user={user} users={[user]} actualMatches={actual} probByMatch={probByMatch} probStatus="ready" />)

  // panel hidden until you tap the percentage
  expect(screen.queryByTestId('crossing-calc')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /סיכוי שתצא/ }))

  const calc = within(screen.getByTestId('crossing-calc'))
  // it's about the bettor's own teams: one already in, the other with its requirement
  expect(calc.getByText(/כבר במשבצת/)).toBeInTheDocument()
  expect(calc.getByText(/צריכה להיות סגנית ו/)).toBeInTheDocument()
  // and the combined chance the pair actually meets
  expect(calc.getByText(/הסיכוי ששתיהן/)).toBeInTheDocument()
})

test('a simulation-certain (100%) crossing moves to "נעולות" with a "ודאי" badge', () => {
  const actual = [km(75, 'Brazil', 'סגנית ו')] // slot not formally filled yet
  const user = userWith([km(75, 'Brazil', 'Netherlands', { home: 2, away: 1 })])
  const probByMatch = { 75: { 'Brazil|Netherlands': 1 } } // the sim makes it inevitable
  render(<CrossingsList user={user} users={[user]} actualMatches={actual} probByMatch={probByMatch} probStatus="ready" />)

  // it's treated as closed, not as a live open chance
  expect(screen.getByText('✓ נעולות')).toBeInTheDocument()
  expect(screen.queryByText('⏳ עוד פתוחות')).not.toBeInTheDocument()
  // marked with the small "certain" badge, and shows the bet (away–home), no percentage
  expect(screen.getByText(/ודאי/)).toBeInTheDocument()
  expect(screen.getByText('1–2')).toBeInTheDocument()
  expect(screen.queryByText(/100%/)).not.toBeInTheDocument()
})

test('an all-but-certain open crossing never reads as 100%', () => {
  const actual = [km(75, 'Brazil', 'סגנית ו')]
  const user = userWith([km(75, 'Brazil', 'Netherlands')])
  const probByMatch = { 75: { 'Brazil|Netherlands': 0.999 } }
  render(<CrossingsList user={user} users={[user]} actualMatches={actual} probByMatch={probByMatch} probStatus="ready" />)
  // it's all but sealed, but it's not locked — so show 99%+, never 100%
  expect(screen.getByText('99%+')).toBeInTheDocument()
  expect(screen.queryByText(/100%/)).not.toBeInTheDocument()
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
  // ...but it does appear, in the merged "won't happen" section, for a full picture
  expect(screen.getByText('❌ לא יקרו')).toBeInTheDocument()
  expect(screen.getByTestId('crossing-card')).toBeInTheDocument()
  // and it explains *why* concretely: the team that can no longer reach the slot
  expect(screen.getByText(/הולנד כבר לא יכולה להגיע/)).toBeInTheDocument()
})

test('orders open crossings by chance, highest first', () => {
  const actual = [km(75, 'Brazil', 'סגנית ו'), km(79, 'Spain', 'שלישית א/ב/ג')]
  const user = userWith([km(75, 'Brazil', 'Netherlands'), km(79, 'Spain', 'Germany')])
  const probByMatch = { 75: { 'Brazil|Netherlands': 0.3 }, 79: { 'Germany|Spain': 0.8 } }
  render(<CrossingsList user={user} users={[user]} actualMatches={actual} probByMatch={probByMatch} probStatus="ready" />)

  const cards = screen.getAllByTestId('crossing-card')
  expect(within(cards[0]).getByText('80%')).toBeInTheDocument() // best chance leads
  expect(within(cards[1]).getByText('30%')).toBeInTheDocument()
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

test('switches to the "who predicted what" board and reveals predictors', () => {
  const actual = [
    km(73, 'Mexico', 'Canada'),    // determined
    km(75, 'Brazil', 'סגנית ו'),   // still open — not on the determined board
  ]
  const me = userWith([km(73, 'Mexico', 'Canada')], 'אני')
  const mate = userWith([km(73, 'Canada', 'Mexico')], 'דני')   // reversed, same pair
  const other = userWith([km(73, 'Brazil', 'Spain')], 'יוסי')  // different pair
  render(<CrossingsList user={me} users={[me, mate, other]} actualMatches={actual} probByMatch={{}} probStatus="ready" />)

  // default view is the viewer's own crossings; the determined board is hidden
  expect(screen.queryByTestId('determined-card')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('tab', { name: /מי ניחש/ }))

  // only the determined pairing shows up (the open one is excluded)
  const cards = screen.getAllByTestId('determined-card')
  expect(cards).toHaveLength(1)
  const card = within(cards[0])
  // 2 of the players called Mexico×Canada; names hidden until tapped
  const toggle = card.getByRole('button', { name: /2/ })
  expect(card.queryByText('דני')).not.toBeInTheDocument()
  fireEvent.click(toggle)
  expect(card.getByText('דני')).toBeInTheDocument()
  expect(card.getByText(/אני/)).toBeInTheDocument()
})

test('shows the live-teams board on the "who predicted what" view, ranked with me highlighted', () => {
  const me = userWith([km(73, 'Mexico', 'Canada')], 'אני')
  const other = userWith([km(73, 'Brazil', 'Spain')], 'יוסי')
  const liveStages = [
    {
      key: 'r32' as const, label: 'שלב 32', standings: [
        { label: 'אני', alive: 9, reachable: 9, total: 12, aliveTeams: ['Mexico', 'Canada'], outTeams: ['Brazil'], collisions: [] },
        { label: 'יוסי', alive: 5, reachable: 5, total: 12, aliveTeams: ['Spain'], outTeams: [], collisions: [] },
      ],
    },
  ]
  render(
    <CrossingsList
      user={me} users={[me, other]} actualMatches={[km(73, 'Mexico', 'Canada')]}
      probByMatch={{}} probStatus="ready" liveStages={liveStages}
    />,
  )

  // hidden on the personal view; appears once you switch to "who predicted what"
  expect(screen.queryByText('🛡️ קבוצות חיות')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('tab', { name: /מי ניחש/ }))

  const board = within(screen.getByRole('region', { name: 'קבוצות חיות' }))
  expect(board.getByText('🛡️ קבוצות חיות')).toBeInTheDocument()
  // the viewer's own row is flagged
  expect(board.getByText('אתה')).toBeInTheDocument()
  // tapping a row reveals the actual teams (alive + eliminated), with section headers
  fireEvent.click(board.getByRole('button', { name: /אני/ }))
  expect(board.getByText(/עדיין חיות \(/)).toBeInTheDocument()
  expect(board.getByText(/הודחו \(/)).toBeInTheDocument()
})

test('live-teams board gives tied players the same rank/medal, not one above the other', () => {
  const a = userWith([km(73, 'Mexico', 'Canada')], 'טל')
  const b = userWith([km(73, 'Brazil', 'Spain')], 'מאור')
  const c = userWith([km(73, 'France', 'England')], 'דנה')
  const liveStages = [
    {
      key: 'r32' as const, label: 'שלב 32', standings: [
        { label: 'טל', alive: 31, reachable: 31, total: 32, aliveTeams: ['Mexico'], outTeams: [], collisions: [] },
        { label: 'מאור', alive: 31, reachable: 31, total: 32, aliveTeams: ['Brazil'], outTeams: [], collisions: [] },
        { label: 'דנה', alive: 28, reachable: 28, total: 32, aliveTeams: ['France'], outTeams: [], collisions: [] },
      ],
    },
  ]
  render(
    <CrossingsList
      user={a} users={[a, b, c]} actualMatches={[km(73, 'Mexico', 'Canada')]}
      probByMatch={{}} probStatus="ready" liveStages={liveStages}
    />,
  )
  fireEvent.click(screen.getByRole('tab', { name: /מי ניחש/ }))
  const board = within(screen.getByRole('region', { name: 'קבוצות חיות' }))

  // both 31-team players share gold; the lone 28 reads its shared placing (3rd),
  // and no misleading silver/bronze medals appear on a clustered metric
  expect(board.getAllByText('🥇')).toHaveLength(2)
  expect(board.queryByText('🥈')).not.toBeInTheDocument()
  expect(board.queryByText('🥉')).not.toBeInTheDocument()
  expect(board.getByText('3')).toBeInTheDocument()
})

test('live-teams board references each player to the selected stage (final = X/2, plus champion & 3rd-place)', () => {
  const me = userWith([km(73, 'Mexico', 'Canada')], 'אני')
  const liveStages = [
    { key: 'r32' as const, label: 'שלב 32', standings: [{ label: 'אני', alive: 30, reachable: 30, total: 32, aliveTeams: ['Mexico'], outTeams: [], collisions: [] }] },
    { key: 'final' as const, label: 'גמר', standings: [{ label: 'אני', alive: 2, reachable: 2, total: 2, aliveTeams: ['France', 'England'], outTeams: [], collisions: [] }] },
    { key: 'thirdPlace' as const, label: 'מקום 3-4', standings: [{ label: 'אני', alive: 1, reachable: 1, total: 2, aliveTeams: ['Brazil'], outTeams: ['Spain'], collisions: [] }] },
    { key: 'champion' as const, label: 'אלופה', standings: [{ label: 'אני', alive: 1, reachable: 1, total: 1, aliveTeams: ['France'], outTeams: [], collisions: [] }] },
  ]
  render(
    <CrossingsList
      user={me} users={[me]} actualMatches={[]}
      probByMatch={{}} probStatus="ready" liveStages={liveStages}
    />,
  )
  fireEvent.click(screen.getByRole('tab', { name: /מי ניחש/ }))
  const board = within(screen.getByRole('region', { name: 'קבוצות חיות' }))

  // defaults to the round tab's stage (round of 32) → 30 out of 32
  expect(board.getByText('30/32')).toBeInTheDocument()
  // champion and the 3rd-place match get their own chips (no crossing tab exists)
  expect(board.getByRole('tab', { name: 'אלופה' })).toBeInTheDocument()
  expect(board.getByRole('tab', { name: 'מקום 3-4' })).toBeInTheDocument()
  // switching to the final references the 2 finalists → 2 out of 2
  fireEvent.click(board.getByRole('tab', { name: 'גמר' }))
  expect(board.getByText('2/2')).toBeInTheDocument()
  expect(board.queryByText('30/32')).not.toBeInTheDocument()
})

test('live-teams board flags picks that collide before the stage and ranks them below a clean bracket', () => {
  const me = userWith([km(73, 'Mexico', 'Canada')], 'אני')
  const clash = userWith([km(73, 'France', 'Brazil')], 'מתנגש')
  const clean = userWith([km(73, 'Spain', 'Italy')], 'נקי')
  // 'מתנגש' has both finalists alive but they meet in R32 → at most one arrives;
  // 'נקי' has one clean finalist. Reachable (1 vs 1) ties, but the clash is flagged.
  const liveStages = [
    { key: 'r32' as const, label: 'שלב 32', standings: [
      { label: 'מתנגש', alive: 2, reachable: 1, total: 2, aliveTeams: ['France', 'England'], outTeams: [], collisions: [{ teams: ['France', 'England'], roundLabel: 'שלב 32' }] },
      { label: 'נקי', alive: 1, reachable: 1, total: 1, aliveTeams: ['Spain'], outTeams: [], collisions: [] },
    ] },
  ]
  render(
    <CrossingsList
      user={me} users={[me, clash, clean]} actualMatches={[km(73, 'Mexico', 'Canada')]}
      probByMatch={{}} probStatus="ready" liveStages={liveStages}
    />,
  )
  fireEvent.click(screen.getByRole('tab', { name: /מי ניחש/ }))
  const board = within(screen.getByRole('region', { name: 'קבוצות חיות' }))

  // the row shows the clash count and a "up to N will arrive" hint
  expect(board.getByText(/נפגשות/)).toBeInTheDocument()
  expect(board.getByText(/עד 1 יגיעו/)).toBeInTheDocument()
  // expanding spells out which teams meet and where
  fireEvent.click(board.getByRole('button', { name: /מתנגש/ }))
  expect(board.getByText('⚠️ נפגשות בדרך')).toBeInTheDocument()
  expect(board.getByText(/נפגשות בשלב 32/)).toBeInTheDocument()
})

test('the "who\'ll hit the most" standing counts a 100%-certain matchup as locked, not open', () => {
  const actual = [km(75, 'Brazil', 'סגנית ו')]   // slot still a placeholder
  const bettor = userWith([km(75, 'Brazil', 'Netherlands')], 'דני')
  const probByMatch = { 75: { 'Brazil|Netherlands': 1 } } // the sim makes it inevitable
  render(<CrossingsList user={bettor} users={[bettor]} actualMatches={actual} probByMatch={probByMatch} probStatus="ready" />)

  // closed like the rest: it lands in the locked tally, not the open one
  expect(screen.getByText('1 נעולות · 0 פתוחות · 0 אזלו')).toBeInTheDocument()
})

test('the "who predicted what" board shows a 100%-certain matchup as a closed match', () => {
  const actual = [km(75, 'Brazil', 'סגנית ו')]   // slot still a placeholder on the bracket
  const me = userWith([km(75, 'Brazil', 'Netherlands')], 'אני')
  const probByMatch = { 75: { 'Brazil|Netherlands': 1 } } // the sim makes it inevitable
  render(<CrossingsList user={me} users={[me]} actualMatches={actual} probByMatch={probByMatch} probStatus="ready" />)

  fireEvent.click(screen.getByRole('tab', { name: /מי ניחש/ }))
  const cards = screen.getAllByTestId('determined-card')
  expect(cards).toHaveLength(1)
  // marked as a closed-but-not-formally-filled matchup
  expect(within(cards[0]).getByText(/ודאי/)).toBeInTheDocument()
})

test('shows a played crossing as a finished result card: real score, advancer, outcome + points', () => {
  const actual = [km(73, 'Mexico', 'Canada')]
  const user = userWith([km(73, 'Mexico', 'Canada', { home: 3, away: 1 })]) // called Mexico 3-1
  const actualScoreByNum = { 73: { home: 2, away: 1 } }                      // real Mexico 2-1
  render(
    <CrossingsList
      user={user} users={[user]} actualMatches={actual}
      actualScoreByNum={actualScoreByNum} probByMatch={{}} probStatus="ready"
    />,
  )

  // finished matches load collapsed — the header shows the count, cards are hidden
  const header = screen.getByRole('button', { name: /🏁 הסתיימו \(1\)/ })
  expect(header).toBeInTheDocument()
  expect(screen.queryByTestId('finished-card')).not.toBeInTheDocument()

  // tapping the header reveals the full result card
  fireEvent.click(header)
  const card = within(screen.getByTestId('finished-card'))
  expect(card.getByText('1–2')).toBeInTheDocument()        // real result, away–home
  expect(card.getByText('1–3')).toBeInTheDocument()        // the bettor's bet, away–home
  expect(card.getByText('פגיעה · +5')).toBeInTheDocument() // right winner, wrong score
  expect(card.getByText(/עלתה/)).toBeInTheDocument()       // Mexico advanced
  // a finished match isn't duplicated as a plain locked card
  expect(screen.queryByText('✓ נעולות')).not.toBeInTheDocument()
  expect(screen.queryByTestId('crossing-card')).not.toBeInTheDocument()
})

test('the "who predicted what" board shows a single advanced team as a partial slot', () => {
  const actual = [
    km(73, 'Mexico', 'Canada'),    // fully determined pairing
    km(75, 'Brazil', 'סגנית ו'),   // one team advanced, opponent still open -> partial
  ]
  const me = userWith([km(73, 'Mexico', 'Canada'), km(75, 'Brazil', 'Netherlands')], 'אני')
  render(<CrossingsList user={me} users={[me]} actualMatches={actual} probByMatch={{}} probStatus="ready" />)
  fireEvent.click(screen.getByRole('tab', { name: /מי ניחש/ }))

  // the determined pairing stays a determined card...
  expect(screen.getAllByTestId('determined-card')).toHaveLength(1)
  // ...and the half-open slot shows the team that already advanced, in its own group
  expect(screen.getByText('➡️ קבוצה אחת כבר עלתה')).toBeInTheDocument()
  const partial = within(screen.getByTestId('partial-card'))
  expect(partial.getByText('טרם נקבע')).toBeInTheDocument()
  expect(partial.getByText('עלתה ✓')).toBeInTheDocument()  // Brazil advanced
  expect(partial.getByText('ברזיל')).toBeInTheDocument()
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

test('a fully-played round reads as a final result, not a projection', () => {
  // The third-place round is a single slot (103); once it has a real score the whole
  // round is settled, so the standing should read "who hit" rather than "who will".
  const actual = [km(103, 'Brazil', 'France')]
  const user = userOnRound('thirdPlace', [km(103, 'Brazil', 'France', { home: 2, away: 1 })], 'דני')
  const actualScoreByNum = { 103: { home: 2, away: 1 } }
  render(
    <CrossingsList
      user={user} users={[user]} round={thirdCfg} actualMatches={actual}
      actualScoreByNum={actualScoreByNum} probByMatch={{}} probStatus="ready"
    />,
  )
  // past-tense headline + a "round finished" chip, and none of the projection wording
  expect(screen.getByText(/מי פגע בהכי הרבה מפגשים/)).toBeInTheDocument()
  expect(screen.getByText('השלב הסתיים')).toBeInTheDocument()
  expect(screen.queryByText(/מי יפגע בהכי הרבה/)).not.toBeInTheDocument()
  // the value column reads as final hits, not an expected projection
  expect(screen.getByText('נפגעו')).toBeInTheDocument()
})

test('offers a third-place tab and reads its predictions with the third-place payouts', () => {
  // the match on 3rd place (103) is its own crossing round, between the final and the semis
  expect(thirdCfg).toBeDefined()
  const actual = [km(103, 'Brazil', 'France')]
  const user = userOnRound('thirdPlace', [km(103, 'Brazil', 'France')])
  render(<CrossingsList user={user} users={[user]} round={thirdCfg} actualMatches={actual} probByMatch={{}} probStatus="ready" />)
  expect(screen.getByText('✓ נעולות')).toBeInTheDocument()
  // scored with the third-place payouts (16 / 20), read from points.ts ROUND_POINTS.third
  expect(screen.getByText(/פגיעה בתוצאה 16/)).toBeInTheDocument()
  expect(screen.getByText(/צליפה מדויקת 20/)).toBeInTheDocument()
})

test('offers a summary tab that switches to the summary board on click', () => {
  const user = userWith([km(73, 'Mexico', 'Canada')])
  const onRoundChange = vi.fn()
  render(
    <CrossingsList
      user={user} users={[user]} actualMatches={[km(73, 'Mexico', 'Canada')]}
      probByMatch={{}} probStatus="ready" onRoundChange={onRoundChange}
    />,
  )
  fireEvent.click(screen.getByRole('tab', { name: 'סיכום' }))
  expect(onRoundChange).toHaveBeenCalledWith('summary')
})

// totals fold to played 2 · guaranteed 3 · possible 4
const summaryStub = [
  {
    label: 'אני שחקן',
    byStage: [
      { key: 'r32' as const, played: 2, guaranteed: 1, possible: 0 },
      { key: 'sf' as const, played: 0, guaranteed: 2, possible: 4 },
    ],
  },
]

test('the summary board shows each player played / guaranteed / possible crossings', () => {
  const user = userWith([km(73, 'Mexico', 'Canada')])
  render(
    <CrossingsList
      user={user} users={[user]} actualMatches={[]} probByMatch={{}} probStatus="ready"
      onRoundChange={vi.fn()} activeKey="summary" summaryStandings={summaryStub}
    />,
  )
  const board = within(screen.getByRole('region', { name: /סיכום/ }))
  // the three bucket labels appear (headline word + the legend that decodes it)
  expect(board.getAllByText(/כבר שוחקו/).length).toBeGreaterThan(0)
  expect(board.getAllByText(/מובטחות/).length).toBeGreaterThan(0)
  expect(board.getAllByText(/עוד אפשריות/).length).toBeGreaterThan(0)
  expect(board.getByText('2')).toBeInTheDocument()
  expect(board.getByText('3')).toBeInTheDocument()
  expect(board.getByText('4')).toBeInTheDocument()
  // the per-round content is not shown in summary mode
  expect(screen.queryByText(/מי יפגע בהכי הרבה/)).not.toBeInTheDocument()
})

test('clicking a summary row reveals the per-stage breakdown', () => {
  const user = userWith([km(73, 'Mexico', 'Canada')])
  render(
    <CrossingsList
      user={user} users={[user]} actualMatches={[]} probByMatch={{}} probStatus="ready"
      onRoundChange={vi.fn()} activeKey="summary" summaryStandings={summaryStub}
    />,
  )
  // scope to the board — the stage names double as round-tab labels outside it
  const board = within(screen.getByRole('region', { name: /סיכום/ }))
  // the stage split is hidden until the row is tapped
  expect(board.queryByText('שלב 32')).not.toBeInTheDocument()
  fireEvent.click(board.getByRole('button', { name: /אני שחקן/ }))
  // both stages the player is involved in show up, named
  expect(board.getByText('שלב 32')).toBeInTheDocument()
  expect(board.getByText('חצי גמר')).toBeInTheDocument()
})

test('standing row accounts for every match: locked + open + gone', () => {
  const actual = [
    km(73, 'Mexico', 'Canada'),    // both in -> locked
    km(75, 'Brazil', 'סגנית ו'),   // half open -> potential
    km(79, 'Spain', 'Germany'),    // a pair the bettor didn't call -> missed
  ]
  const bettor = userWith([
    km(73, 'Mexico', 'Canada'),
    km(75, 'Brazil', 'Netherlands'),
    km(79, 'France', 'Portugal'),
  ], 'דני')
  const probByMatch = { 75: { 'Brazil|Netherlands': 0.5 } }
  render(<CrossingsList user={bettor} users={[bettor]} actualMatches={actual} probByMatch={probByMatch} probStatus="ready" />)

  // the row's breakdown lists all three buckets, which sum to the 3 matches
  expect(screen.getByText('1 נעולות · 1 פתוחות · 1 אזלו')).toBeInTheDocument()
  // and the expanded detail surfaces the broken one too
  fireEvent.click(screen.getByRole('button', { name: /דני/ }))
  expect(screen.getByText(/לא יקרו \(1\)/)).toBeInTheDocument()
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
