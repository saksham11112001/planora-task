import { NextResponse }     from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * GET /call — public redirect to whoever's booking calendar.
 *
 * WHY THIS EXISTS RATHER THAN PRINTING THE CALENDLY LINK
 *   A printed QR code is permanent. Encoding cal.com/x or calendly.com/y
 *   directly means that changing scheduling tool, changing username, or the
 *   provider changing its URL format turns every flyer and standee already in
 *   circulation into dead paper. Pointing the QR at our own domain makes the
 *   destination an environment variable: change it once, every code ever
 *   printed keeps working.
 *
 *   It also means the scan lands on our own site first, so PostHog records it
 *   and the number of scans can be compared against the number of bookings.
 *
 * MULTIPLE CALENDARS
 *   /call            → BOOKING_URL
 *   /call?p=sachit   → BOOKING_URL_SACHIT, falling back to BOOKING_URL
 *
 *   One env var per person. Adding someone needs a redeploy, which is the
 *   right trade at this scale — it keeps the booking targets in version-
 *   controlled config rather than a database nobody remembers to check.
 *
 * UTM PASS-THROUGH
 *   Calendly and Cal.com both record utm_* parameters against the booking, so
 *   forwarding them means the calendar entry itself shows the meeting came
 *   from the BNI QR rather than from anywhere else.
 */

export const dynamic = 'force-dynamic'

/** Only A–Z, 0–9 and underscore, so the value can never escape the env-var
 *  name it is interpolated into. */
function envSuffix(raw: string | null): string | null {
  if (!raw) return null
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '')
  return cleaned.length > 0 && cleaned.length <= 32 ? cleaned : null
}

export async function GET(request: NextRequest) {
  const suffix     = envSuffix(request.nextUrl.searchParams.get('p'))
  const perPerson  = suffix ? process.env[`BOOKING_URL_${suffix}`] : undefined
  const bookingUrl = perPerson ?? process.env.BOOKING_URL ?? ''

  // Nothing configured yet, or a typo'd value. A QR in the wild must never
  // show an error page — send the scan somewhere real and complain in the log.
  let target: URL
  try {
    target = new URL(bookingUrl)
    if (target.protocol !== 'https:' && target.protocol !== 'http:') throw new Error('bad protocol')
  } catch {
    console.error('[call] BOOKING_URL missing or not a valid absolute URL — falling back to the MSME landing page')
    return NextResponse.redirect(new URL('/msme-landing', request.url), {
      status:  307,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  // Carry campaign attribution through to the booking record.
  for (const [key, value] of request.nextUrl.searchParams) {
    if (key === 'p') continue
    if (key.startsWith('utm_')) target.searchParams.set(key, value)
  }

  // 307, never 301: browsers cache a permanent redirect indefinitely, so a
  // wrong destination shipped once would stick on scanners' devices even after
  // the env var was corrected.
  return NextResponse.redirect(target, {
    status:  307,
    headers: { 'Cache-Control': 'no-store' },
  })
}
