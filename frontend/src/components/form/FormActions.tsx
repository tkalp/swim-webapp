// components/form/FormActions.tsx
import React from 'react'

type Props = {
  children?: React.ReactNode
  className?: string
}

export default function FormActions({ children, className = '' }: Props) {
  return (
    <div className={`flex gap-3 mt-2 ${className}`.trim()}>
      {children}
    </div>
  )
}