import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/* ── State code → State name ────────────────────────────────────── */
const STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir',    '02': 'Himachal Pradesh',
  '03': 'Punjab',             '04': 'Chandigarh',
  '05': 'Uttarakhand',        '06': 'Haryana',
  '07': 'Delhi',              '08': 'Rajasthan',
  '09': 'Uttar Pradesh',      '10': 'Bihar',
  '11': 'Sikkim',             '12': 'Arunachal Pradesh',
  '13': 'Nagaland',           '14': 'Manipur',
  '15': 'Mizoram',            '16': 'Tripura',
  '17': 'Meghalaya',          '18': 'Assam',
  '19': 'West Bengal',        '20': 'Jharkhand',
  '21': 'Odisha',             '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',     '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',        '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',          '30': 'Goa',
  '31': 'Lakshadweep',        '32': 'Kerala',
  '33': 'Tamil Nadu',         '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',          '37': 'Andhra Pradesh',
  '38': 'Ladakh',             '97': 'Other Territory',
  '99': 'Centre Jurisdiction',
}

/* ── GSTIN format parser (zero-API, free) ──────────────────────── */
function parseGSTIN(gstin: string) {
  const stateCode = gstin.slice(0, 2)
  const pan       = gstin.slice(2, 12)
  const state     = STATE_CODES[stateCode] ?? null
  return { gstin, pan, state, stateCode }
}

/* ── GSTIN validation ───────────────────────────────────────────── */
function validateGSTIN(gstin: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)
}

/* ── Normalise Surepass response ────────────────────────────────── */
function normaliseSurepass(raw: any, gstin: string) {
  const d = raw?.data ?? {}
  const parsed = parseGSTIN(gstin)
  return {
    gstin,
    pan:               parsed.pan,
    name:              d.legal_name ?? d.trade_name ?? null,
    trade_name:        d.trade_name ?? null,
    gst_status:        d.gst_status ?? d.status ?? null,
    state:             d.state ?? parsed.state,
    state_code:        parsed.stateCode,
    address:           d.address ?? null,
    pincode:           d.pincode ?? null,
    constitution:      d.ctb ?? null,                        // "Private Limited Company" etc
    nature_of_business:Array.isArray(d.nature_of_business_activity)
                         ? d.nature_of_business_activity[0] : null,
    registration_date: d.date_of_registration ?? null,
    last_updated:      d.last_update_date ?? null,
  }
}

/* ── GET /api/gst/lookup?gstin=XX ──────────────────────────────── */
export async function GET(req: NextRequest) {
  // Auth gate — must be a logged-in org member
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const gstin = (req.nextUrl.searchParams.get('gstin') ?? '').trim().toUpperCase()

  if (!gstin) return NextResponse.json({ error: 'GSTIN is required' }, { status: 400 })
  if (!validateGSTIN(gstin)) return NextResponse.json({ error: 'Invalid GSTIN format' }, { status: 400 })

  const apiKey = process.env.GSTIN_API_KEY ?? ''

  /* ── With API key: call Surepass KYC API ─────────────────────── */
  if (apiKey) {
    try {
      const res = await fetch('https://kyc-api.surepass.io/api/v1/corporate/gstin-detailed', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ id: gstin }),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok || json.status_code === 422 || json.error) {
        // API returned an error — fall through to format-parse fallback
        const parsed = parseGSTIN(gstin)
        return NextResponse.json({
          data: { ...parsed, gst_status: null, name: null, address: null, constitution: null, nature_of_business: null, registration_date: null },
          partial: true,
          message: json.message ?? 'GSTIN not found in registry',
        })
      }

      return NextResponse.json({ data: normaliseSurepass(json, gstin), partial: false })
    } catch {
      // Network error — fall through
    }
  }

  /* ── No API key (or network error): return parsed data only ─── */
  const parsed = parseGSTIN(gstin)
  return NextResponse.json({
    data: {
      ...parsed,
      gst_status:        null,
      name:              null,
      trade_name:        null,
      address:           null,
      pincode:           null,
      constitution:      null,
      nature_of_business:null,
      registration_date: null,
    },
    partial: true,
    message: apiKey
      ? 'Could not reach GST registry'
      : 'Set GSTIN_API_KEY in .env.local for full business name & address lookup',
  })
}
