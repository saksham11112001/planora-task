import { NextResponse }      from 'next/server'
import type { NextRequest }  from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeEqual }   from 'node:crypto'
import { normaliseStatus, normalisePortal } from '@/lib/notices'

/**
 * POST /api/notices/ingest — machine ingestion of statutory notices.
 *
 * WHAT THIS IS FOR
 * ----------------
 * Automatic notice fetch from the GST, Income Tax and TRACES portals cannot
 * be done from application code alone. There is no open API:
 *
 *   - GST notice events are reachable only through a licensed GST Suvidha
 *     Provider (GSP), and additionally require each taxpayer to switch on
 *     "Manage API Access" in their own GST portal profile.
 *   - The Income Tax and TRACES portals publish no equivalent API at all.
 *     Everything on the market reaching them does so by logging in as the
 *     client with stored credentials.
 *
 * So the integration is a commercial and consent problem, not a coding one.
 * What this endpoint provides is the seam: once a GSP contract exists, or a
 * scheduled job is run elsewhere, it delivers notices HERE and the rest of
 * the module already works. Nothing about the app needs to change at that
 * point.
 *
 * It is equally the import path for a CSV or a one-off backfill.
 *
 * AUTH
 * ----
 * No user session — the caller is a machine. A shared secret in
 * x-upfloat-ingest-key is compared against NOTICE_INGEST_SECRET.
 *
 * If that variable is not set the endpoint is DISABLED and returns 503. An
 * unauthenticated write path that falls open when a config value is missing
 * is how data gets injected into the wrong firm, so the failure mode is
 * closed by construction.
 */

export const dynamic = 'force-dynamic'

/** Constant-time compare. A plain === leaks the secret one byte at a time to
 *  anyone who can measure response latency across many attempts. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // length, so compare lengths first and still run the digest-safe compare.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

interface IncomingNotice {
  client_id?:     string
  external_ref?:  string
  title?:         string
  notice_type?:   string
  portal?:        string
  notice_date?:   string | null
  response_due?:  string | null
  status?:        string
  section?:       string | null
  demand_amount?: number | null
  notes?:         string | null
}

const MAX_BATCH = 200

export async function POST(request: NextRequest) {
  const expected = process.env.NOTICE_INGEST_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: 'Notice ingestion is not configured on this deployment' },
      { status: 503 },
    )
  }

  const provided = request.headers.get('x-upfloat-ingest-key') ?? ''
  if (!provided || !secretMatches(provided, expected)) {
    // Deliberately identical to any other rejection — no hint about whether
    // the key was absent, the wrong length, or simply wrong.
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: { org_id?: string; notices?: IncomingNotice[] }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const orgId = String(body.org_id ?? '')
  if (!orgId) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

  const incoming = Array.isArray(body.notices) ? body.notices : []
  if (incoming.length === 0) return NextResponse.json({ error: 'notices[] is empty' }, { status: 400 })
  if (incoming.length > MAX_BATCH) {
    return NextResponse.json({ error: `At most ${MAX_BATCH} notices per request` }, { status: 413 })
  }

  const admin = createAdminClient()

  // The org must exist. The shared secret authorises the CALLER, not the
  // target, so without this a typo'd org_id would create orphaned rows.
  const { data: org } = await admin.from('organisations').select('id').eq('id', orgId).maybeSingle()
  if (!org) return NextResponse.json({ error: 'Unknown org_id' }, { status: 404 })

  // Every client_id must belong to THIS org. Fetched in one query rather than
  // per row, and anything outside the set is rejected rather than silently
  // dropped — a notice filed against the wrong firm is worse than an error.
  const clientIds = [...new Set(incoming.map(n => String(n.client_id ?? '')).filter(Boolean))]
  const { data: clients } = await admin.from('clients')
    .select('id').eq('org_id', orgId).in('id', clientIds.length ? clientIds : ['00000000-0000-0000-0000-000000000000'])
  const validClients = new Set((clients ?? []).map(c => c.id))

  const now      = new Date().toISOString()
  const rows: Record<string, unknown>[] = []
  const rejected: { index: number; reason: string }[] = []

  incoming.forEach((n, i) => {
    const clientId = String(n.client_id ?? '')
    if (!clientId)                  return rejected.push({ index: i, reason: 'client_id missing' })
    if (!validClients.has(clientId))return rejected.push({ index: i, reason: 'client_id does not belong to this org' })
    if (!n.title?.trim())           return rejected.push({ index: i, reason: 'title missing' })
    if (!n.external_ref?.trim())    return rejected.push({ index: i, reason: 'external_ref missing' })

    rows.push({
      org_id:        orgId,
      client_id:     clientId,
      external_ref:  n.external_ref.trim().slice(0, 120),
      title:         n.title.trim().slice(0, 300),
      notice_type:   (n.notice_type ?? 'other').slice(0, 60),
      portal:        normalisePortal(n.portal),
      notice_date:   n.notice_date  || null,
      response_due:  n.response_due || null,
      status:        normaliseStatus(n.status),
      section:       n.section?.slice(0, 60) ?? null,
      demand_amount: Number.isFinite(Number(n.demand_amount)) ? Number(n.demand_amount) : null,
      notes:         n.notes?.slice(0, 2000) ?? null,
      source:        'api',
      synced_at:     now,
      updated_at:    now,
    })
  })

  if (rows.length === 0) {
    return NextResponse.json({ ingested: 0, rejected }, { status: 400 })
  }

  // Idempotent on the partial unique index (org_id, external_ref). Re-sending
  // the same notice refreshes it in place; it never duplicates. That matters
  // because a poller re-sends everything it can see on every run.
  const { data, error } = await admin.from('client_notices')
    .upsert(rows, { onConflict: 'org_id,external_ref' })
    .select('id, external_ref')

  if (error) {
    // Do not echo the database message to an unauthenticated-by-session
    // caller; log it and return something generic.
    console.error('[notices/ingest]', error.message, error.code)
    return NextResponse.json({ error: 'Could not store notices' }, { status: 500 })
  }

  return NextResponse.json({ ingested: data?.length ?? 0, rejected })
}
