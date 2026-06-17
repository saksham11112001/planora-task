import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }      from 'next/server'

const ADMIN_EMAIL = 'saksham.gpt2001@gmail.com'

export async function GET() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // All orgs that have any MSME vendors (active or not)
  const { data: orgRows } = await admin
    .from('msme_vendors')
    .select('org_id')
    .eq('is_deleted', false)

  const orgIds = [...new Set((orgRows ?? []).map(r => r.org_id))]

  // Org names
  const { data: orgData } = orgIds.length
    ? await admin.from('organisations').select('id, name').in('id', orgIds)
    : { data: [] }

  const orgNameMap: Record<string, string> = {}
  for (const o of orgData ?? []) orgNameMap[o.id] = o.name

  // Pack tiers per org
  const { data: packRows } = await admin
    .from('org_feature_settings')
    .select('org_id, config')
    .eq('feature_key', 'msme_pack')

  const packByOrg: Record<string, { tier: string; vendor_limit: number; paid_at: string | null }> = {}
  for (const p of packRows ?? []) {
    packByOrg[p.org_id] = {
      tier: (p.config?.tier as string) ?? 'free',
      vendor_limit: (p.config?.vendor_limit as number) ?? 5,
      paid_at: (p.config?.paid_at as string) ?? null,
    }
  }

  // Vendor counts and status breakdown per org
  const { data: vendorRows } = await admin
    .from('msme_vendors')
    .select('org_id, status, is_deleted')

  const perOrg: Record<string, { total: number; deleted: number; statusMap: Record<string, number> }> = {}
  for (const v of vendorRows ?? []) {
    if (!perOrg[v.org_id]) perOrg[v.org_id] = { total: 0, deleted: 0, statusMap: {} }
    if (v.is_deleted) { perOrg[v.org_id].deleted++; continue }
    perOrg[v.org_id].total++
    perOrg[v.org_id].statusMap[v.status] = (perOrg[v.org_id].statusMap[v.status] ?? 0) + 1
  }

  // Build per-org summary
  const allOrgIds = [...new Set([...orgIds, ...Object.keys(packByOrg)])]
  const orgs = allOrgIds.map(id => {
    const pack  = packByOrg[id] ?? { tier: 'free', vendor_limit: 5, paid_at: null }
    const usage = perOrg[id] ?? { total: 0, deleted: 0, statusMap: {} }
    return {
      org_id:       id,
      org_name:     orgNameMap[id] ?? '(unknown)',
      pack_tier:    pack.tier,
      vendor_limit: pack.vendor_limit,
      paid_at:      pack.paid_at,
      vendor_count: usage.total,
      deleted_count: usage.deleted,
      status_breakdown: usage.statusMap,
    }
  }).sort((a, b) => b.vendor_count - a.vendor_count)

  // Global summary
  const tierCounts: Record<string, number> = {}
  let totalVendors = 0
  let totalPaidOrgs = 0
  const globalStatus: Record<string, number> = {}

  for (const o of orgs) {
    tierCounts[o.pack_tier] = (tierCounts[o.pack_tier] ?? 0) + 1
    totalVendors += o.vendor_count
    if (o.pack_tier !== 'free') totalPaidOrgs++
    for (const [s, c] of Object.entries(o.status_breakdown)) {
      globalStatus[s] = (globalStatus[s] ?? 0) + c
    }
  }

  return NextResponse.json({
    summary: {
      total_orgs:     orgs.length,
      paid_orgs:      totalPaidOrgs,
      free_orgs:      orgs.length - totalPaidOrgs,
      total_vendors:  totalVendors,
      tier_counts:    tierCounts,
      vendor_status:  globalStatus,
    },
    orgs,
  })
}
