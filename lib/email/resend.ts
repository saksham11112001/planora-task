import { Resend } from 'resend'

const _resend = new Resend(process.env.RESEND_API_KEY!)
export const FROM = process.env.FROM_EMAIL ?? 'Floatup <noreply@floatup.app>'

// Proxy that short-circuits all sends when DISABLE_EMAILS=true
export const resend = {
  emails: {
    send: (payload: Parameters<typeof _resend.emails.send>[0]) => {
      if (process.env.DISABLE_EMAILS === 'true') {
        console.log('[email] DISABLE_EMAILS=true — suppressed:', payload.subject)
        return Promise.resolve({ data: null, error: null })
      }
      return _resend.emails.send(payload)
    },
  },
}
