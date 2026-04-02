'use client'

import { useEffect } from 'react'

/**
 * Clears accumulated stale Supabase session chunk cookies from the browser.
 * Place in app/layout.tsx as <CookieCleaner /> inside <body>.
 * Safe to leave permanently — no-op once cookies are clean.
 */
export default function CookieCleaner() {
  useEffect(() => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
      const ref = url.replace('https://', '').split('.')[0]
      if (!ref) return

      const prefix = `sb-${ref}-auth-token`
      const allCookies = document.cookie.split(';').map(c => c.trim())

      // Find chunk cookies (sb-ref-auth-token.0, .1, etc) — NOT the main token
      const chunks = allCookies
        .map(c => c.split('=')[0].trim())
        .filter(name => name.startsWith(prefix + '.'))

      if (chunks.length === 0) return

      // Delete each stale chunk
      chunks.forEach(name => {
        document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax; Secure`
        document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`
      })

      // If more than 2 chunks existed, force a full session refresh
      // so the browser gets a clean single cookie set
      if (chunks.length > 2 && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    } catch {
      // Never crash the app for cookie cleanup
    }
  }, [])

  return null
}
