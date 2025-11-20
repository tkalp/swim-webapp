import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getPrePracticeNote,
  getPostPracticeNote,
  upsertPrePracticeNote,
  upsertPostPracticeNote,
  deletePrePracticeNote,
  deletePostPracticeNote
} from '../practiceNotesService'
import { supabase } from '../../lib/supabase'

describe('practiceNotesService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getPrePracticeNote', () => {
    it('should return pre-practice note for a session', async () => {
      const mockNote = {
        id: 'note-1',
        training_session_id: 'session-1',
        coach_id: 'coach-1',
        content: 'Focus on technique today',
        created_at: '2024-01-15'
      }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockNote, error: null })
      } as any)

      const result = await getPrePracticeNote('session-1')

      expect(result).toEqual(mockNote)
      expect(supabase.from).toHaveBeenCalledWith('training_session_pre_practice_notes')
    })

    it('should return null when note not found', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
      } as any)

      const result = await getPrePracticeNote('session-1')

      expect(result).toBeNull()
    })

    it('should throw error on fetch failure', async () => {
      const mockError = { message: 'Fetch failed', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError })
      } as any)

      await expect(getPrePracticeNote('session-1')).rejects.toThrow()
    })
  })

  describe('getPostPracticeNote', () => {
    it('should return post-practice note for a session', async () => {
      const mockNote = {
        id: 'note-1',
        training_session_id: 'session-1',
        coach_id: 'coach-1',
        content: 'Great session, good effort',
        created_at: '2024-01-15'
      }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockNote, error: null })
      } as any)

      const result = await getPostPracticeNote('session-1')

      expect(result).toEqual(mockNote)
      expect(supabase.from).toHaveBeenCalledWith('training_session_post_practice_notes')
    })

    it('should return null when note not found', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
      } as any)

      const result = await getPostPracticeNote('session-1')

      expect(result).toBeNull()
    })
  })

  describe('upsertPrePracticeNote', () => {
    it('should create or update a pre-practice note', async () => {
      const noteData = {
        training_session_id: 'session-1',
        focus: 'Focus on starts and turns',
        notes: 'Bring kickboards'
      }

      const mockNote = {
        id: 'note-1',
        ...noteData,
        coach_id: 'coach-1',
        created_at: '2024-01-15',
        updated_at: '2024-01-15'
      }

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'coach-1' } as any },
        error: null
      })

      vi.mocked(supabase.from).mockReturnValue({
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockNote, error: null })
      } as any)

      const result = await upsertPrePracticeNote(noteData)

      expect(result).toEqual(mockNote)
    })

    it('should throw error when not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated', name: 'AuthError', status: 401 }
      } as any)

      await expect(upsertPrePracticeNote({ training_session_id: 'session-1', notes: 'Test' })).rejects.toThrow('Not authenticated')
    })
  })

  describe('upsertPostPracticeNote', () => {
    it('should create or update a post-practice note', async () => {
      const noteData = {
        training_session_id: 'session-1',
        what_went_well: 'Swimmers showed improvement',
        overall_rating: 8
      }

      const mockNote = {
        id: 'note-1',
        ...noteData,
        coach_id: 'coach-1',
        created_at: '2024-01-15',
        updated_at: '2024-01-15'
      }

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'coach-1' } as any },
        error: null
      })

      vi.mocked(supabase.from).mockReturnValue({
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockNote, error: null })
      } as any)

      const result = await upsertPostPracticeNote(noteData)

      expect(result).toEqual(mockNote)
    })
  })

  describe('deletePrePracticeNote', () => {
    it('should delete a pre-practice note', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null })
      } as any)

      await expect(deletePrePracticeNote('note-1')).resolves.toBeUndefined()
    })

    it('should throw error on deletion failure', async () => {
      const mockError = { message: 'Delete failed', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: mockError })
      } as any)

      await expect(deletePrePracticeNote('note-1')).rejects.toThrow()
    })
  })

  describe('deletePostPracticeNote', () => {
    it('should delete a post-practice note', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null })
      } as any)

      await expect(deletePostPracticeNote('note-1')).resolves.toBeUndefined()
    })
  })
})
