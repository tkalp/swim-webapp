// components/ui/Modal.tsx
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

type Props = {
  isOpen: boolean
  onClose: () => void
  title: string | React.ReactNode
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  closeOnEscape?: boolean
  closeOnBackdrop?: boolean
  showCloseButton?: boolean
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnEscape = true,
  closeOnBackdrop = true,
  showCloseButton = true
}: Props) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  // Handle opening animation
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      // Small delay to ensure the modal is rendered before animation starts
      const timer = setTimeout(() => setIsAnimating(true), 10)
      return () => clearTimeout(timer)
    } else {
      setIsAnimating(false)
      // Wait for animation to complete before hiding
      const timer = setTimeout(() => setIsVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    if (!closeOnEscape || !isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, closeOnEscape, onClose])

  // Handle body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose()
    }
  }

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl'
  }

  if (!isVisible) return null

  return createPortal(
    <div
      className={`fixed inset-0 z-9999 flex items-center justify-center p-4 transition-all duration-300 ${
        isAnimating
          ? 'bg-black/60 backdrop-blur-md'
          : 'bg-black/0 backdrop-blur-none'
      }`}
      onClick={handleBackdropClick}
    >
      <div
        className={`relative bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-800/60 shadow-2xl w-full ${
          sizeClasses[size]
        } transition-all duration-300 transform ${
          isAnimating
            ? 'scale-100 opacity-100 translate-y-0'
            : 'scale-95 opacity-0 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle gradient glow */}
        <div className="absolute -inset-px bg-linear-to-br from-cyan-500/10 via-blue-500/5 to-purple-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -z-10" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/60">
          <h2 className="text-xl font-bold bg-linear-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
            {title}
          </h2>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="group w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-slate-600/50 text-slate-400 hover:text-white transition-all duration-200 hover:scale-110"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* Modal Content */}
        <div className="px-6 py-5">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}