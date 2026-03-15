import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import AttendanceModal from '../AttendanceModal'

// Mock attendanceService
const mockGetSessionAttendanceWithSwimmers = vi.fn()
const mockBulkUpsertAttendance = vi.fn()
const mockMarkRemainingAsAbsent = vi.fn()

vi.mock('@/services/attendanceService', () => ({
  getSessionAttendanceWithSwimmers: (...args: any[]) =>
    mockGetSessionAttendanceWithSwimmers(...args),
  bulkUpsertAttendance: (...args: any[]) => mockBulkUpsertAttendance(...args),
  markRemainingAsAbsent: (...args: any[]) => mockMarkRemainingAsAbsent(...args),
}))

const mockSwimmers = [
  {
    id: 'swimmer-1',
    first_name: 'John',
    last_name: 'Doe',
    attendance: null,
  },
  {
    id: 'swimmer-2',
    first_name: 'Jane',
    last_name: 'Smith',
    attendance: {
      id: 'att-1',
      status: 'present' as const,
      notes: null,
    },
  },
]

const mockAttendanceData = {
  swimmers: mockSwimmers,
  summary: { total: 2, present: 1, late: 0, absent: 0, not_recorded: 1 },
}

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  sessionId: 'session-1',
  squadId: 'squad-1',
  sessionDate: '2026-03-10T06:00:00.000Z',
  onSuccess: vi.fn(),
}

describe('AttendanceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSessionAttendanceWithSwimmers.mockResolvedValue(mockAttendanceData)
    mockBulkUpsertAttendance.mockResolvedValue([])
    mockMarkRemainingAsAbsent.mockResolvedValue(undefined)
  })

  it('renders nothing when open=false', () => {
    const { container } = render(<AttendanceModal {...defaultProps} open={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the modal header when open=true', async () => {
    render(<AttendanceModal {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Take Attendance')).toBeInTheDocument()
    })
  })

  it('renders swimmer list after loading', async () => {
    render(<AttendanceModal {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })
  })

  it('calls getSessionAttendanceWithSwimmers on open', async () => {
    render(<AttendanceModal {...defaultProps} />)

    await waitFor(() => {
      expect(mockGetSessionAttendanceWithSwimmers).toHaveBeenCalledWith(
        'session-1',
        'squad-1'
      )
    })
  })

  it('renders Present, Late, Absent buttons for each swimmer', async () => {
    render(<AttendanceModal {...defaultProps} />)

    await waitFor(() => {
      const presentButtons = screen.getAllByText('Present')
      const lateButtons = screen.getAllByText('Late')
      const absentButtons = screen.getAllByText('Absent')

      expect(presentButtons).toHaveLength(2)
      expect(lateButtons).toHaveLength(2)
      expect(absentButtons).toHaveLength(2)
    })
  })

  it('toggles status when a button is clicked', async () => {
    render(<AttendanceModal {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    // Click "Present" for John Doe (first swimmer row)
    const presentButtons = screen.getAllByText('Present')
    fireEvent.click(presentButtons[0])

    // After clicking, a notes input should appear (status is now set)
    await waitFor(() => {
      const noteInputs = screen.getAllByPlaceholderText('Add notes (optional)...')
      expect(noteInputs.length).toBeGreaterThan(0)
    })
  })

  it('renders "Mark All Present" quick action button', async () => {
    render(<AttendanceModal {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Mark All Present')).toBeInTheDocument()
    })
  })

  it('renders "Mark Remaining Absent" quick action button', async () => {
    render(<AttendanceModal {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Mark Remaining Absent')).toBeInTheDocument()
    })
  })

  it('renders Save Attendance button', async () => {
    render(<AttendanceModal {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Save Attendance')).toBeInTheDocument()
    })
  })

  it('calls bulkUpsertAttendance and onSuccess when Save is clicked', async () => {
    render(<AttendanceModal {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    // Mark John as present
    const presentButtons = screen.getAllByText('Present')
    fireEvent.click(presentButtons[0])

    // Save
    const saveButton = screen.getByText('Save Attendance')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockBulkUpsertAttendance).toHaveBeenCalledWith(
        'session-1',
        expect.arrayContaining([
          expect.objectContaining({ swimmer_id: 'swimmer-1', status: 'present' }),
        ])
      )
      expect(defaultProps.onSuccess).toHaveBeenCalled()
    })
  })

  it('calls onClose when Cancel button is clicked', async () => {
    render(<AttendanceModal {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Cancel'))
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('shows error message when loadAttendance fails', async () => {
    mockGetSessionAttendanceWithSwimmers.mockRejectedValue(new Error('Network error'))

    render(<AttendanceModal {...defaultProps} />)

    await waitFor(() => {
      expect(
        screen.getByText('Failed to load attendance data. Please try again.')
      ).toBeInTheDocument()
    })
  })

  it('shows "No swimmers found" when empty swimmer list is returned', async () => {
    mockGetSessionAttendanceWithSwimmers.mockResolvedValue({
      swimmers: [],
      summary: { total: 0, present: 0, late: 0, absent: 0, not_recorded: 0 },
    })

    render(<AttendanceModal {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('No swimmers found in this squad')).toBeInTheDocument()
    })
  })

  it('displays session date in the header', async () => {
    render(<AttendanceModal {...defaultProps} sessionDate="2026-03-10T06:00:00.000Z" />)

    await waitFor(() => {
      // Date should be formatted and displayed
      expect(screen.getByText(/2026/)).toBeInTheDocument()
    })
  })
})
