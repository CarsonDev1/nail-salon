import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Props {
  /** Amount in cents (3500 = $35.00) */
  value: number
  onChange: (cents: number) => void
  className?: string
  id?: string
  disabled?: boolean
}

const toText = (cents: number) => (cents ? (cents / 100).toFixed(2) : '')

/** Dollar input: type "35" or "35.50"; the value is reported in cents. */
export function MoneyInput({ value, onChange, className, id, disabled }: Props) {
  const [text, setText] = useState(() => toText(value))
  const focused = useRef(false)

  // Follow outside changes (e.g. a different bill) but never overwrite while the user is typing
  useEffect(() => {
    if (!focused.current) setText(toText(value))
  }, [value])

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
      <Input
        id={id}
        disabled={disabled}
        inputMode="decimal"
        placeholder="0.00"
        className={cn('pl-7 text-right', className)}
        value={text}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false
          setText(toText(value))
        }}
        onChange={(e) => {
          let s = e.target.value.replace(/[^\d.]/g, '')
          const dot = s.indexOf('.')
          if (dot >= 0) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '').slice(0, 2)
          setText(s)
          onChange(Math.round((parseFloat(s) || 0) * 100))
        }}
      />
    </div>
  )
}
