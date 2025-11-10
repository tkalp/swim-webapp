import React from 'react'

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export default function TextArea({ className = '', ...props }: Props) {
  return (
    <textarea
      className={`w-full max-w-full box-border px-3.5 py-3 bg-[var(--color-background-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-xl text-base font-medium transition-all focus:outline-none focus:border-[var(--color-primary)] focus:shadow-[0_6px_20px_rgba(49,151,167,0.12)] placeholder:text-[var(--color-text-secondary)] placeholder:opacity-70 disabled:opacity-50 disabled:cursor-not-allowed min-h-[100px] resize-vertical ${className}`.trim()}
      {...props}
    />
  )
}