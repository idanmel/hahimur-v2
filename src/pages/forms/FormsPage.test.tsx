import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FormsPage from './FormsPage'

async function selectUser(name: string) {
  const user = userEvent.setup()
  render(<FormsPage />)
  await user.click(screen.getByRole('button', { name: /בחר שחקן/ }))
  await user.click(screen.getByRole('option', { name: new RegExp(name) }))
}

test('forms page shows הטפסים heading', () => {
  render(<FormsPage />)
  expect(screen.getByRole('heading', { name: 'הטפסים' })).toBeInTheDocument()
})

test('shows a user dropdown on load', () => {
  render(<FormsPage />)
  expect(screen.getByRole('button', { name: /בחר שחקן/ })).toBeInTheDocument()
})

test('shows no predictions on initial load', () => {
  render(<FormsPage />)
  expect(screen.queryByRole('button', { name: 'א' })).not.toBeInTheDocument()
})

test('shows בחר שחקן prompt on initial load', () => {
  render(<FormsPage />)
  expect(screen.getByText('בחר שחקן')).toBeInTheDocument()
})

test('shows group navigation tabs when טל ליכטר is selected', async () => {
  await selectUser('טל ליכטר')
  expect(screen.getByRole('button', { name: 'א' })).toBeInTheDocument()
})

test('shows hardcoded score for Mexico vs South Africa (A1 home = 2) when טל ליכטר is selected', async () => {
  await selectUser('טל ליכטר')
  expect(screen.getAllByTestId('score-home')[0]).toHaveTextContent('2')
})

test('shows hardcoded KO scores (more than just the 12 group-A scores) when טל ליכטר is selected', async () => {
  await selectUser('טל ליכטר')
  const allScoreEls = document.querySelectorAll('.match-score-static')
  const nonEmpty = Array.from(allScoreEls).filter(el => el.textContent !== '–')
  expect(nonEmpty.length).toBeGreaterThan(12)
})

test('shows עידן מלמד predictions when selected', async () => {
  await selectUser('עידן מלמד')
  expect(screen.getByRole('button', { name: 'א' })).toBeInTheDocument()
})

test('עידן מלמד predictions are not all 0-0', async () => {
  await selectUser('עידן מלמד')
  const homeScores = screen.getAllByTestId('score-home')
  const nonZero = homeScores.filter(el => el.textContent !== '0')
  expect(nonZero.length).toBeGreaterThan(0)
})

test('עידן מלמד has no unresolved draw winner badges', async () => {
  await selectUser('עידן מלמד')
  expect(screen.queryByText('בחר מנצחת')).not.toBeInTheDocument()
})

test('אלרד גומא appears in dropdown and shows predictions section', async () => {
  await selectUser('אלרד גומא')
  expect(screen.getByRole('button', { name: 'א' })).toBeInTheDocument()
})

test('אלרד גומא group A scores show – for null predictions', async () => {
  await selectUser('אלרד גומא')
  expect(screen.getAllByTestId('score-home')[0]).toHaveTextContent('–')
})
