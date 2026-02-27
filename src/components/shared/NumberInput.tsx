'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  value: number | string
  onChange: (value: number) => void
  decimals?: number
  className?: string
}

/**
 * Number input with TND-style 3-decimal precision.
 * Validates and rounds to the specified number of decimal places.
 */
export const NumberInput = forwardRef<HTMLInputElement, Props>(
  function NumberInput({ value, onChange, decimals = 3, className, ...rest }, ref) {
    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value
      if (raw === '' || raw === '-') { onChange(0); return }
      const n = parseFloat(raw)
      if (!isNaN(n)) {
        const factor = Math.pow(10, decimals)
        onChange(Math.round(n * factor) / factor)
      }
    }

    return (
      <input
        ref={ref}
        type="number"
        step={decimals === 3 ? '0.001' : decimals === 2 ? '0.01' : '1'}
        value={value}
        onChange={handleChange}
        className={cn(
          'bg-[#0a0b0f] border border-[#1a1b22] rounded-lg px-3 py-2 text-sm text-white',
          'placeholder-gray-600 focus:outline-none focus:border-[#d4a843] transition-colors',
          'font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
          className
        )}
        {...rest}
      />
    )
  }
)
