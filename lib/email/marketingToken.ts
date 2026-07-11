// HMAC signature for one-click marketing unsubscribe links.
// Lives in lib/ (not the route file) because route files may only export handlers.
import crypto from 'crypto'

function secret() {
  return process.env.EMAIL_ACTION_SECRET ?? 'upfloat-email-action-dev-secret'
}

export function marketingUnsubSig(userId: string): string {
  return crypto.createHmac('sha256', secret()).update(`mkt-unsub:${userId}`).digest('base64url')
}

export function marketingUnsubUrl(userId: string): string {
  const app = process.env.NEXT_PUBLIC_APP_URL ?? 'https://upfloat.co'
  return `${app}/api/marketing/unsubscribe?u=${encodeURIComponent(userId)}&s=${marketingUnsubSig(userId)}`
}
