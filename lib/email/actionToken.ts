import crypto from 'crypto'

// 7-day expiry for email action tokens
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

export type EmailAction = 'complete' | 'submit' | 'approve' | 'reject'

interface TokenPayload {
  taskId: string
  userId: string
  action: EmailAction
  exp:    number
}

function secret() {
  return process.env.EMAIL_ACTION_SECRET ?? 'upfloat-email-action-dev-secret'
}

function b64url(s: string) {
  return Buffer.from(s).toString('base64url')
}

function hmac(payload: string) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function generateActionToken(taskId: string, userId: string, action: EmailAction): string {
  const payload = b64url(JSON.stringify({ taskId, userId, action, exp: Date.now() + EXPIRY_MS }))
  return `${payload}.${hmac(payload)}`
}

export function verifyActionToken(token: string): TokenPayload {
  const dot = token.lastIndexOf('.')
  if (dot < 0) throw new Error('malformed token')

  const payload  = token.slice(0, dot)
  const sig      = Buffer.from(token.slice(dot + 1), 'base64url')
  const expected = Buffer.from(hmac(payload), 'base64url')

  if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) {
    throw new Error('invalid signature')
  }

  const data: TokenPayload = JSON.parse(Buffer.from(payload, 'base64url').toString())
  if (data.exp < Date.now()) throw new Error('expired')
  return data
}
