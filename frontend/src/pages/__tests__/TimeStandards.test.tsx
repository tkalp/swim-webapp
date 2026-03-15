import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/components/standards/StandardsSetsList', () => ({
  StandardsSetsList: ({ searchQuery, filterActive }: any) => (
    <div data-testid="standards-sets-list" data-search={searchQuery} data-filter={filterActive} />
  ),
}))

vi.mock('@/components/standards/CreateStandardsSetModal', () => ({
  CreateStandardsSetModal: ({ isOpen }: any) =>
    isOpen ? <div data-testid="create-modal" /> : null,
}))

vi.mock('@/components/standards/ImportStandardsModal', () => ({
  ImportStandardsModal: ({ isOpen }: any) =>
    isOpen ? <div data-testid="import-modal" /> : null,
}))

import TimeStandards from '../TimeStandards'

describe('TimeStandards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders page title', () => {
    render(
      <MemoryRouter>
        <TimeStandards />
      </MemoryRouter>
    )
    expect(screen.getByText('Time Standards')).toBeInTheDocument()
  })

  it('renders New Standards Set button', () => {
    render(
      <MemoryRouter>
        <TimeStandards />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: /new standards set/i })).toBeInTheDocument()
  })

  it('renders Import CSV button', () => {
    render(
      <MemoryRouter>
        <TimeStandards />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: /import csv/i })).toBeInTheDocument()
  })

  it('renders search input', () => {
    render(
      <MemoryRouter>
        <TimeStandards />
      </MemoryRouter>
    )
    expect(screen.getByPlaceholderText(/search standards sets/i)).toBeInTheDocument()
  })

  it('renders standards sets list', () => {
    render(
      <MemoryRouter>
        <TimeStandards />
      </MemoryRouter>
    )
    expect(screen.getByTestId('standards-sets-list')).toBeInTheDocument()
  })
})
