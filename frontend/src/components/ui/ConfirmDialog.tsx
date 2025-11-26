// components/ui/ConfirmDialog.tsx
import { AlertTriangle, Trash2, AlertCircle, Info } from 'lucide-react'
import Modal from '@/components/ui/Modal'

type ConfirmDialogProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  loading?: boolean
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false
}: ConfirmDialogProps) {
  const handleConfirm = async () => {
    await onConfirm()
    if (!loading) {
      onClose()
    }
  }

  const variantStyles = {
    danger: {
      icon: Trash2,
      iconBg: 'bg-red-500/20 border-red-500/30',
      iconColor: 'text-red-400',
      alertBg: 'bg-red-500/10 border-red-500/30',
      buttonBg: 'bg-linear-to-r from-red-500 to-red-600',
      buttonHoverBg: 'bg-linear-to-r from-red-400 to-red-500'
    },
    warning: {
      icon: AlertTriangle,
      iconBg: 'bg-orange-500/20 border-orange-500/30',
      iconColor: 'text-orange-400',
      alertBg: 'bg-orange-500/10 border-orange-500/30',
      buttonBg: 'bg-linear-to-r from-orange-500 to-orange-600',
      buttonHoverBg: 'bg-linear-to-r from-orange-400 to-orange-500'
    },
    info: {
      icon: Info,
      iconBg: 'bg-cyan-500/20 border-cyan-500/30',
      iconColor: 'text-cyan-400',
      alertBg: 'bg-cyan-500/10 border-cyan-500/30',
      buttonBg: 'bg-linear-to-r from-cyan-500 to-blue-500',
      buttonHoverBg: 'bg-linear-to-r from-cyan-400 to-blue-400'
    }
  }

  const style = variantStyles[variant]
  const Icon = style.icon

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="md"
    >
      <div className="space-y-5">
        <div className={`flex items-center gap-3 p-4 ${style.alertBg} border rounded-xl`}>
          <div className={`w-10 h-10 rounded-lg ${style.iconBg} border flex items-center justify-center shrink-0`}>
            <Icon size={20} className={style.iconColor} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              {variant === 'danger' ? 'This action cannot be undone' : 'Please confirm'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {message}
            </p>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-slate-600/50 text-slate-400 hover:text-white rounded-xl font-semibold transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="group relative flex-1 px-4 py-3 text-white rounded-xl font-semibold transition-all duration-300 hover:scale-[1.02] disabled:hover:scale-100 disabled:cursor-not-allowed overflow-hidden disabled:opacity-50"
          >
            <div className={`absolute inset-0 ${style.buttonBg}`} />
            <div className={`absolute inset-0 ${style.buttonHoverBg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
            <span className="relative">{loading ? 'Processing...' : confirmText}</span>
          </button>
        </div>
      </div>
    </Modal>
  )
}
