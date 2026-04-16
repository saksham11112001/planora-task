const AUTH_KEY  = process.env.MSG91_AUTH_KEY      ?? ''
const SENDER_ID = process.env.MSG91_WHATSAPP_SENDER_ID ?? ''
const BASE_URL  = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/'

export interface WaMessage {
  to:           string   // E.164 format e.g. +919876543210
  template_name: string
  variables:    string[] // positional template variables
}

/**
 * Send a WhatsApp message via MSG91 with exponential backoff retry.
 * Retries up to 3 times on network errors or non-success responses.
 * Returns true if delivered, false after all retries exhausted.
 */
export async function sendWhatsApp(msg: WaMessage): Promise<boolean> {
  if (!AUTH_KEY || !SENDER_ID) {
    console.warn('[WhatsApp] MSG91 not configured — skipping')
    return false
  }

  const body = {
    sender:    SENDER_ID,
    recipient: [{
      mobiles: msg.to.replace(/^\+/, ''),
      ...Object.fromEntries(msg.variables.map((v, i) => [`VAR${i + 1}`, v])),
    }],
    template_name: msg.template_name,
  }

  const MAX_ATTEMPTS = 3
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(BASE_URL, {
        method:  'POST',
        headers: { authkey: AUTH_KEY, 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        // Hard timeout per attempt — prevents indefinitely hanging requests
        signal:  AbortSignal.timeout(10_000),
      })

      const data = await res.json()

      if (data.type === 'success') return true

      // MSG91 returned a non-success response — may be retryable (rate limit)
      // or terminal (invalid template). Log and decide.
      console.error(`[WhatsApp] Send failed (attempt ${attempt}/${MAX_ATTEMPTS}):`, data)

      // Terminal errors — don't retry (wrong template name, invalid number, etc.)
      if (data.code === 'INVALID_TEMPLATE' || data.code === 'INVALID_MOBILE') {
        return false
      }

      lastError = data
    } catch (err) {
      // Network / timeout error — retryable
      console.error(`[WhatsApp] Network error (attempt ${attempt}/${MAX_ATTEMPTS}):`, err)
      lastError = err
    }

    // Exponential backoff: 500ms, 1000ms before attempts 2 and 3
    if (attempt < MAX_ATTEMPTS) {
      await new Promise(r => setTimeout(r, 500 * attempt))
    }
  }

  console.error('[WhatsApp] All retries exhausted. Last error:', lastError)
  return false
}
