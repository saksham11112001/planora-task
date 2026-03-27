'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Intercepts all fetch() calls globally.
 * If any API call returns 401 (session expired/invalid), redirects to /login
 * instead of leaving the user on a broken/blank page.
 */
export function AuthErrorBoundary({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    const origFetch = window.fetch

    window.fetch = async (...args) => {
      try {
        const res = await origFetch(...args)

        // Only intercept our own API routes
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url ?? ''
        const isApiRoute = url.startsWith('/api/') || url.includes('/api/')

        if (isApiRoute && res.status === 401) {
          const clone = res.clone()
          try {
            const data = await clone.json()
            if (data?.error === 'Unauthorised' || data?.error === 'No org' || data?.code === 'PGRST301') {
              console.warn('[auth] Session expired — redirecting to login')
              router.push('/login?error=session_expired')
            }
          } catch {}
        }

        return res
      } catch (err) {
        throw err
      }
    }

    return () => { window.fetch = origFetch }
  }, [router])

  return <>{children}</>
}
