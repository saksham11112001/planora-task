import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Returns true if this user has NOT been emailed today yet, and records the send.
 * Returns false if they have already received an email today → caller should skip.
 *
 * Uses a simple date-keyed log table. One email max per user per calendar day (IST).
 */
export async function acquireEmailSlot(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  // IST date: UTC+5:30
  const nowIST  = new Date(Date.now() + 5.5 * 3600 * 1000)
  const todayIST = nowIST.toISOString().split('T')[0]

  // Try to insert — if user already has a row for today, unique constraint fires → error
  const { error } = await admin.from('email_daily_log').insert({
    user_id:   userId,
    sent_date: todayIST,
  })

  if (error) {
    // Unique violation = already sent today
    if (error.code === '23505') return false
    // Any other DB error → allow send (fail open, better to send than drop)
    console.warn('[email-gate] DB error, allowing send:', error.message)
    return true
  }

  return true  // Insert succeeded → slot acquired, send the email
}
