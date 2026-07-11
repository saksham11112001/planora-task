// Public one-click unsubscribe for engagement/marketing emails.
// Link format: /api/marketing/unsubscribe?u=<userId>&s=<hmac(userId)>
// HMAC-signed so nobody can unsubscribe someone else by guessing IDs.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { marketingUnsubSig }          from '@/lib/email/marketingToken'
import crypto                        from 'crypto'

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get('u') ?? ''
  const s = req.nextUrl.searchParams.get('s') ?? ''

  const expected = marketingUnsubSig(u)
  const ok = s.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected))

  if (!u || !ok) {
    return new NextResponse(page('Invalid link', 'This unsubscribe link is invalid or has been tampered with.'), {
      status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const admin = createAdminClient()
  await admin.from('users').update({ marketing_opt_out: true }).eq('id', u)

  return new NextResponse(page('You\'re unsubscribed', 'You will no longer receive tips and insights emails from upFloat. Task, approval and compliance notifications are unaffected.'), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function page(title: string, msg: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="text-align:center;max-width:420px;padding:0 24px">
    <div style="font-size:44px;margin-bottom:14px">📭</div>
    <h1 style="font-size:20px;font-weight:800;color:#0f172a;margin:0 0 8px">${title}</h1>
    <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0">${msg}</p>
  </div>
</body></html>`
}
