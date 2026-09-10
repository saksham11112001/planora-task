// Bulk vendor import — accepts JSON array parsed client-side from Excel/CSV.
// Client uses the xlsx package to parse the file and sends rows as JSON.
import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient }        from '@/lib/supabase/admin'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface ImportRow {
  vendor_name: string
  vendor_email: string
  gstin?: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role')
  if (!mb) return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  if (!['owner', 'admin', 'manager'].includes(mb.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { rows }: { rows: ImportRow[] } = await req.json()

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }
  if (rows.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 vendors per import' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Cap total vendor rows per org to 2000 (prevents runaway DB growth on free plans)
  const { count: totalVendors } = await admin
    .from('msme_vendors')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', mb.org_id)
  const TOTAL_ROW_CAP = 2000
  if ((totalVendors ?? 0) + rows.length > TOTAL_ROW_CAP) {
    return NextResponse.json({
      error: `Import would exceed the ${TOTAL_ROW_CAP}-vendor storage limit. You currently have ${totalVendors ?? 0} vendors.`,
    }, { status: 422 })
  }

  // Existing emails, split by state. Treating soft-deleted rows as "already
  // exists" meant a vendor who had ever been removed could never be brought
  // back by import — the row was skipped every time with a reason that read
  // like a duplicate. Manual add already reactivates those; import now matches.
  const { data: existingVendors } = await admin
    .from('msme_vendors')
    .select('id, vendor_email, is_deleted')
    .eq('org_id', mb.org_id)

  const existingEmails = new Set(
    (existingVendors ?? []).filter(v => !v.is_deleted).map(v => v.vendor_email.toLowerCase()),
  )
  // email → id of a removed row that can simply be switched back on.
  const revivable = new Map<string, string>()
  for (const v of existingVendors ?? []) {
    const e = v.vendor_email.toLowerCase()
    if (v.is_deleted && !existingEmails.has(e) && !revivable.has(e)) revivable.set(e, v.id)
  }

  const skipped: Array<{ row: number; name: string; reason: string }> = []
  const toInsert: Array<{ org_id: string; vendor_name: string; vendor_email: string; gstin: string | null; is_paid: boolean; payment_status: string; created_by: string }> = []
  // Rows matching a previously removed vendor — reactivated rather than inserted.
  const toRevive: Array<{ id: string; name: string; gstin: string | null }> = []

  for (let i = 0; i < rows.length; i++) {
    const row   = rows[i]
    const name  = row.vendor_name?.toString().trim()
    const email = row.vendor_email?.toString().trim().toLowerCase()
    const gstin = row.gstin?.toString().trim() || null

    if (!name)                         { skipped.push({ row: i + 1, name: name ?? '(blank)', reason: 'Name is missing' }); continue }
    if (!email || !EMAIL_RE.test(email)) { skipped.push({ row: i + 1, name, reason: 'Invalid or missing email' }); continue }
    if (existingEmails.has(email))     { skipped.push({ row: i + 1, name, reason: 'Email already exists' }); continue }

    existingEmails.add(email) // prevent intra-batch duplicates

    // Previously removed — switch the existing row back on instead of inserting
    // a second one for the same address. Reuses its slot, exactly as the manual
    // add path does.
    const reviveId = revivable.get(email)
    if (reviveId) { toRevive.push({ id: reviveId, name, gstin }); continue }

    toInsert.push({ org_id: mb.org_id, vendor_name: name, vendor_email: email, gstin, is_paid: true, payment_status: 'free', created_by: user.id })
  }

  // Reactivations run before the insert so a failure here cannot leave the
  // batch half-applied with duplicates already created.
  let revivedCount = 0
  for (const r of toRevive) {
    const { error } = await admin.from('msme_vendors')
      // email_count / last_emailed_at intentionally untouched — see the note in
      // the manual add path. They are the slot ledger; resetting them on
      // reactivation would hand a consumed slot back and let a pack be reused
      // indefinitely by deleting and re-importing the same addresses.
      .update({ vendor_name: r.name, gstin: r.gstin, is_deleted: false, status: 'pending' })
      .eq('id', r.id).eq('org_id', mb.org_id)
    if (!error) revivedCount++
  }

  let insertedCount = 0
  if (toInsert.length > 0) {
    const { error } = await admin.from('msme_vendors').insert(toInsert)
    if (error) {
      // Bulk insert failed — surface as a single error rather than partial success
      return NextResponse.json({ error: `Import failed: ${error.message}` }, { status: 500 })
    }
    insertedCount = toInsert.length
  }

  return NextResponse.json({
    ok: true,
    // Reactivated rows count as imported from the user's point of view — the
    // vendor is back in their list either way.
    inserted: insertedCount + revivedCount,
    restored: revivedCount,
    skipped,
    paid_slots: 0,
  })
}
