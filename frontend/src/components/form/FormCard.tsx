// components/form/FormCard.tsx
import React from 'react'

type Props = {
  title?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

export default function FormCard({ title, children, className = '' }: Props) {
  return (
    <div className={`bg-[var(--color-background-elevated)] border border-[var(--color-border)] rounded-2xl p-5 shadow-[0_12px_40px_rgba(3,10,18,0.65)] w-full ${className}`.trim()}>
      {title && (
        <div className="text-base font-bold text-[var(--color-text-primary)] mb-3">
          {title}
        </div>
      )}
      <div>{children}</div>
    </div>
  )
}