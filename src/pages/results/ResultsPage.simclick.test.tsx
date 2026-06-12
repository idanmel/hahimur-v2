import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import ResultsPage from './ResultsPage'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('clicking סימלוץ reports the click to /api/sim-click', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}'))
  vi.stubGlobal('fetch', fetchMock)
  render(<ResultsPage users={[]} />)

  await userEvent.click(screen.getByRole('button', { name: 'סימלוץ' }))

  expect(fetchMock).toHaveBeenCalledWith('/api/sim-click', { method: 'POST' })
})

test('the simulator still works when the click report fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
  render(<ResultsPage users={[]} />)

  await userEvent.click(screen.getByRole('button', { name: 'סימלוץ' }))
  // no crash — the page is still interactive
  expect(screen.getByRole('button', { name: 'איפוס' })).toBeEnabled()
})
