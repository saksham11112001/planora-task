// TEMPORARY — verify Sentry is receiving events, then DELETE this file.
// Visit  /api/debug-sentry?test=upfloat  to send one test error to Sentry.
// (Serverless functions freeze after responding, so we MUST await flush()
//  or the event never leaves the function.)
import { NextResponse }  from 'next/server'
import * as Sentry       from '@sentry/nextjs'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  if (url.searchParams.get('test') !== 'upfloat') {
    return NextResponse.json({ ok: true, hint: 'add ?test=upfloat to send a Sentry test event' })
  }

  const dsnConfigured = !!process.env.NEXT_PUBLIC_SENTRY_DSN

  Sentry.captureException(new Error(`Sentry verification event — ${new Date().toISOString()}`))
  await Sentry.flush(3000)   // ensure the event is sent before the function ends

  return NextResponse.json({
    sent: dsnConfigured,
    dsn_configured: dsnConfigured,
    note: dsnConfigured
      ? 'Check Sentry → Issues in ~30s. Then delete this route.'
      : 'NEXT_PUBLIC_SENTRY_DSN is NOT set in this deployment — nothing was sent.',
  })
}
