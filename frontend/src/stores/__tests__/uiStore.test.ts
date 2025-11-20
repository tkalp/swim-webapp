import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUIStore } from '../uiStore'

describe('uiStore', () => {
  beforeEach(() => {
    // Reset store and clear timers
    vi.clearAllTimers()
    useUIStore.setState({
      modals: new Map(),
      toasts: [],
      globalLoading: false,
      loadingStates: new Map(),
      searchQuery: '',
      filters: new Map(),
      sidebarOpen: true,
    })
  })

  describe('initial state', () => {
    it('should have empty state initially', () => {
      const { result } = renderHook(() => useUIStore())
      expect(result.current.modals.size).toBe(0)
      expect(result.current.toasts).toEqual([])
      expect(result.current.globalLoading).toBe(false)
      expect(result.current.loadingStates.size).toBe(0)
      expect(result.current.searchQuery).toBe('')
      expect(result.current.filters.size).toBe(0)
      expect(result.current.sidebarOpen).toBe(true)
    })
  })

  describe('Modal actions', () => {
    describe('openModal', () => {
      it('should open a modal without data', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.openModal('test-modal')
        })

        expect(result.current.isModalOpen('test-modal')).toBe(true)
      })

      it('should open a modal with data', () => {
        const { result } = renderHook(() => useUIStore())
        const modalData = { title: 'Test Modal', content: 'Test content' }

        act(() => {
          result.current.openModal('test-modal', modalData)
        })

        expect(result.current.isModalOpen('test-modal')).toBe(true)
        expect(result.current.getModalData('test-modal')).toEqual(modalData)
      })

      it('should replace existing modal data', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.openModal('test-modal', { value: 1 })
        })

        act(() => {
          result.current.openModal('test-modal', { value: 2 })
        })

        expect(result.current.getModalData('test-modal')).toEqual({ value: 2 })
      })
    })

    describe('closeModal', () => {
      it('should close an open modal', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.openModal('test-modal')
        })

        act(() => {
          result.current.closeModal('test-modal')
        })

        expect(result.current.isModalOpen('test-modal')).toBe(false)
      })

      it('should do nothing if modal does not exist', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.closeModal('non-existent')
        })

        expect(result.current.modals.size).toBe(0)
      })
    })

    describe('isModalOpen', () => {
      it('should return true for open modal', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.openModal('test-modal')
        })

        expect(result.current.isModalOpen('test-modal')).toBe(true)
      })

      it('should return false for closed modal', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.openModal('test-modal')
          result.current.closeModal('test-modal')
        })

        expect(result.current.isModalOpen('test-modal')).toBe(false)
      })

      it('should return false for non-existent modal', () => {
        const { result } = renderHook(() => useUIStore())

        expect(result.current.isModalOpen('non-existent')).toBe(false)
      })
    })

    describe('getModalData', () => {
      it('should get modal data', () => {
        const { result } = renderHook(() => useUIStore())
        const data = { test: 'data' }

        act(() => {
          result.current.openModal('test-modal', data)
        })

        expect(result.current.getModalData('test-modal')).toEqual(data)
      })

      it('should return undefined for non-existent modal', () => {
        const { result } = renderHook(() => useUIStore())

        expect(result.current.getModalData('non-existent')).toBeUndefined()
      })
    })
  })

  describe('Toast actions', () => {
    describe('addToast', () => {
      it('should add a toast', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.addToast({ message: 'Test toast', type: 'success' })
        })

        expect(result.current.toasts.length).toBe(1)
        expect(result.current.toasts[0].message).toBe('Test toast')
        expect(result.current.toasts[0].type).toBe('success')
      })

      it('should generate unique toast IDs', () => {
        const { result } = renderHook(() => useUIStore())

        let id1: string
        let id2: string

        act(() => {
          id1 = result.current.addToast({ message: 'Toast 1', type: 'info' })
          id2 = result.current.addToast({ message: 'Toast 2', type: 'info' })
        })

        expect(id1).not.toBe(id2)
        expect(result.current.toasts.length).toBe(2)
      })

      it('should add toast with custom duration', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.addToast({ 
            message: 'Test toast', 
            type: 'warning',
            duration: 3000
          })
        })

        expect(result.current.toasts[0].duration).toBe(3000)
      })

      it('should add toast with duration 0 (no auto-remove)', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.addToast({ 
            message: 'Persistent toast', 
            type: 'error',
            duration: 0
          })
        })

        expect(result.current.toasts[0].duration).toBe(0)
      })
    })

    describe('removeToast', () => {
      it('should remove a specific toast', () => {
        const { result } = renderHook(() => useUIStore())

        let toastId: string

        act(() => {
          toastId = result.current.addToast({ message: 'Test toast', type: 'success' })
          result.current.addToast({ message: 'Another toast', type: 'info' })
        })

        act(() => {
          result.current.removeToast(toastId)
        })

        expect(result.current.toasts.length).toBe(1)
        expect(result.current.toasts[0].message).toBe('Another toast')
      })

      it('should do nothing if toast not found', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.addToast({ message: 'Test toast', type: 'success' })
        })

        act(() => {
          result.current.removeToast('non-existent-id')
        })

        expect(result.current.toasts.length).toBe(1)
      })
    })

    describe('clearToasts', () => {
      it('should remove all toasts', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.addToast({ message: 'Toast 1', type: 'success' })
          result.current.addToast({ message: 'Toast 2', type: 'info' })
          result.current.addToast({ message: 'Toast 3', type: 'error' })
        })

        act(() => {
          result.current.clearToasts()
        })

        expect(result.current.toasts).toEqual([])
      })
    })
  })

  describe('Loading actions', () => {
    describe('setGlobalLoading', () => {
      it('should set global loading state', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.setGlobalLoading(true)
        })

        expect(result.current.globalLoading).toBe(true)

        act(() => {
          result.current.setGlobalLoading(false)
        })

        expect(result.current.globalLoading).toBe(false)
      })
    })

    describe('setLoading', () => {
      it('should set loading state for a key', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.setLoading('fetch-data', true)
        })

        expect(result.current.isLoading('fetch-data')).toBe(true)
      })

      it('should remove loading state when set to false', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.setLoading('fetch-data', true)
        })

        act(() => {
          result.current.setLoading('fetch-data', false)
        })

        expect(result.current.isLoading('fetch-data')).toBe(false)
        expect(result.current.loadingStates.has('fetch-data')).toBe(false)
      })

      it('should handle multiple loading states', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.setLoading('operation-1', true)
          result.current.setLoading('operation-2', true)
        })

        expect(result.current.isLoading('operation-1')).toBe(true)
        expect(result.current.isLoading('operation-2')).toBe(true)

        act(() => {
          result.current.setLoading('operation-1', false)
        })

        expect(result.current.isLoading('operation-1')).toBe(false)
        expect(result.current.isLoading('operation-2')).toBe(true)
      })
    })

    describe('isLoading', () => {
      it('should return false for non-existent key', () => {
        const { result } = renderHook(() => useUIStore())

        expect(result.current.isLoading('non-existent')).toBe(false)
      })

      it('should return true for active loading state', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.setLoading('test-operation', true)
        })

        expect(result.current.isLoading('test-operation')).toBe(true)
      })
    })
  })

  describe('Search & Filter actions', () => {
    describe('setSearchQuery', () => {
      it('should set search query', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.setSearchQuery('test query')
        })

        expect(result.current.searchQuery).toBe('test query')
      })

      it('should update existing search query', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.setSearchQuery('first query')
          result.current.setSearchQuery('second query')
        })

        expect(result.current.searchQuery).toBe('second query')
      })
    })

    describe('setFilter', () => {
      it('should set a filter', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.setFilter('status', 'active')
        })

        expect(result.current.getFilter('status')).toBe('active')
      })

      it('should update existing filter', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.setFilter('status', 'active')
          result.current.setFilter('status', 'inactive')
        })

        expect(result.current.getFilter('status')).toBe('inactive')
      })

      it('should handle multiple filters', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.setFilter('status', 'active')
          result.current.setFilter('type', 'premium')
        })

        expect(result.current.getFilter('status')).toBe('active')
        expect(result.current.getFilter('type')).toBe('premium')
      })
    })

    describe('removeFilter', () => {
      it('should remove a filter', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.setFilter('status', 'active')
        })

        act(() => {
          result.current.removeFilter('status')
        })

        expect(result.current.getFilter('status')).toBeUndefined()
      })

      it('should do nothing if filter does not exist', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.removeFilter('non-existent')
        })

        expect(result.current.filters.size).toBe(0)
      })
    })

    describe('clearFilters', () => {
      it('should clear all filters', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.setFilter('status', 'active')
          result.current.setFilter('type', 'premium')
          result.current.setFilter('category', 'sports')
        })

        act(() => {
          result.current.clearFilters()
        })

        expect(result.current.filters.size).toBe(0)
      })
    })

    describe('getFilter', () => {
      it('should get a filter value', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.setFilter('status', 'active')
        })

        expect(result.current.getFilter('status')).toBe('active')
      })

      it('should return undefined for non-existent filter', () => {
        const { result } = renderHook(() => useUIStore())

        expect(result.current.getFilter('non-existent')).toBeUndefined()
      })
    })
  })

  describe('Sidebar actions', () => {
    describe('toggleSidebar', () => {
      it('should toggle sidebar state', () => {
        const { result } = renderHook(() => useUIStore())

        expect(result.current.sidebarOpen).toBe(true)

        act(() => {
          result.current.toggleSidebar()
        })

        expect(result.current.sidebarOpen).toBe(false)

        act(() => {
          result.current.toggleSidebar()
        })

        expect(result.current.sidebarOpen).toBe(true)
      })
    })

    describe('setSidebarOpen', () => {
      it('should set sidebar open state', () => {
        const { result } = renderHook(() => useUIStore())

        act(() => {
          result.current.setSidebarOpen(false)
        })

        expect(result.current.sidebarOpen).toBe(false)

        act(() => {
          result.current.setSidebarOpen(true)
        })

        expect(result.current.sidebarOpen).toBe(true)
      })
    })
  })

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.openModal('test-modal', { data: 'test' })
        result.current.addToast({ message: 'Test', type: 'success' })
        result.current.setGlobalLoading(true)
        result.current.setLoading('operation', true)
        result.current.setSearchQuery('test search')
        result.current.setFilter('status', 'active')
        result.current.setSidebarOpen(false)
      })

      act(() => {
        result.current.reset()
      })

      expect(result.current.modals.size).toBe(0)
      expect(result.current.toasts).toEqual([])
      expect(result.current.globalLoading).toBe(false)
      expect(result.current.loadingStates.size).toBe(0)
      expect(result.current.searchQuery).toBe('')
      expect(result.current.filters.size).toBe(0)
      expect(result.current.sidebarOpen).toBe(true)
    })
  })
})
