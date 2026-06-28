'use client'
import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const CONSENT_KEY = 'upfloat_cookie_consent'

let phInitialised = false

function initPostHog() {
  if (phInitialised) return
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return
  import('posthog-js').then(({ default: posthog }) => {
    posthog.init(key, {
      api_host:        process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: false, // manual below
      persistence:     'localStorage+cookie',
    })
    phInitialised = true
  })
}

// Call this from anywhere after consent is granted
export function grantAnalyticsConsent() {
  if (typeof window === 'undefined') return
  localStorage.setItem(CONSENT_KEY, 'accepted')
  initPostHog()
  window.dispatchEvent(new Event('posthog:ready'))
}

export function revokeAnalyticsConsent() {
  if (typeof window === 'undefined') return
  localStorage.setItem(CONSENT_KEY, 'declined')
}

export function hasAnalyticsConsent(): boolean | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(CONSENT_KEY)
  if (stored === 'accepted') return true
  if (stored === 'declined') return false
  return null
}

// Tracks a posthog event if posthog is loaded
export function trackEvent(event: string, props?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  import('posthog-js').then(({ default: posthog }) => {
    if (posthog.__loaded) posthog.capture(event, props)
  })
}

// Identifies the current user in posthog
export function identifyUser(id: string, traits?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  import('posthog-js').then(({ default: posthog }) => {
    if (posthog.__loaded) posthog.identify(id, traits)
  })
}

export function PostHogPageTracker() {
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const lastUrl      = useRef('')

  // Init posthog if consent already given on a previous visit
  useEffect(() => {
    if (hasAnalyticsConsent() === true) initPostHog()
  }, [])

  // Track pageviews manually so we control when they fire
  useEffect(() => {
    const url = pathname + (searchParams.toString() ? `?${searchParams}` : '')
    if (url === lastUrl.current) return
    lastUrl.current = url
    import('posthog-js').then(({ default: posthog }) => {
      if (posthog.__loaded) posthog.capture('$pageview', { $current_url: window.location.href })
    })
  }, [pathname, searchParams])

  return null
}
