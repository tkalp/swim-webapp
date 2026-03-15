import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/services/adminService', () => ({
  startBulkSync: vi.fn(),
  getBulkSyncStatus: vi.fn(),
  getBulkSyncFailures: vi.fn().mockResolvedValue([]),
  cancelBulkSync: vi.fn(),
  getBulkSyncHistory: vi.fn().mockResolvedValue([]),
}))

import AdminSyncPage from '../AdminSyncPage'

describe('AdminSyncPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <AdminSyncPage />
      </MemoryRouter>
    )
    expect(document.body).toBeTruthy()
  })

  it('renders sync all swimmers button', () => {
    render(
      <MemoryRouter>
        <AdminSyncPage />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: /sync all swimmers/i })).toBeInTheDocument()
  })

  it('renders Admin heading', () => {
    render(
      <MemoryRouter>
        <AdminSyncPage />
      </MemoryRouter>
    )
    expect(screen.getByText(/admin.*bulk swimmer sync/i)).toBeInTheDocument()
  })
})
