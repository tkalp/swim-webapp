import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface Modal {
  id: string
  isOpen: boolean
  data?: any
}

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  duration?: number
}

interface UIState {
  // Modals
  modals: Map<string, Modal>
  
  // Toasts/Notifications
  toasts: Toast[]
  
  // Loading states
  globalLoading: boolean
  loadingStates: Map<string, boolean>
  
  // Filters & Search
  searchQuery: string
  filters: Map<string, any>
  
  // Sidebar/Navigation
  sidebarOpen: boolean
  
  // Actions - Modals
  openModal: (id: string, data?: any) => void
  closeModal: (id: string) => void
  isModalOpen: (id: string) => boolean
  getModalData: (id: string) => any
  
  // Actions - Toasts
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
  clearToasts: () => void
  
  // Actions - Loading
  setGlobalLoading: (loading: boolean) => void
  setLoading: (key: string, loading: boolean) => void
  isLoading: (key: string) => boolean
  
  // Actions - Search & Filters
  setSearchQuery: (query: string) => void
  setFilter: (key: string, value: any) => void
  removeFilter: (key: string) => void
  clearFilters: () => void
  getFilter: (key: string) => any
  
  // Actions - Sidebar
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  
  // Reset
  reset: () => void
}

const initialState = {
  modals: new Map<string, Modal>(),
  toasts: [],
  globalLoading: false,
  loadingStates: new Map<string, boolean>(),
  searchQuery: '',
  filters: new Map<string, any>(),
  sidebarOpen: true,
}

let toastIdCounter = 0

export const useUIStore = create<UIState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Modal actions
      openModal: (id, data) => {
        const modals = new Map(get().modals)
        modals.set(id, { id, isOpen: true, data })
        set({ modals })
      },

      closeModal: (id) => {
        const modals = new Map(get().modals)
        const modal = modals.get(id)
        if (modal) {
          modals.set(id, { ...modal, isOpen: false })
          set({ modals })
        }
      },

      isModalOpen: (id) => {
        return get().modals.get(id)?.isOpen ?? false
      },

      getModalData: (id) => {
        return get().modals.get(id)?.data
      },

      // Toast actions
      addToast: (toast) => {
        const id = `toast-${++toastIdCounter}`
        const newToast = { ...toast, id }
        set({ toasts: [...get().toasts, newToast] })
        
        // Auto-remove after duration
        if (toast.duration !== 0) {
          setTimeout(() => {
            get().removeToast(id)
          }, toast.duration || 5000)
        }
        
        return id
      },

      removeToast: (id) => {
        set({ toasts: get().toasts.filter(t => t.id !== id) })
      },

      clearToasts: () => {
        set({ toasts: [] })
      },

      // Loading actions
      setGlobalLoading: (loading) => {
        set({ globalLoading: loading })
      },

      setLoading: (key, loading) => {
        const loadingStates = new Map(get().loadingStates)
        if (loading) {
          loadingStates.set(key, true)
        } else {
          loadingStates.delete(key)
        }
        set({ loadingStates })
      },

      isLoading: (key) => {
        return get().loadingStates.get(key) ?? false
      },

      // Search & Filter actions
      setSearchQuery: (query) => {
        set({ searchQuery: query })
      },

      setFilter: (key, value) => {
        const filters = new Map(get().filters)
        filters.set(key, value)
        set({ filters })
      },

      removeFilter: (key) => {
        const filters = new Map(get().filters)
        filters.delete(key)
        set({ filters })
      },

      clearFilters: () => {
        set({ filters: new Map() })
      },

      getFilter: (key) => {
        return get().filters.get(key)
      },

      // Sidebar actions
      toggleSidebar: () => {
        set({ sidebarOpen: !get().sidebarOpen })
      },

      setSidebarOpen: (open) => {
        set({ sidebarOpen: open })
      },

      // Reset
      reset: () => set(initialState),
    }),
    { name: 'UIStore' }
  )
)
