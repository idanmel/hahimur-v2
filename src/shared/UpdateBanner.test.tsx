import { render, screen, fireEvent } from '@testing-library/react'
import { vi, afterEach } from 'vitest'
import UpdateBanner from './UpdateBanner'

afterEach(() => vi.restoreAllMocks())

test('renders nothing when no update is available', () => {
  render(<UpdateBanner updateAvailable={false} />)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('renders a banner when an update is available', () => {
  render(<UpdateBanner updateAvailable={true} />)
  expect(screen.getByRole('alert')).toBeInTheDocument()
})

test('banner contains a refresh button', () => {
  render(<UpdateBanner updateAvailable={true} />)
  expect(screen.getByRole('button', { name: /רענן/i })).toBeInTheDocument()
})

test('clicking refresh reloads the page', () => {
  const reloadMock = vi.fn()
  vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload: reloadMock })

  render(<UpdateBanner updateAvailable={true} />)
  fireEvent.click(screen.getByRole('button', { name: /רענן/i }))

  expect(reloadMock).toHaveBeenCalledOnce()
})
