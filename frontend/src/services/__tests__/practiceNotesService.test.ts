import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getPrePracticeNote,
  getPostPracticeNote,
  upsertPrePracticeNote,
  upsertPostPracticeNote,
  deletePrePracticeNote,
  deletePostPracticeNote
} from '../practiceNotesService'
import { apiClient } from '@/lib/apiClient'

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

      vi.mocked(apiClient.get).mockResolvedValue([mockNote])

      const result = await getPrePracticeNote('session-1')

      expect(result).toEqual(mockNote)
      expect(apiClient.get).toHaveBeenCalledWith('/practice-notes/pre/session-1')
    })

    it('should return null when note not found', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([])

      const result = await getPrePracticeNote('session-1')

      expect(result).toBeNull()
    })

    it('should return null when response is null', async () => {
      vi.mocked(apiClient.get).mockResolvedValue(null)

      const result = await getPrePracticeNote('session-1')

      expect(result).toBeNull()
    })

    it('should throw error on fetch failure', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Fetch failed'))

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

      vi.mocked(apiClient.get).mockResolvedValue([mockNote])

      const result = await getPostPracticeNote('session-1')

      expect(result).toEqual(mockNote)
      expect(apiClient.get).toHaveBeenCalledWith('/practice-notes/post/session-1')
    })

    it('should return null when note not found', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([])

      const result = await getPostPracticeNote('session-1')

      expect(result).toBeNull()
    })
  })

  describe('upsertPrePracticeNote', () => {
    it('should create or update a pre-practice note', async () => {
      const noteData = {
        training_session_id: 'session-1',
        notes: 'Bring kickboards'
      }

      const mockNote = {
        id: 'note-1',
        ...noteData,
        coach_id: 'coach-1',
        created_at: '2024-01-15',
        updated_at: '2024-01-15'
      }

      vi.mocked(apiClient.post).mockResolvedValue(mockNote)

      const result = await upsertPrePracticeNote(noteData)

      expect(result).toEqual(mockNote)
      expect(apiClient.post).toHaveBeenCalledWith('/practice-notes/pre', {
        training_session_id: 'session-1',
        notes: 'Bring kickboards',
      })
    })

    it('should throw error on upsert failure', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Failed to save note'))

      await expect(upsertPrePracticeNote({ training_session_id: 'session-1', notes: 'Test' })).rejects.toThrow()
    })
  })

  describe('upsertPostPracticeNote', () => {
    it('should create or update a post-practice note', async () => {
      const noteData = {
        training_session_id: 'session-1',
        notes: 'Swimmers showed improvement'
      }

      const mockNote = {
        id: 'note-1',
        ...noteData,
        coach_id: 'coach-1',
        created_at: '2024-01-15',
        updated_at: '2024-01-15'
      }

      vi.mocked(apiClient.post).mockResolvedValue(mockNote)

      const result = await upsertPostPracticeNote(noteData)

      expect(result).toEqual(mockNote)
      expect(apiClient.post).toHaveBeenCalledWith('/practice-notes/post', {
        training_session_id: 'session-1',
        notes: 'Swimmers showed improvement',
      })
    })
  })

  describe('deletePrePracticeNote', () => {
    it('should delete a pre-practice note', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue(undefined)

      await expect(deletePrePracticeNote('note-1')).resolves.toBeUndefined()
      expect(apiClient.delete).toHaveBeenCalledWith('/practice-notes/pre/note-1')
    })

    it('should throw error on deletion failure', async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error('Delete failed'))

      await expect(deletePrePracticeNote('note-1')).rejects.toThrow()
    })
  })

  describe('deletePostPracticeNote', () => {
    it('should delete a post-practice note', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue(undefined)

      await expect(deletePostPracticeNote('note-1')).resolves.toBeUndefined()
      expect(apiClient.delete).toHaveBeenCalledWith('/practice-notes/post/note-1')
    })
  })
})
