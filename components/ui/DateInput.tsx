'use client'
import { useState, useEffect } from 'react'

interface Props {
  value:        string   // YYYY-MM-DD or ''
  onChange:     (v: string) => void
  onBlur?:      (e: React.FocusEvent<HTMLInputElement>) => void
  onClick?:     (e: React.MouseEvent<HTMLInputElement>) => void
  disabled?:    boolean
  readOnly?:    boolean
  style?:       React.CSSProperties
  className?:   string
  placeholder?: string
}

function toDisplay(iso: string): string {
  if (!iso || iso.length !== 10) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return ''
  return `${d}-${m}-${y}`
}

function toISO(display: string): string {
  const match = display.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (!match) return ''
  const [, d, m, y] = match
  const dd = d.padStart(2, '0'), mm = m.padStart(2, '0')
  const iso = `${y}-${mm}-${dd}`
  const dt = new Date(iso + 'T00:00:00')
  if (isNaN(dt.getTime()) || dt.getFullYear() !== parseInt(y, 10)) return ''
  return iso
}

export function DateInput({ value, onChange, onBlur: onBlurProp, onClick, disabled, readOnly, style, className, placeholder = 'dd-mm-yyyy' }: Props) {
  const [text, setText] = useState(() => toDisplay(value))
  const [lastISO, setLastISO] = useState(value)

  useEffect(() => {
    if (value !== lastISO) {
      setText(toDisplay(value))
      setLastISO(value)
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (disabled || readOnly) return
    const digits = e.target.value.replace(/\D/g, '')
    if (digits.length > 8) return

    let formatted = digits
    if (digits.length > 2) formatted = digits.slice(0, 2) + '-' + digits.slice(2)
    if (digits.length > 4) formatted = digits.slice(0, 2) + '-' + digits.slice(2, 4) + '-' + digits.slice(4)

    setText(formatted)
    const iso = toISO(formatted)
    setLastISO(iso)
    onChange(iso)
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (!toISO(text)) setText(toDisplay(lastISO))
    onBlurProp?.(e)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      onClick={onClick}
      placeholder={placeholder}
      maxLength={10}
      disabled={disabled}
      readOnly={readOnly}
      className={className}
      style={style}
    />
  )
}
