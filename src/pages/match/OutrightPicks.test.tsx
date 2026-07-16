import { render, screen, within } from '@testing-library/react'
import OutrightPicks from './OutrightPicks'
import type { User } from '../../users/index'

// A user whose entire relevance here is their outright picks.
function makeUser(label: string, thirdPlace?: string, champion?: string): User {
  return { label, predictedThirdPlaceWinner: thirdPlace, predictedChampion: champion } as unknown as User
}

const thirdPick = (u: User) => u.predictedThirdPlaceWinner
const championPick = (u: User) => u.predictedChampion

const franceThird = makeUser('FF', 'France')
const englandThird = makeUser('EF', 'England')
const spainThird = makeUser('SF', 'Spain')
const noPick = makeUser('NP')

test('lists each bettor under the team they picked', () => {
  render(<OutrightPicks home="France" away="England" users={[franceThird, englandThird, spainThird]} pickOf={thirdPick} />)

  expect(within(screen.getByTestId('outright-picks-home')).getByText('FF')).toBeInTheDocument()
  expect(within(screen.getByTestId('outright-picks-away')).getByText('EF')).toBeInTheDocument()
})

test('a bettor who picked another team (or none) appears in neither list', () => {
  render(<OutrightPicks home="France" away="England" users={[franceThird, spainThird, noPick]} pickOf={thirdPick} />)

  const all = [screen.getByTestId('outright-picks-home'), screen.getByTestId('outright-picks-away')]
  for (const region of all) {
    expect(within(region).queryByText('SF')).not.toBeInTheDocument()
    expect(within(region).queryByText('NP')).not.toBeInTheDocument()
  }
})

test('shows each team in Hebrew with its pick count, even when nobody picked it', () => {
  render(<OutrightPicks home="France" away="England" users={[franceThird, spainThird]} pickOf={thirdPick} />)

  const home = screen.getByTestId('outright-picks-home')
  expect(within(home).getByText('צרפת')).toBeInTheDocument()
  expect(within(home).getByText('1')).toBeInTheDocument()

  // England got no picks — the list still renders, honestly showing 0.
  const away = screen.getByTestId('outright-picks-away')
  expect(within(away).getByText('אנגליה')).toBeInTheDocument()
  expect(within(away).getByText('0')).toBeInTheDocument()
})

test('reads whichever pick it is given — e.g. champion picks on the final', () => {
  const championFan = makeUser('CF', 'Spain', 'France')
  render(<OutrightPicks home="France" away="England" users={[championFan, franceThird]} pickOf={championPick} />)

  // CF picked Spain third but France as champion — with the champion accessor
  // they land under France; FF picked no champion, so they appear nowhere.
  const home = screen.getByTestId('outright-picks-home')
  expect(within(home).getByText('CF')).toBeInTheDocument()
  expect(within(home).queryByText('FF')).not.toBeInTheDocument()
})
