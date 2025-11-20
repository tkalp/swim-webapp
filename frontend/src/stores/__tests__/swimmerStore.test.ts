import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSwimmerStore } from '../swimmerStore'
import { mockSwimmer } from '@/__tests__/testUtils'

describe('swimmerStore', () => {
  beforeEach(() => {
    // Reset store
    useSwimmerStore.setState({ 
      swimmers: new Map(), 
      swimmersBySquad: new Map(),
      loading: false, 
      error: null,
      selectedSwimmerId: null
    })
  })

  describe('initial state', () => {
    it('should have empty swimmers map initially', () => {
      const { result } = renderHook(() => useSwimmerStore())
      expect(result.current.swimmers.size).toBe(0)
      expect(result.current.swimmersBySquad.size).toBe(0)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.selectedSwimmerId).toBeNull()
    })
  })

  describe('setSwimmers', () => {
    it('should set swimmers and index them by squad', () => {
      const { result } = renderHook(() => useSwimmerStore())
      const swimmers = [mockSwimmer, { ...mockSwimmer, id: 'swimmer-2' }]

      act(() => {
        result.current.setSwimmers(swimmers, 'squad-1')
      })

      // Check swimmers are stored by ID
      expect(result.current.swimmers.size).toBe(2)
      expect(result.current.swimmers.get('swimmer-1')).toEqual(mockSwimmer)
      
      // Check squad index is created
      const squadSwimmerIds = result.current.swimmersBySquad.get('squad-1')
      expect(squadSwimmerIds).toBeDefined()
      expect(squadSwimmerIds?.length).toBe(2)
    })

    it('should merge with existing swimmers', () => {
      const { result } = renderHook(() => useSwimmerStore())
      const swimmer2 = { ...mockSwimmer, id: 'swimmer-2', squad_id: 'squad-2' }
      
      act(() => {
        result.current.setSwimmers([mockSwimmer], 'squad-1')
      })

      expect(result.current.swimmers.size).toBe(1)

      act(() => {
        result.current.setSwimmers([swimmer2], 'squad-2')
      })

      // Should have both swimmers
      expect(result.current.swimmers.size).toBe(2)
      expect(result.current.swimmersBySquad.get('squad-1')?.length).toBe(1)
      expect(result.current.swimmersBySquad.get('squad-2')?.length).toBe(1)
    })
  })

  describe('addSwimmer', () => {
    it('should add a swimmer by ID', () => {
      const { result } = renderHook(() => useSwimmerStore())

      act(() => {
        result.current.addSwimmer(mockSwimmer)
      })

      expect(result.current.swimmers.get('swimmer-1')).toEqual(mockSwimmer)
      const squadSwimmers = result.current.swimmersBySquad.get('squad-1')
      expect(squadSwimmers).toContain('swimmer-1')
    })

    it('should add swimmer to squad index', () => {
      const { result } = renderHook(() => useSwimmerStore())
      const swimmer2 = { ...mockSwimmer, id: 'swimmer-2' }

      act(() => {
        result.current.addSwimmer(mockSwimmer)
        result.current.addSwimmer(swimmer2)
      })

      expect(result.current.swimmers.size).toBe(2)
      const squadSwimmers = result.current.swimmersBySquad.get('squad-1')
      expect(squadSwimmers?.length).toBe(2)
    })
  })

  describe('updateSwimmer', () => {
    it('should update a swimmer by ID', () => {
      const { result } = renderHook(() => useSwimmerStore())

      act(() => {
        result.current.addSwimmer(mockSwimmer)
      })

      act(() => {
        result.current.updateSwimmer('swimmer-1', { first_name: 'Jane' })
      })

      const updated = result.current.swimmers.get('swimmer-1')
      expect(updated?.first_name).toBe('Jane')
      expect(updated?.last_name).toBe('Doe') // Other fields unchanged
    })

    it('should handle squad changes', () => {
      const { result } = renderHook(() => useSwimmerStore())

      act(() => {
        result.current.addSwimmer(mockSwimmer)
      })

      act(() => {
        result.current.updateSwimmer('swimmer-1', { squad_id: 'squad-2' })
      })

      // Should be removed from old squad index
      expect(result.current.swimmersBySquad.get('squad-1')).not.toContain('swimmer-1')
      // Should be added to new squad index
      expect(result.current.swimmersBySquad.get('squad-2')).toContain('swimmer-1')
    })

    it('should do nothing if swimmer not found', () => {
      const { result } = renderHook(() => useSwimmerStore())

      act(() => {
        result.current.addSwimmer(mockSwimmer)
      })

      act(() => {
        result.current.updateSwimmer('non-existent', { first_name: 'Jane' })
      })

      const swimmer = result.current.swimmers.get('swimmer-1')
      expect(swimmer?.first_name).toBe('John') // Unchanged
    })
  })

  describe('removeSwimmer', () => {
    it('should remove a swimmer by ID', () => {
      const { result } = renderHook(() => useSwimmerStore())
      const swimmer2 = { ...mockSwimmer, id: 'swimmer-2' }

      act(() => {
        result.current.addSwimmer(mockSwimmer)
        result.current.addSwimmer(swimmer2)
      })

      act(() => {
        result.current.removeSwimmer('swimmer-1')
      })

      expect(result.current.swimmers.has('swimmer-1')).toBe(false)
      expect(result.current.swimmers.size).toBe(1)
    })

    it('should remove from squad index', () => {
      const { result } = renderHook(() => useSwimmerStore())

      act(() => {
        result.current.addSwimmer(mockSwimmer)
      })

      act(() => {
        result.current.removeSwimmer('swimmer-1')
      })

      const squadSwimmers = result.current.swimmersBySquad.get('squad-1')
      expect(squadSwimmers).not.toContain('swimmer-1')
    })

    it('should do nothing if swimmer not found', () => {
      const { result } = renderHook(() => useSwimmerStore())

      act(() => {
        result.current.removeSwimmer('non-existent')
      })

      expect(result.current.swimmers.size).toBe(0)
    })
  })

  describe('getSwimmer', () => {
    it('should get a specific swimmer by ID', () => {
      const { result } = renderHook(() => useSwimmerStore())

      act(() => {
        result.current.addSwimmer(mockSwimmer)
      })

      const swimmer = result.current.getSwimmer('swimmer-1')
      expect(swimmer).toEqual(mockSwimmer)
    })

    it('should return undefined if swimmer not found', () => {
      const { result } = renderHook(() => useSwimmerStore())

      const swimmer = result.current.getSwimmer('non-existent')
      expect(swimmer).toBeUndefined()
    })
  })

  describe('getSwimmersBySquad', () => {
    it('should get all swimmers for a squad', () => {
      const { result } = renderHook(() => useSwimmerStore())
      const swimmer2 = { ...mockSwimmer, id: 'swimmer-2' }

      act(() => {
        result.current.setSwimmers([mockSwimmer, swimmer2], 'squad-1')
      })

      const squadSwimmers = result.current.getSwimmersBySquad('squad-1')
      expect(squadSwimmers.length).toBe(2)
      expect(squadSwimmers).toContainEqual(mockSwimmer)
    })

    it('should return empty array if squad not found', () => {
      const { result } = renderHook(() => useSwimmerStore())

      const swimmers = result.current.getSwimmersBySquad('non-existent')
      expect(swimmers).toEqual([])
    })
  })

  describe('setSelectedSwimmer', () => {
    it('should set selected swimmer ID', () => {
      const { result } = renderHook(() => useSwimmerStore())

      act(() => {
        result.current.setSelectedSwimmer('swimmer-1')
      })

      expect(result.current.selectedSwimmerId).toBe('swimmer-1')
    })

    it('should clear selected swimmer', () => {
      const { result } = renderHook(() => useSwimmerStore())

      act(() => {
        result.current.setSelectedSwimmer('swimmer-1')
        result.current.setSelectedSwimmer(null)
      })

      expect(result.current.selectedSwimmerId).toBeNull()
    })
  })

  describe('setSelectedSwimmer', () => {
    it('should set selected swimmer ID', () => {
      const { result } = renderHook(() => useSwimmerStore())

      act(() => {
        result.current.setSelectedSwimmer('swimmer-1')
      })

      expect(result.current.selectedSwimmerId).toBe('swimmer-1')
    })

    it('should clear selected swimmer', () => {
      const { result } = renderHook(() => useSwimmerStore())

      act(() => {
        result.current.setSelectedSwimmer('swimmer-1')
        result.current.setSelectedSwimmer(null)
      })

      expect(result.current.selectedSwimmerId).toBeNull()
    })
  })

  describe('setLoading', () => {
    it('should set loading state', () => {
      const { result } = renderHook(() => useSwimmerStore())

      act(() => {
        result.current.setLoading(true)
      })

      expect(result.current.loading).toBe(true)
    })
  })

  describe('setError', () => {
    it('should set error message', () => {
      const { result } = renderHook(() => useSwimmerStore())

      act(() => {
        result.current.setError('Test error')
      })

      expect(result.current.error).toBe('Test error')
    })
  })

  describe('clearError', () => {
    it('should clear error message', () => {
      const { result } = renderHook(() => useSwimmerStore())

      act(() => {
        result.current.setError('Test error')
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('reset', () => {
    it('should reset store to initial state', () => {
      const { result } = renderHook(() => useSwimmerStore())

      act(() => {
        result.current.addSwimmer(mockSwimmer)
        result.current.setError('Test error')
        result.current.setLoading(true)
        result.current.setSelectedSwimmer('swimmer-1')
        result.current.reset()
      })

      expect(result.current.swimmers.size).toBe(0)
      expect(result.current.swimmersBySquad.size).toBe(0)
      expect(result.current.error).toBeNull()
      expect(result.current.loading).toBe(false)
      expect(result.current.selectedSwimmerId).toBeNull()
    })
  })
})
