import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import ScoreInput from './ScoreInput'
import type { Score } from '../shared/types'

function Wrapper({ initial = null }: { initial?: Score }) {
  const [value, setValue] = useState<Score>(initial)
  return <ScoreInput label="test" value={value} onChange={setValue} />
}

function setup(initial?: Score) {
  const user = userEvent.setup()
  render(<Wrapper initial={initial} />)
  const input = screen.getByLabelText('test')
  return { user, input }
}

test('accepts a valid digit', async () => {
  const { user, input } = setup()
  await user.type(input, '2')
  expect(input).toHaveValue('2')
})

test('accepts zero', async () => {
  const { user, input } = setup()
  await user.type(input, '0')
  expect(input).toHaveValue('0')
})

test('blocks minus sign', async () => {
  const { user, input } = setup()
  await user.type(input, '-1')
  expect(input).toHaveValue('1')
})

test('blocks decimal point', async () => {
  const { user, input } = setup()
  await user.type(input, '1.5')
  expect(input).toHaveValue('15')
})

test('blocks letters', async () => {
  const { user, input } = setup()
  await user.type(input, 'abc')
  expect(input).toHaveValue('')
})

test('blocks letter after digit', async () => {
  const { user, input } = setup()
  await user.type(input, '1a')
  expect(input).toHaveValue('1')
})

test('blocks space', async () => {
  const { user, input } = setup()
  await user.type(input, ' ')
  expect(input).toHaveValue('')
})

test('blocks special character', async () => {
  const { user, input } = setup()
  await user.type(input, '!')
  expect(input).toHaveValue('')
})

test('strips leading zeros: 0123 becomes 123', async () => {
  const { user, input } = setup()
  await user.type(input, '0123')
  expect(input).toHaveValue('123')
})
