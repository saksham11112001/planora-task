// Bulk vendor import — accepts JSON array parsed client-side from Excel/CSV.
// Client uses the xlsx package to parse the file and sends rows as JSON.
import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
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
  const { data: { user } } = await supabase.auth.getUser()
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

  // Get existing emails (all rows incl. soft-deleted) to avoid duplicates
  const { data: existingVendors } = await admin
    .from('msme_vendors')
    .select('vendor_email')
    .eq('org_id', mb.org_id)

  const existingEmails = new Set((existingVendors ?? []).map(v => v.vendor_email.toLowerCase()))

  const skipped: Array<{ row: number; name: string; reason: string }> = []
  const toInsert: Array<{ org_id: string; vendor_name: string; vendor_email: string; gstin: string | null; is_paid: boolean; payment_status: string; created_by: string }> = []

  for (let i = 0; i < rows.length; i++) {
    const row   = rows[i]
    const name  = row.vendor_name?.toString().trim()
    const email = row.vendor_email?.toString().trim().toLowerCase()
    const gstin = row.gstin?.toString().trim() || null

    if (!name)                         { skipped.push({ row: i + 1, name: name ?? '(blank)', reason: 'Name is missing' }); continue }
    if (!email || !EMAIL_RE.test(email)) { skipped.push({ row: i + 1, name, reason: 'Invalid or missing email' }); continue }
    if (existingEmails.has(email))     { skipped.push({ row: i + 1, name, reason: 'Email already exists' }); continue }

    existingEmails.add(email) // prevent intra-batch duplicates
    toInsert.push({ org_id: mb.org_id, vendor_name: name, vendor_email: email, gstin, is_paid: true, payment_status: 'free', created_by: user.id })
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
    inserted: insertedCount,
    skipped,
    paid_slots: 0,
  })
}
