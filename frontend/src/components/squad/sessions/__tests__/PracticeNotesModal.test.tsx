import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import PracticeNotesModal from '../PracticeNotesModal'

// Mock practiceNotesService
const mockGetPrePracticeNote = vi.fn()
const mockGetPostPracticeNote = vi.fn()
const mockUpsertPrePracticeNote = vi.fn()
const mockUpsertPostPracticeNote = vi.fn()

vi.mock('@/services/practiceNotesService', () => ({
  getPrePracticeNote: (...args: any[]) => mockGetPrePracticeNote(...args),
  getPostPracticeNote: (...args: any[]) => mockGetPostPracticeNote(...args),
  upsertPrePracticeNote: (...args: any[]) => mockUpsertPrePracticeNote(...args),
  upsertPostPracticeNote: (...args: any[]) => mockUpsertPostPracticeNote(...args),
}))

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  sessionId: 'session-1',
  sessionDate: '2026-03-10T06:00:00.000Z',
  noteType: 'pre' as const,
}

describe('PracticeNotesModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPrePracticeNote.mockResolvedValue(null)
    mockGetPostPracticeNote.mockResolvedValue(null)
    mockUpsertPrePracticeNote.mockResolvedValue({})
    mockUpsertPostPracticeNote.mockResolvedValue({})
  })

  it('renders nothing when open=false', () => {
    const { container } = render(<PracticeNotesModal {...defaultProps} open={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders "Pre-Practice Notes" header when noteType=pre', async () => {
    render(<PracticeNotesModal {...defaultProps} noteType="pre" />)

    await waitFor(() => {
      expect(screen.getByText('Pre-Practice Notes')).toBeInTheDocument()
    })
  })

  it('renders "Post-Practice Notes" header when noteType=post', async () => {
    mockGetPostPracticeNote.mockResolvedValue(null)
    render(<PracticeNotesModal {...defaultProps} noteType="post" />)

    await waitFor(() => {
      expect(screen.getByText('Post-Practice Notes')).toBeInTheDocument()
    })
  })

  describe('Pre-practice form', () => {
    it('renders Announcements field', async () => {
      render(<PracticeNotesModal {...defaultProps} noteType="pre" />)

      await waitFor(() => {
        expect(screen.getByText('Announcements')).toBeInTheDocument()
        expect(
          screen.getByPlaceholderText('Any important announcements for the team...')
        ).toBeInTheDocument()
      })
    })

    it('renders Reminders field', async () => {
      render(<PracticeNotesModal {...defaultProps} noteType="pre" />)

      await waitFor(() => {
        expect(screen.getByText('Reminders')).toBeInTheDocument()
        expect(
          screen.getByPlaceholderText('Things to remember for this session...')
        ).toBeInTheDocument()
      })
    })

    it('renders Session Focus field', async () => {
      render(<PracticeNotesModal {...defaultProps} noteType="pre" />)

      await waitFor(() => {
        expect(screen.getByText('Session Focus')).toBeInTheDocument()
        expect(
          screen.getByPlaceholderText('e.g., Underwater work, Turns, Starts...')
        ).toBeInTheDocument()
      })
    })

    it('renders Equipment Needed field', async () => {
      render(<PracticeNotesModal {...defaultProps} noteType="pre" />)

      await waitFor(() => {
        expect(screen.getByText('Equipment Needed')).toBeInTheDocument()
        expect(
          screen.getByPlaceholderText('e.g., Fins, paddles, snorkels...')
        ).toBeInTheDocument()
      })
    })

    it('loads existing pre-practice note data', async () => {
      mockGetPrePracticeNote.mockResolvedValue({
        id: 'note-1',
        announcements: 'Meet on Saturday',
        reminders: 'Bring caps',
        focus: 'Turns',
        equipment_needed: 'Fins',
        notes: 'Extra note',
      })

      render(<PracticeNotesModal {...defaultProps} noteType="pre" />)

      await waitFor(() => {
        expect(
          (screen.getByPlaceholderText('Any important announcements for the team...') as HTMLTextAreaElement).value
        ).toBe('Meet on Saturday')
        expect(
          (screen.getByPlaceholderText('Things to remember for this session...') as HTMLTextAreaElement).value
        ).toBe('Bring caps')
      })
    })

    it('calls upsertPrePracticeNote when Save Notes is clicked', async () => {
      render(<PracticeNotesModal {...defaultProps} noteType="pre" />)

      await waitFor(() => {
        expect(screen.getByText('Save Notes')).toBeInTheDocument()
      })

      // Fill in a field
      const announcementsField = screen.getByPlaceholderText(
        'Any important announcements for the team...'
      )
      fireEvent.change(announcementsField, { target: { value: 'Team photo today' } })

      fireEvent.click(screen.getByText('Save Notes'))

      await waitFor(() => {
        expect(mockUpsertPrePracticeNote).toHaveBeenCalledWith(
          expect.objectContaining({
            training_session_id: 'session-1',
            announcements: 'Team photo today',
          })
        )
      })
    })

    it('closes modal on successful save', async () => {
      render(<PracticeNotesModal {...defaultProps} noteType="pre" />)

      await waitFor(() => {
        expect(screen.getByText('Save Notes')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Save Notes'))

      await waitFor(() => {
        expect(defaultProps.onClose).toHaveBeenCalled()
      })
    })
  })

  describe('Post-practice form', () => {
    it('renders rating section with "Session Ratings" heading', async () => {
      mockGetPostPracticeNote.mockResolvedValue(null)
      render(<PracticeNotesModal {...defaultProps} noteType="post" />)

      await waitFor(() => {
        expect(screen.getByText('Session Ratings (Optional)')).toBeInTheDocument()
      })
    })

    it('renders Overall Session rating selector', async () => {
      mockGetPostPracticeNote.mockResolvedValue(null)
      render(<PracticeNotesModal {...defaultProps} noteType="post" />)

      await waitFor(() => {
        expect(screen.getByText('Overall Session')).toBeInTheDocument()
      })
    })

    it('renders Effort Level rating selector', async () => {
      mockGetPostPracticeNote.mockResolvedValue(null)
      render(<PracticeNotesModal {...defaultProps} noteType="post" />)

      await waitFor(() => {
        expect(screen.getByText('Effort Level')).toBeInTheDocument()
      })
    })

    it('renders Technique Quality rating selector', async () => {
      mockGetPostPracticeNote.mockResolvedValue(null)
      render(<PracticeNotesModal {...defaultProps} noteType="post" />)

      await waitFor(() => {
        expect(screen.getByText('Technique Quality')).toBeInTheDocument()
      })
    })

    it('renders Team Positivity rating selector', async () => {
      mockGetPostPracticeNote.mockResolvedValue(null)
      render(<PracticeNotesModal {...defaultProps} noteType="post" />)

      await waitFor(() => {
        expect(screen.getByText('Team Positivity')).toBeInTheDocument()
      })
    })

    it('renders rating buttons 1–5 for each category', async () => {
      mockGetPostPracticeNote.mockResolvedValue(null)
      render(<PracticeNotesModal {...defaultProps} noteType="post" />)

      await waitFor(() => {
        // 4 rating categories × 5 buttons each = 20 rating buttons
        const ratingButtons = screen.getAllByRole('button', {
          name: /^[12345]$/,
        })
        expect(ratingButtons.length).toBe(20)
      })
    })

    it('calls upsertPostPracticeNote when Save Notes is clicked', async () => {
      mockGetPostPracticeNote.mockResolvedValue(null)
      render(<PracticeNotesModal {...defaultProps} noteType="post" />)

      await waitFor(() => {
        expect(screen.getByText('Save Notes')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Save Notes'))

      await waitFor(() => {
        expect(mockUpsertPostPracticeNote).toHaveBeenCalledWith(
          expect.objectContaining({
            training_session_id: 'session-1',
          })
        )
      })
    })
  })

  it('shows Cancel button that calls onClose', async () => {
    render(<PracticeNotesModal {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Cancel'))
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('shows error message when save fails', async () => {
    mockUpsertPrePracticeNote.mockRejectedValue(new Error('Server error'))

    render(<PracticeNotesModal {...defaultProps} noteType="pre" />)

    await waitFor(() => {
      expect(screen.getByText('Save Notes')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Save Notes'))

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
  })
})
