/**
 * Platform super-admin check — single source of truth.
 *
 * SUPER_ADMIN_EMAIL accepts a comma-separated list, e.g.:
 *   SUPER_ADMIN_EMAIL=saksham@example.com,partner@example.com
 *
 * Every super-admin surface (coupons, complaints, msme-stats, payment test)
 * must gate through this — never hardcode an email in a route again.
 */
export function superAdminEmails(): string[] {
  const raw = process.env.SUPER_ADMIN_EMAIL
  if (!raw) return []
  return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return superAdminEmails().includes(email.trim().toLowerCase())
}
