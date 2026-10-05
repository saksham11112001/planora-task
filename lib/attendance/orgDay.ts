import type { SupabaseClient } from '@supabase/supabase-js'
import { todayInCountry, DEFAULT_COUNTRY } from '@/lib/locale/countries'

/**
 * "Today" for an org, as YYYY-MM-DD in that org's own timezone.
 *
 * This matters more than it looks. A check-in at 9pm in Asia/Kolkata is
 * 15:30 UTC the SAME day, but a check-in at 6am IST is 00:30 UTC the same
 * day while a check-in at 11:30pm IST is 18:00 UTC — and any naive use of
 * `new Date().toISOString().slice(0,10)` on a server running in UTC files
 * late-evening check-ins in Australia or New Zealand under the wrong day.
 * The unique index is on (user_id, work_date), so a wrong work_date does not
 * merely mislabel a row, it lets a second row exist for the same day.
 *
 * Country is read from org_settings.locale.country, the same place
 * /api/settings/locale reads it, falling back to IN.
 */
export async function orgToday(admin: SupabaseClient, orgId: string): Promise<string> {
  const { data } = await admin.from('org_settings')
    .select('locale').eq('org_id', orgId).maybeSingle()

  const country = (data as { locale?: { country?: string } } | null)?.locale?.country
  return todayInCountry(country ?? DEFAULT_COUNTRY)
}
