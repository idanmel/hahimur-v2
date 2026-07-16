import { render, screen, within } from '@testing-library/react'
import ThirdPlacePicks from './ThirdPlacePicks'
import type { User } from '../../users/index'

// A user whose entire relevance here is their third-place-winner pick.
function makeUser(label: string, pick?: string): User {
  return { label, predictedThirdPlaceWinner: pick } as unknown as User
}

const franceFan = makeUser('FF', 'France')
const englandFan = makeUser('EF', 'England')
const spainFan = makeUser('SF', 'Spain')
const noPick = makeUser('NP')

test('lists each bettor under the team they picked to finish third', () => {
  render(<ThirdPlacePicks home="France" away="England" users={[franceFan, englandFan, spainFan]} />)

  expect(within(screen.getByTestId('third-picks-home')).getByText('FF')).toBeInTheDocument()
  expect(within(screen.getByTestId('third-picks-away')).getByText('EF')).toBeInTheDocument()
})

test('a bettor who picked another team (or none) appears in neither list', () => {
  render(<ThirdPlacePicks home="France" away="England" users={[franceFan, spainFan, noPick]} />)

  const all = [screen.getByTestId('third-picks-home'), screen.getByTestId('third-picks-away')]
  for (const region of all) {
    expect(within(region).queryByText('SF')).not.toBeInTheDocument()
    expect(within(region).queryByText('NP')).not.toBeInTheDocument()
  }
})

test('shows each team in Hebrew with its pick count, even when nobody picked it', () => {
  render(<ThirdPlacePicks home="France" away="England" users={[franceFan, spainFan]} />)

  const home = screen.getByTestId('third-picks-home')
  expect(within(home).getByText('צרפת')).toBeInTheDocument()
  expect(within(home).getByText('1')).toBeInTheDocument()

  // England got no picks — the list still renders, honestly showing 0.
  const away = screen.getByTestId('third-picks-away')
  expect(within(away).getByText('אנגליה')).toBeInTheDocument()
  expect(within(away).getByText('0')).toBeInTheDocument()
})
