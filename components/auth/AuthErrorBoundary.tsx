'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Intercepts fetch() and sends people to /login when their session is genuinely
 * gone, instead of leaving them on a broken page.
 *
 * WHY THIS DOES NOT ACT ON THE 401 ALONE
 *
 * It used to. One 401 from any API route redirected immediately, and that made
 * a transient failure indistinguishable from being signed out.
 *
 * Every API route ends in `getAuthUser(...)` -> `if (!user) return 401
 * Unauthorised`. getAuthUser returns null both when you are signed out AND
 * when Supabase Auth simply failed to answer — an error, a timeout, a rate
 * limit. So an Auth blip anywhere produces a 401 that looks exactly like an
 * expired session.
 *
 * The app fires dozens of requests a minute (Monitor and Calendar refresh on a
 * timer, panels prefetch several endpoints at once). At even a small Auth error
 * rate, somebody hits one within a few minutes — which is precisely the
 * reported symptom: signed out mid-task, sometimes inside five minutes, with a
 * session that was never actually invalid.
 *
 * So a 401 now only opens the question. /api/session-check answers it, from the
 * server's own view of the cookie, and eviction needs BOTH `conclusive` and
 * `authenticated: false`. If Auth is unreachable the check says so, and we
 * leave the person where they are — the worst case becomes one failed request
 * rather than losing their place.
 */
export function AuthErrorBoundary({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  // A burst of parallel requests can 401 together. Without this, each one fires
  // its own verification and its own redirect.
  const verifying = useRef(false)
  const evicted   = useRef(false)

  useEffect(() => {
    const origFetch = window.fetch

    async function confirmSignedOut(): Promise<boolean> {
      try {
        const res = await origFetch('/api/session-check', { cache: 'no-store' })
        if (!res.ok) return false          // cannot tell — do not evict
        const d = await res.json()
        return d?.conclusive === true && d?.authenticated === false
      } catch {
        return false                        // offline or blocked — do not evict
      }
    }

    window.fetch = async (...args) => {
      const res = await origFetch(...args)

      // Only our own API routes, and never the check itself — verifying a 401
      // by calling something that can also 401 would recurse.
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url ?? ''
      const isApiRoute = url.includes('/api/') && !url.includes('/api/session-check')

      if (isApiRoute && res.status === 401 && !verifying.current && !evicted.current) {
        const clone = res.clone()
        let looksLikeAuth = false
        try {
          const data = await clone.json()
          looksLikeAuth =
            data?.error === 'Unauthorised' || data?.error === 'No org' || data?.code === 'PGRST301'
        } catch { /* not JSON — leave it alone */ }

        if (looksLikeAuth) {
          verifying.current = true
          try {
            if (await confirmSignedOut()) {
              evicted.current = true
              console.warn('[auth] session confirmed gone — redirecting to login')
              router.push('/login?error=session_expired')
            } else {
              // The session is fine; this request lost a race with Auth.
              console.warn('[auth] 401 received but session still valid — ignoring')
            }
          } finally {
            verifying.current = false
          }
        }
      }

      return res
    }

    return () => { window.fetch = origFetch }
  }, [router])

  return <>{children}</>
}
