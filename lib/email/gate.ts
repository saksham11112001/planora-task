import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Returns true if this user has NOT received THIS TYPE of email today.
 * Uses (user_id, event_type, sent_date) as the unique key.
 *
 * This means: one task_assigned email per day, one approval email per day,
 * one comment email per day — they do NOT block each other.
 *
 * For daily reminders (event_type = 'daily_reminder'), still one per day total.
 */
export async function acquireEmailSlot(
  userId: string,
  eventType: string = 'general'
): Promise<boolean> {
  const admin = createAdminClient()
  // IST date: UTC+5:30
  const nowIST   = new Date(Date.now() + 5.5 * 3600 * 1000)
  const todayIST = nowIST.toISOString().split('T')[0]

  // Try to insert — unique constraint on (user_id, event_type, sent_date)
  const { error } = await admin.from('email_daily_log').insert({
    user_id:    userId,
    event_type: eventType,
    sent_date:  todayIST,
  })

  if (error) {
    if (error.code === '23505') return false  // already sent this event type today
    console.warn('[email-gate] DB error, allowing send:', error.message)
    return true  // fail open — better to send than silently drop
  }

  return true
}
