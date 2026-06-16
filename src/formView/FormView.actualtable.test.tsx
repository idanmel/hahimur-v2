import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import FormView from './FormView'

test('the active group shows the predicted table beside the actual one', () => {
  // Group A (the default) has real results
  render(<FormView predictions={{}} topGoalscorer="" />)

  expect(screen.getByText('התחזית')).toBeInTheDocument()
  expect(screen.getByText('בפועל')).toBeInTheDocument()
})

test('the actual table shows even for a group with no results yet', async () => {
  render(<FormView predictions={{}} topGoalscorer="" />)

  await userEvent.click(screen.getByRole('button', { name: 'ז' }))

  expect(screen.getByText('התחזית')).toBeInTheDocument()
  expect(screen.getByText('בפועל')).toBeInTheDocument()
})
