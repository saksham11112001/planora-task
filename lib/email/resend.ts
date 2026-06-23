/**
 * Email sender — backed by Brevo (formerly Sendinblue) transactional API.
 * Exports the same `resend.emails.send` interface as before so no other
 * file needs to change.
 *
 * Required env var:
 *   BREVO_API_KEY  — from Brevo Dashboard → SMTP & API → API Keys
 *
 * Optional:
 *   FROM_EMAIL     — "Display Name <email@domain.com>"  (default shown below)
 *   DISABLE_EMAILS — set to "true" to suppress all sends (useful in dev)
 */

export const FROM = process.env.FROM_EMAIL ?? 'upFloat <noreply@upfloat.co>'

type SendPayload = {
  from: string
  to: string | string[]
  cc?: string | string[]
  subject: string
  html?: string
  text?: string
}

function parseAddress(addr: string): { email: string; name?: string } {
  // Accepts "Display Name <email@example.com>" or plain "email@example.com"
  const match = addr.match(/^(.+?)\s*<(.+?)>$/)
  if (match) return { name: match[1].trim(), email: match[2].trim() }
  return { email: addr.trim() }
}

function toList(val: string | string[]): { email: string; name?: string }[] {
  const arr = Array.isArray(val) ? val : [val]
  return arr.map(parseAddress)
}

async function brevoSend(payload: SendPayload): Promise<{ data: null; error: string | null }> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) {
    console.error('[email] BREVO_API_KEY is not set — email not sent:', payload.subject)
    return { data: null, error: 'BREVO_API_KEY not configured' }
  }

  const body: Record<string, unknown> = {
    sender:  parseAddress(payload.from),
    to:      toList(payload.to),
    subject: payload.subject,
  }
  if (payload.html)  body.htmlContent = payload.html
  if (payload.text)  body.textContent = payload.text
  if (payload.cc)    body.cc = toList(payload.cc)

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method:  'POST',
    headers: {
      'api-key':      apiKey,
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    console.error(`[email] Brevo send failed (${res.status}):`, text)
    return { data: null, error: text }
  }

  return { data: null, error: null }
}

// Proxy that short-circuits all sends when DISABLE_EMAILS=true.
// Same shape as the old resend proxy so all callers are unaffected.
export const resend = {
  emails: {
    send: (payload: SendPayload) => {
      if (process.env.DISABLE_EMAILS === 'true') {
        console.log('[email] DISABLE_EMAILS=true — suppressed:', payload.subject)
        return Promise.resolve({ data: null, error: null })
      }
      return brevoSend(payload)
    },
  },
}
