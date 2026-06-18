import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test } from 'vitest'
import FormView from './FormView'

// The usage-reporting logic (localhost guard, POST, error swallow) is unit-tested
// in shared/reportUsage.test.ts. Here we only check the toggle's UI behavior.
test('clicking לפי תאריך switches the group stage to the by-date view', () => {
  render(<FormView predictions={{}} topGoalscorer="" />)

  fireEvent.click(screen.getByRole('button', { name: 'לפי תאריך' }))

  // the by-date view groups matches under date headings (first match is June 11)
  expect(screen.getByText('11 ביוני')).toBeInTheDocument()
})
