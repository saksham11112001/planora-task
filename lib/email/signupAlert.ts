/**
 * Notifies all super admins (SUPER_ADMIN_EMAIL, comma-separated) when a NEW
 * user signs up. Callers are responsible for only invoking this for genuinely
 * new users (no existing public.users row) — provisioning runs on every login.
 *
 * Never throws: a failed alert must not break the signup flow.
 */
import { resend, FROM } from './resend'
import { superAdminEmails } from '@/lib/utils/superAdmin'

/** Which product surface the person signed up through. Mirrors the
 *  users.signup_product column, but is resolved at signup time — that column
 *  is only written later (partner registration, or org onboarding), so it is
 *  still the default 'app' when this alert fires. */
export type SignupSurface = 'app' | 'msme' | 'partner'

const SURFACE_LABEL: Record<SignupSurface, string> = {
  app:     'upFloat — main app',
  msme:    'MSME Tracker',
  partner: 'Partner Program',
}

/**
 * Resolve the signup surface from the request that carried the signup.
 * Single source of truth so every entry point classifies the same way.
 *
 * `path` may be a redirect target (?next=) or a referring page's pathname.
 */
export function resolveSignupSurface(host?: string | null, path?: string | null): SignupSurface {
  const h = (host ?? '').toLowerCase()
  const p = (path ?? '')
  // msme.upfloat.co — or a main-domain signup being sent on to the MSME app.
  if (h.startsWith('msme.') || p === '/msme' || p.startsWith('/msme/')) return 'msme'
  if (p.startsWith('/partners')) return 'partner'
  return 'app'
}

export async function notifySuperAdminsOfSignup(
  user: { email?: string | null; name?: string | null },
  source: string,           // HOW they authenticated — e.g. 'google oauth', 'email link'
  surface: SignupSurface = 'app',   // WHERE they signed up — app / msme / partner
) {
  const to = superAdminEmails()
  if (!to.length) return

  // Name/email come from user-controlled metadata — escape for the HTML body
  const esc   = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const email = esc(user.email ?? 'unknown')
  const name  = esc(user.name ?? (user.email ?? 'unknown').split('@')[0])
  const when  = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })

  const where = SURFACE_LABEL[surface] ?? SURFACE_LABEL.app

  try {
    const { error } = await resend.emails.send({
      from:    FROM,
      to,
      // Surface goes in the subject too — super admins scan the inbox and need
      // to see which product a signup came from without opening the mail.
      subject: `New ${where} signup: ${email}`,
      text:    `New user signed up.\n\nName: ${name}\nEmail: ${email}\nSigned up on: ${where}\nMethod: ${source}\nTime: ${when} IST`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:28px 24px;background:#fff">
          <span style="font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.5px">upFloat</span>
          <h2 style="font-size:17px;font-weight:700;color:#0f172a;margin:18px 0 14px">🎉 New user signed up</h2>
          <table style="font-size:14px;color:#334155;border-collapse:collapse">
            <tr><td style="padding:4px 16px 4px 0;color:#94a3b8">Name</td><td style="padding:4px 0;font-weight:600">${name}</td></tr>
            <tr><td style="padding:4px 16px 4px 0;color:#94a3b8">Email</td><td style="padding:4px 0;font-weight:600">${email}</td></tr>
            <tr><td style="padding:4px 16px 4px 0;color:#94a3b8">Signed up on</td><td style="padding:4px 0;font-weight:600;color:#0d9488">${where}</td></tr>
            <tr><td style="padding:4px 16px 4px 0;color:#94a3b8">Method</td><td style="padding:4px 0">${source}</td></tr>
            <tr><td style="padding:4px 16px 4px 0;color:#94a3b8">Time</td><td style="padding:4px 0">${when} IST</td></tr>
          </table>
        </div>`,
    })
    if (error) console.error('[signupAlert] send failed:', error)
  } catch (err) {
    console.error('[signupAlert] unexpected error:', err)
  }
}
