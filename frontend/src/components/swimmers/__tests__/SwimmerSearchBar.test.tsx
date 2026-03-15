import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SwimmerSearchBar } from '../SwimmerSearchBar'

// Mock swimRankingsService
const mockSearchSwimRankings = vi.fn().mockResolvedValue([])

vi.mock('@/services/swimRankingsService', () => ({
  searchSwimRankings: (...args: any[]) => mockSearchSwimRankings(...args),
}))

describe('SwimmerSearchBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchSwimRankings.mockResolvedValue([])
  })

  it('renders the search input', () => {
    render(<SwimmerSearchBar />)
    expect(screen.getByPlaceholderText(/search any swimmer/i)).toBeInTheDocument()
  })

  it('input accepts typed text', () => {
    render(<SwimmerSearchBar />)
    const input = screen.getByPlaceholderText(/search any swimmer/i)
    fireEvent.change(input, { target: { value: 'Michael' } })
    expect((input as HTMLInputElement).value).toBe('Michael')
  })

  it('does not show dropdown when input is empty', () => {
    render(<SwimmerSearchBar />)
    expect(screen.queryByText(/type a swimmer/i)).not.toBeInTheDocument()
  })

  it('triggers search after typing 2+ characters (debounced)', async () => {
    vi.useFakeTimers()
    render(<SwimmerSearchBar />)

    const input = screen.getByPlaceholderText(/search any swimmer/i)
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Mi' } })

    // Advance past the debounce delay (500ms)
    vi.advanceTimersByTime(600)

    await waitFor(() => {
      expect(mockSearchSwimRankings).toHaveBeenCalledWith('Mi', 'Mi')
    })

    vi.useRealTimers()
  })

  it('shows search results when returned', async () => {
    mockSearchSwimRankings.mockResolvedValue([
      {
        athlete_id: 'a1',
        name: 'Michael Phelps',
        birth_year: 1985,
        club: 'NBAC',
        nation: 'USA',
      },
    ])

    vi.useFakeTimers()
    render(<SwimmerSearchBar />)

    const input = screen.getByPlaceholderText(/search any swimmer/i)
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Michael' } })

    vi.advanceTimersByTime(600)

    await waitFor(() => {
      expect(screen.getByText('Michael Phelps')).toBeInTheDocument()
    })

    vi.useRealTimers()
  })

  it('shows "No swimmers found" when search returns empty', async () => {
    mockSearchSwimRankings.mockResolvedValue([])

    vi.useFakeTimers()
    render(<SwimmerSearchBar />)

    const input = screen.getByPlaceholderText(/search any swimmer/i)
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Xyzzy' } })

    vi.advanceTimersByTime(600)

    await waitFor(() => {
      expect(screen.getByText(/no swimmers found/i)).toBeInTheDocument()
    })

    vi.useRealTimers()
  })
})
