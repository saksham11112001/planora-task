import { inngest }           from '../client'
import { createAdminClient } from '@/lib/supabase/admin'
import { resend, FROM }      from '@/lib/email/resend'
import { superAdminEmails }  from '@/lib/utils/superAdmin'

/**
 * Weekly usage report for super admins — Monday 09:00 IST.
 *
 * Answers the question the product could not answer before: who is actually
 * using this, and who stopped. It reads users.last_seen_at, written by
 * /api/heartbeat, because activity_log only records writes and would have
 * counted every read-only user as gone.
 *
 * The number that matters is WENT QUIET THIS WEEK — people last seen 7 to 14
 * days ago. Those are the ones worth a phone call: recently active, so the
 * account is real and the contact is warm, but they have missed a full week.
 * Someone dark for two months is a different, colder problem, and mixing the
 * two produces a list nobody works through.
 *
 * Users never seen at all are counted separately rather than folded into
 * "dormant". Every row starts NULL when the column ships, so folding them in
 * would report the entire user base as dead in week one.
 *
 * Never throws: a reporting job must not take down the Inngest run.
 */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const DAY = 86400000

interface QuietUser {
  name:      string
  email:     string
  orgName:   string
  lastSeen:  string | null
}

export const weeklyUsageReport = inngest.createFunction(
  { id: 'weekly-usage-report', name: 'Weekly usage report for super admins', concurrency: { limit: 1 } },
  { cron: 'TZ=Asia/Kolkata 0 9 * * 1' },
  async ({ step }) => {
    const to = superAdminEmails()
    if (!to.length) return { skipped: 'no super admins configured' }

    const admin = createAdminClient()
    const now   = Date.now()
    // Compared as epoch milliseconds, never as strings. Postgres renders
    // timestamptz as "…+00:00" while Date.toISOString() ends in "Z", so a
    // lexicographic compare of the two formats diverges at the offset
    // character and misclassifies rows that land on the boundary.
    const d7    = now - 7  * DAY
    const d14   = now - 14 * DAY

    const stats = await step.run('gather', async () => {
      // Only people who belong to an organisation. Someone who created a login
      // and never onboarded is a signup-funnel problem, not a usage one, and
      // counting them here would make retention look worse than it is.
      const { data: members } = await admin
        .from('org_members')
        .select('user_id, org_id, organisations(name), users(id, name, email, last_seen_at)')
        .eq('is_active', true)
        .limit(5000)

      // One person can belong to several orgs — count people, not memberships.
      const byUser = new Map<string, { name: string; email: string; lastSeen: string | null; orgs: string[] }>()
      for (const m of members ?? []) {
        const u = (m as any).users
        if (!u?.id) continue
        const orgName = ((m as any).organisations?.name ?? '').trim() || 'Unknown org'
        const entry = byUser.get(u.id)
        if (entry) { entry.orgs.push(orgName); continue }
        byUser.set(u.id, {
          name:     u.name  ?? (u.email ?? 'Unknown').split('@')[0],
          email:    u.email ?? 'unknown',
          lastSeen: u.last_seen_at ?? null,
          orgs:     [orgName],
        })
      }

      let activeWeek = 0, quietWeek = 0, longGone = 0, neverSeen = 0
      const quiet: QuietUser[] = []

      for (const u of byUser.values()) {
        const seen = u.lastSeen ? new Date(u.lastSeen).getTime() : NaN
        if (!u.lastSeen || Number.isNaN(seen)) { neverSeen++; continue }
        if (seen >= d7)  { activeWeek++; continue }
        if (seen >= d14) {
          quietWeek++
          quiet.push({ name: u.name, email: u.email, orgName: u.orgs[0], lastSeen: u.lastSeen })
          continue
        }
        longGone++
      }

      // Longest-quiet first — those are closest to being lost for good.
      quiet.sort((a, b) => new Date(a.lastSeen ?? 0).getTime() - new Date(b.lastSeen ?? 0).getTime())
      return { total: byUser.size, activeWeek, quietWeek, longGone, neverSeen, quiet: quiet.slice(0, 50) }
    })

    await step.run('send', async () => {
      const { total, activeWeek, quietWeek, longGone, neverSeen, quiet } = stats
      const pct = total > 0 ? Math.round((activeWeek / total) * 100) : 0
      const fmt = (iso: string | null) =>
        iso ? new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }) : '—'

      const rows = quiet.map(q => `
        <tr>
          <td style="padding:6px 12px 6px 0;border-top:1px solid #f1f5f9">${esc(q.name)}</td>
          <td style="padding:6px 12px 6px 0;border-top:1px solid #f1f5f9;color:#64748b">${esc(q.email)}</td>
          <td style="padding:6px 12px 6px 0;border-top:1px solid #f1f5f9;color:#64748b">${esc(q.orgName)}</td>
          <td style="padding:6px 0;border-top:1px solid #f1f5f9;color:#b45309;white-space:nowrap">${fmt(q.lastSeen)}</td>
        </tr>`).join('')

      const tile = (label: string, value: number, colour: string) => `
        <td style="padding:12px 14px;background:#f8fafc;border-radius:10px;text-align:center">
          <div style="font-size:22px;font-weight:800;color:${colour}">${value}</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">${label}</div>
        </td>`

      const textLines = [
        `upFloat weekly usage — ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' })}`,
        ``,
        `Active this week: ${activeWeek} of ${total} (${pct}%)`,
        `Went quiet this week (7-14 days): ${quietWeek}`,
        `Gone longer than 14 days: ${longGone}`,
        `Never opened the app: ${neverSeen}`,
        ``,
        quiet.length
          ? `Worth a call:\n${quiet.map(q => `  ${q.name} <${q.email}> — ${q.orgName} — last seen ${fmt(q.lastSeen)}`).join('\n')}`
          : `Nobody went quiet this week.`,
      ].join('\n')

      const { error } = await resend.emails.send({
        from:    FROM,
        to,
        subject: `upFloat weekly: ${activeWeek}/${total} active · ${quietWeek} went quiet`,
        text:    textLines,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:620px;margin:0 auto;padding:28px 24px;background:#fff">
            <span style="font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.5px">upFloat</span>
            <h2 style="font-size:17px;font-weight:700;color:#0f172a;margin:18px 0 4px">Weekly usage</h2>
            <p style="font-size:12.5px;color:#94a3b8;margin:0 0 18px">Week ending ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' })}</p>

            <table style="width:100%;border-collapse:separate;border-spacing:8px 0"><tr>
              ${tile('Active this week', activeWeek, '#16a34a')}
              ${tile('Went quiet', quietWeek, '#b45309')}
              ${tile('Gone 14d+', longGone, '#dc2626')}
              ${tile('Never opened', neverSeen, '#64748b')}
            </tr></table>

            <p style="font-size:13px;color:#334155;margin:18px 0 0">
              <strong>${activeWeek} of ${total}</strong> people opened upFloat in the last 7 days (${pct}%).
            </p>

            ${quiet.length ? `
              <h3 style="font-size:14px;font-weight:700;color:#0f172a;margin:22px 0 8px">Worth a call — quiet for a week</h3>
              <p style="font-size:12px;color:#64748b;margin:0 0 10px">Active recently, but have not opened it in the last seven days. The warmest list to work through.</p>
              <table style="width:100%;font-size:13px;color:#334155;border-collapse:collapse">
                <tr style="font-size:11px;color:#94a3b8;text-align:left">
                  <th style="padding:0 12px 6px 0;font-weight:600">Name</th>
                  <th style="padding:0 12px 6px 0;font-weight:600">Email</th>
                  <th style="padding:0 12px 6px 0;font-weight:600">Organisation</th>
                  <th style="padding:0 0 6px;font-weight:600">Last seen</th>
                </tr>
                ${rows}
              </table>
              ${quietWeek > quiet.length ? `<p style="font-size:12px;color:#94a3b8;margin:10px 0 0">Showing ${quiet.length} of ${quietWeek}.</p>` : ''}
            ` : `<p style="font-size:13px;color:#16a34a;margin:22px 0 0">Nobody went quiet this week.</p>`}

            ${neverSeen > 0 ? `<p style="font-size:12px;color:#94a3b8;margin:18px 0 0">${neverSeen} ${neverSeen === 1 ? 'person has' : 'people have'} never opened the app since usage tracking began. Expect this to fall as people return.</p>` : ''}
          </div>`,
      })
      if (error) console.error('[weeklyUsageReport] send failed:', error)
      return { sent: !error }
    })

    return stats
  }
)
