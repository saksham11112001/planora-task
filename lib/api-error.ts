/**
 * api-error.ts
 * Central error sanitizer — keeps raw DB/Supabase messages out of the UI.
 *
 * Usage:
 *   import { friendlyError } from '@/lib/api-error'
 *   if (error) return NextResponse.json({ error: friendlyError(error, 'tasks') }, { status: 500 })
 */

type AnyError = { message?: string } | string | unknown

/**
 * Translates a raw Supabase / PostgREST / JS error into a short, user-friendly
 * sentence. The original message is always console.error'd server-side so
 * engineers can diagnose issues without leaking internals to users.
 */
export function friendlyError(err: AnyError, context = 'api'): string {
  const raw = typeof err === 'string' ? err : (err as any)?.message ?? ''
  console.error(`[${context}] ${raw}`)

  const msg = raw.toLowerCase()

  // ── Supabase / PostgREST patterns ──────────────────────────────────────────
  if (msg.includes('duplicate key') || msg.includes('already exists') || msg.includes('unique constraint'))
    return 'This record already exists. Please check for duplicates and try again.'

  if (msg.includes('violates foreign key') || msg.includes('foreign key constraint'))
    return 'This action references data that no longer exists. Please refresh and try again.'

  if (msg.includes('violates not-null') || msg.includes('null value in column'))
    return 'Some required fields are missing. Please fill in all required fields and try again.'

  if (msg.includes('violates check constraint'))
    return 'One of the values entered is not allowed. Please review your input and try again.'

  if (msg.includes('row-level security') || msg.includes('rls') || msg.includes('permission denied'))
    return 'You don\'t have permission to perform this action.'

  if (msg.includes('pgrst116') || msg.includes('json object requested') || msg.includes('coerce the result'))
    return 'Something went wrong while loading data. Please refresh and try again.'

  if (msg.includes('relation') && msg.includes('does not exist'))
    return 'An unexpected database error occurred. Please contact support.'

  if (msg.includes('connection') || msg.includes('timeout') || msg.includes('econnrefused'))
    return 'A connection error occurred. Please check your internet connection and try again.'

  if (msg.includes('jwt') || msg.includes('token') || msg.includes('expired'))
    return 'Your session has expired. Please sign in again.'

  if (msg.includes('invalid input syntax') || msg.includes('invalid uuid'))
    return 'An invalid value was provided. Please try again.'

  if (msg.includes('storage') || msg.includes('mime type') || msg.includes('bucket'))
    return 'File upload failed. Please check the file type and size, then try again.'

  if (msg.includes('rate limit') || msg.includes('too many requests'))
    return 'Too many requests. Please wait a moment and try again.'

  // ── Supabase Auth patterns ──────────────────────────────────────────────────
  if (msg.includes('user already registered') || msg.includes('already been registered'))
    return 'This email is already registered in the system.'

  if (msg.includes('email not confirmed'))
    return 'This email address has not been confirmed yet. Please check your inbox.'

  if (msg.includes('invalid login credentials') || msg.includes('invalid email or password'))
    return 'Incorrect email or password. Please try again.'

  // ── Generic fallback ───────────────────────────────────────────────────────
  return 'Something went wrong. Please try again or contact support if the problem persists.'
}

/**
 * Convenience: returns a NextResponse-ready JSON body.
 * The status is left to the caller so HTTP semantics stay correct.
 *
 * Example:
 *   if (error) return NextResponse.json(dbError(error, 'tasks'), { status: 500 })
 */
export function dbError(err: AnyError, context = 'api') {
  return { error: friendlyError(err, context) }
}
