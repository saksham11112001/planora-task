'use client'
import { useEffect } from 'react'

/**
 * Removes html.dark class and forces light color-scheme on every mount/navigation.
 * The inline <script> in portal layouts handles SSR; this handles client-side navigation.
 */
export function ForceLightMode() {
  useEffect(() => {
    const el = document.documentElement
    el.classList.remove('dark')
    el.style.colorScheme = 'light'
    return () => { el.style.colorScheme = '' }
  }, [])
  return null
}
