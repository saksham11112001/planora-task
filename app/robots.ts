import type { MetadataRoute } from 'next'

/**
 * The previous version of this file disallowed '/(app)/'.
 *
 * That rule matched nothing. Parentheses in the App Router mark a *route
 * group*, which organises files on disk and is stripped out of the URL —
 * app/(app)/dashboard/page.tsx serves at /dashboard, never at /(app)/dashboard.
 * So every authenticated route was in fact fully crawlable.
 *
 * In practice Google could not read any of them (they redirect to /login
 * without a session), but it could and did index them as thin redirect pages
 * under upfloat.co. The list below names the real URL prefixes.
 */

/** Authenticated app sections — real URL prefixes under app/(app)/. */
const APP_ROUTES = [
  '/dashboard', '/tasks', '/calendar', '/clients', '/compliance', '/projects',
  '/recurring', '/reports', '/settings', '/team', '/time', '/inbox',
  '/invoices', '/monitor', '/activity', '/approvals', '/import', '/profile',
  '/walkthrough', '/partner',
  // Feature-gated pages. Listed here even though the features ship off by
  // default: robots.txt may name a path that does not exist yet, and the
  // alternative is remembering to come back here the day someone switches
  // the feature on — which is exactly how /dashboard ended up crawlable.
  '/attendance', '/leads', '/notices',
]

/**
 * Token-bearing and transactional URLs. These must never be indexed: the
 * token IS the credential, so an indexed client-portal link is an open door,
 * and a crawled /task-action link would action a task.
 */
const PRIVATE_ROUTES = [
  '/portal/',          // client magic-link portal
  '/msme/form/',       // vendor magic-link form
  '/task-action',      // one-click task actions from email
  '/auth/',
  '/onboarding',
  '/coupons/',
  '/msme/admin',
  '/partners/dashboard',
  '/partners/login',
  '/partners/join',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', ...APP_ROUTES, ...PRIVATE_ROUTES],
      },
    ],
    sitemap: 'https://upfloat.co/sitemap.xml',
    host:    'https://upfloat.co',
  }
}
