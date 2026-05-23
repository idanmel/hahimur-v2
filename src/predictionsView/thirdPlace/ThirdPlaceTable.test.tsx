import { render, screen } from '@testing-library/react'
import ThirdPlaceTable from './ThirdPlaceTable'
import type { ThirdPlaceStanding, ThirdPlaceQualification } from '../../shared/types'

function t(team: string, group: string, points: number, gf = 0, ga = 0): ThirdPlaceStanding {
  return { team, group, points, played: 3, won: 0, drawn: 0, lost: 0, goalsFor: gf, goalsAgainst: ga }
}

const ALL_TWELVE: ThirdPlaceStanding[] = [
  t('South Korea',  'A', 9,  5, 1),
  t('Qatar',        'B', 7,  4, 2),
  t('Haiti',        'C', 6,  3, 2),
  t('Australia',    'D', 6,  3, 3),
  t('Ivory Coast',  'E', 5,  2, 2),
  t('Sweden',       'F', 4,  2, 3),
  t('Iran',         'G', 4,  1, 2),
  t('Saudi Arabia', 'H', 3,  2, 4),
  t('Iraq',         'I', 2,  1, 3),
  t('Algeria',      'J', 1,  1, 4),
  t('Uzbekistan',   'K', 1,  0, 3),
  t('Ghana',        'L', 0,  0, 5),
]

const QUALIFIERS = ALL_TWELVE.slice(0, 8)

const RESOLVED_QUAL: ThirdPlaceQualification = {
  resolved: true,
  all: ALL_TWELVE,
  qualifiers: QUALIFIERS,
}

test('renders all 12 teams', () => {
  render(<ThirdPlaceTable qualification={RESOLVED_QUAL} allGroupsFilled={true} />)
  expect(screen.getByText('דרום קוריאה')).toBeInTheDocument()
  expect(screen.getByText('גאנה')).toBeInTheDocument()
})

test('marks exactly 8 rows as qualifying', () => {
  render(<ThirdPlaceTable qualification={RESOLVED_QUAL} allGroupsFilled={true} />)
  const qualifyingRows = document.querySelectorAll('tr.row-qualifies')
  expect(qualifyingRows).toHaveLength(8)
})

test('8th-place row has cutoff class', () => {
  render(<ThirdPlaceTable qualification={RESOLVED_QUAL} allGroupsFilled={true} />)
  const cutoffRows = document.querySelectorAll('tr.row-cutoff')
  expect(cutoffRows).toHaveLength(1)
})

test('shows group letter for each team', () => {
  render(<ThirdPlaceTable qualification={RESOLVED_QUAL} allGroupsFilled={true} />)
  expect(screen.getAllByText('א').length).toBeGreaterThan(0)
})

test('shows tie warning when unresolved and all groups filled', () => {
  const tiedQual: ThirdPlaceQualification = {
    resolved: false,
    all: ALL_TWELVE,
    tied: [ALL_TWELVE[7], ALL_TWELVE[8]],
  }
  render(<ThirdPlaceTable qualification={tiedQual} allGroupsFilled={true} />)
  expect(screen.getByText(/שוויון/)).toBeInTheDocument()
})

test('does not show tie warning when groups are not all filled', () => {
  const tiedQual: ThirdPlaceQualification = {
    resolved: false,
    all: ALL_TWELVE,
    tied: [ALL_TWELVE[7], ALL_TWELVE[8]],
  }
  render(<ThirdPlaceTable qualification={tiedQual} allGroupsFilled={false} />)
  expect(screen.queryByText(/שוויון/)).not.toBeInTheDocument()
})
