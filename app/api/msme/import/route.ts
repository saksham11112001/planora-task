// Bulk vendor import — accepts JSON array parsed client-side from Excel/CSV.
// Client uses the xlsx package to parse the file and sends rows as JSON.
import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { createAdminClient }        from '@/lib/supabase/admin'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'
import { FREE_VENDOR_LIMIT }        from '@/lib/msme/packs'

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

  // Resolve pack-based vendor limit (same logic as single-add POST)
  const { data: packRow } = await admin
    .from('org_feature_settings')
    .select('config')
    .eq('org_id', mb.org_id)
    .eq('feature_key', 'msme_pack')
    .maybeSingle()
  const vendorLimit: number = (packRow?.config?.vendor_limit as number | undefined) ?? FREE_VENDOR_LIMIT

  // Count ALL slots ever used (including soft-deleted) — mirrors the single-add anti-gaming logic
  const { count: totalEver } = await admin
    .from('msme_vendors')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', mb.org_id)

  const slotsUsed = totalEver ?? 0

  if (slotsUsed >= vendorLimit) {
    return NextResponse.json({
      error: 'Vendor limit reached. Upgrade your pack to import more vendors.',
      code: 'LIMIT_REACHED',
    }, { status: 402 })
  }

  // Get existing emails to avoid duplicates (all rows, including soft-deleted)
  const { data: existingVendors } = await admin
    .from('msme_vendors')
    .select('vendor_email')
    .eq('org_id', mb.org_id)

  const existingEmails = new Set((existingVendors ?? []).map(v => v.vendor_email.toLowerCase()))

  let slotIndex = slotsUsed
  const inserted: string[] = []
  const skipped:  Array<{ row: number; name: string; reason: string }> = []

  for (let i = 0; i < rows.length; i++) {
    const row   = rows[i]
    const name  = row.vendor_name?.toString().trim()
    const email = row.vendor_email?.toString().trim().toLowerCase()
    const gstin = row.gstin?.toString().trim() || null

    if (!name) { skipped.push({ row: i + 1, name: name ?? '(blank)', reason: 'Name is missing' }); continue }
    if (!email || !EMAIL_RE.test(email)) { skipped.push({ row: i + 1, name, reason: 'Invalid or missing email' }); continue }
    if (existingEmails.has(email)) { skipped.push({ row: i + 1, name, reason: 'Email already exists' }); continue }

    // Stop inserting once the pack limit is reached; add remaining rows to skipped
    if (slotIndex >= vendorLimit) {
      skipped.push({ row: i + 1, name, reason: 'Vendor limit reached — upgrade pack to add more' })
      continue
    }

    const isPaid        = slotIndex >= FREE_VENDOR_LIMIT
    const paymentStatus = isPaid ? 'unpaid' : 'free'

    const { error } = await admin.from('msme_vendors').insert({
      org_id:         mb.org_id,
      vendor_name:    name,
      vendor_email:   email,
      gstin,
      is_paid:        isPaid,
      payment_status: paymentStatus,
      created_by:     user.id,
    })

    if (error) {
      skipped.push({ row: i + 1, name, reason: error.message })
    } else {
      inserted.push(name)
      existingEmails.add(email)
      slotIndex++
    }
  }

  return NextResponse.json({
    ok: true,
    inserted: inserted.length,
    skipped,
    paid_slots: Math.max(0, slotIndex - FREE_VENDOR_LIMIT),
  })
}
