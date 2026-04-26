/**
 * Reusable button with primary/secondary/destructive variants.
 * Uses CSS custom properties from tokens.css.
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive'
  size?: 'sm' | 'md'
  icon?: ReactNode
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: [
    'bg-[var(--color-accent)]',
    'text-white',
    'hover:bg-[var(--color-accent-hover)]'
  ].join(' '),
  secondary: [
    'bg-[var(--color-surface)]',
    'text-[var(--color-text-primary)]',
    'border',
    'border-[var(--color-border)]',
    'hover:bg-[var(--color-border)]'
  ].join(' '),
  destructive: [
    'bg-[var(--color-destructive)]',
    'text-white',
    'hover:opacity-90'
  ].join(' ')
}

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = 'primary', size = 'md', icon, className, children, disabled, ...rest },
    ref
  ) {
    const base = [
      'inline-flex items-center justify-center',
      'font-medium rounded-md',
      'transition-colors duration-150',
      'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed'
    ].join(' ')

    const classes = [
      base,
      variantStyles[variant],
      sizeStyles[size],
      icon && children ? 'gap-1.5' : '',
      className ?? ''
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <button ref={ref} className={classes} disabled={disabled} {...rest}>
        {icon}
        {children}
      </button>
    )
  }
)
