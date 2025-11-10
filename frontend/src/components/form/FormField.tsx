// components/form/FormField.tsx
import React from 'react'

type Props = {
  label?: string
  hint?: string
  required?: boolean
  children?: React.ReactNode
  className?: string
}

export default function FormField({ label, hint, required, children, className = '' }: Props) {
  return (
    <div className={`flex flex-col gap-2 mb-3 ${className}`.trim()}>
      {label && (
        <label className="text-[0.85rem] text-[var(--color-text-muted)] font-semibold">
          {label}
          {required && <span className="text-[var(--color-primary)] ml-1">*</span>}
        </label>
      )}
      <div className="w-full max-w-full">
        {children}
      </div>
      {hint && (
        <span className="text-[0.8rem] text-[var(--color-text-secondary)]">
          {hint}
        </span>
      )}
    </div>
  )
}