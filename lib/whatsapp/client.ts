const AUTH_KEY  = process.env.MSG91_AUTH_KEY      ?? ''
const SENDER_ID = process.env.MSG91_WHATSAPP_SENDER_ID ?? ''
const BASE_URL  = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/'

export interface WaMessage {
  to:           string   // E.164 format e.g. +919876543210
  template_name: string
  variables:    string[] // positional template variables
}

export async function sendWhatsApp(msg: WaMessage): Promise<boolean> {
  if (!AUTH_KEY || !SENDER_ID) {
    console.warn('[WhatsApp] MSG91 not configured — skipping')
    return false
  }

  try {
    const body = {
      sender:    SENDER_ID,
      recipient: [{
        mobiles: msg.to.replace(/^\+/, ''),
        // Variables are passed as VAR1, VAR2... based on MSG91 template
        ...Object.fromEntries(msg.variables.map((v, i) => [`VAR${i + 1}`, v])),
      }],
      template_name: msg.template_name,
    }

    const res = await fetch(BASE_URL, {
      method:  'POST',
      headers: { authkey: AUTH_KEY, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })

    const data = await res.json()
    if (data.type === 'success') return true

    console.error('[WhatsApp] Send failed:', data)
    return false
  } catch (err) {
    console.error('[WhatsApp] Network error:', err)
    return false
  }
}
