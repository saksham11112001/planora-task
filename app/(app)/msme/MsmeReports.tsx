'use client'
import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { CHANGE_LABEL } from '@/lib/msme/periodCompare'
import { EXCLUSION_TEXT } from '@/lib/msme/form1'

/**
 * The MSME outputs a firm is paid to produce.
 *
 * Four reports behind one dialog, because they are read together when a
 * return is being prepared: what must be filed (Form MSME-1), what it costs
 * if it was paid late (section 43B(h)), what changed since last time, and
 * whose evidence has gone stale.
 *
 * Form MSME-1 prints, following the same approach as the presumption pack and
 * the reports export — the project has no PDF library and does not need one
 * for a document the browser renders well. Everything also exports to Excel,
 * because the schedule normally gets transposed into a filing utility.
 *
 * Colours are hardcoded hex to match the rest of the MSME module, and because
 * the printed sheet goes onto white paper and must not follow dark mode.
 */

const ACCENT = '#0d9488'
const PRINT_STYLE_ID = 'msme-reports-print-style'

type Tab = 'exposure' | 'form1' | 'compare' | 'udyam'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'form1',    label: 'Form MSME-1' },
  { id: 'exposure', label: 'Section 43B(h)' },
  { id: 'compare',  label: 'Changes' },
  { id: 'udyam',    label: 'Udyam watch' },
]

const inr = (n: number) =>
  `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export interface MsmeReportsProps {
  periodEnd:  string
  clientId:   string
  clientName: string | null
  firmName:   string
  onClose:    () => void
}

export default function MsmeReports(p: MsmeReportsProps) {
  const [tab,     setTab]     = useState<Tab>('form1')
  const [data,    setData]    = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (document.getElementById(PRINT_STYLE_ID)) return
    const style = document.createElement('style')
    style.id = PRINT_STYLE_ID
    style.textContent = `
      @media print {
        body > * { display: none !important; }
        .app-shell { display: none !important; }
        #msme-report-printable {
          display: block !important; position: fixed; inset: 0; z-index: 99999;
          background: #fff; overflow: visible;
        }
        .no-print { display: none !important; }
        tr { page-break-inside: avoid; }
        thead { display: table-header-group; }
        @page { margin: 1.2cm; size: A4 portrait; }
      }
    `
    document.head.appendChild(style)
    return () => { document.getElementById(PRINT_STYLE_ID)?.remove() }
  }, [])

  const load = useCallback(async (which: Tab) => {
    setLoading(true); setError(null)
    try {
      const qs = new URLSearchParams({ type: which, period_end: p.periodEnd })
      if (p.clientId && p.clientId !== 'all') qs.set('client_id', p.clientId)
      const res = await fetch(`/api/msme/reports?${qs}`)
      const d   = await res.json()
      if (!res.ok) { setError(d.error ?? 'Failed to load the report'); setData(null); return }
      setData(d)
    } catch {
      setError('Network error — please try again')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [p.periodEnd, p.clientId])

  useEffect(() => { load(tab) }, [tab, load])

  const scope = p.clientName ?? (p.clientId === 'none' ? 'Vendors not assigned to a client' : 'All clients')

  function exportSheet() {
    if (!data) return
    const wb = XLSX.utils.book_new()
    const title = [
      [`${TABS.find(t => t.id === tab)!.label} — ${data.period?.label ?? ''}`],
      [`Filing for: ${scope}`],
      [],
    ]
    let aoa: (string | number)[][] = []

    if (tab === 'form1') {
      aoa = [
        ['S.No', 'Name of supplier', 'PAN', 'Category', 'Amount outstanding (₹)',
         'Date from which outstanding', 'Reason for delay', 'Missing fields'],
        ...(data.rows ?? []).map((r: any) => [
          r.serial, r.vendorName, r.pan, r.category, r.outstanding,
          r.dueFromDate, r.delayReason, r.missing.join(', '),
        ]),
        [], ['Total', '', '', '', data.totalOutstanding ?? 0],
        [],
        ['Excluded from this return', 'Reason', 'Outstanding (₹)'],
        ...(data.excluded ?? []).map((e: any) => [
          e.vendorName, EXCLUSION_TEXT[e.reason as keyof typeof EXCLUSION_TEXT] ?? e.reason,
          e.outstanding ?? '',
        ]),
      ]
    } else if (tab === 'exposure') {
      aoa = [
        [`Assessed as at ${data.asOn} · RBI bank rate ${data.bankRate}% · section 16 interest at ${(data.bankRate * 3).toFixed(2)}%`],
        [],
        ['Vendor', 'Category', 'Nature', 'Invoices breaching s.15', 'Outstanding (₹)',
         'Disallowance u/s 43B(h) (₹)', 'Interest u/s 16 (₹)'],
        ...(data.vendors ?? []).map((v: any) => [
          v.vendorName, v.category ?? 'unknown', v.nature ?? '—',
          v.breachedCount, v.totalOutstanding, v.totalDisallowed, v.totalInterest,
        ]),
      ]
    } else if (tab === 'compare') {
      aoa = [
        ['Vendor', 'Changes', 'Previous (₹)', 'Current (₹)', 'Change (₹)'],
        ...(data.changes ?? []).map((c: any) => [
          c.vendorName,
          c.kinds.map((k: string) => CHANGE_LABEL[k as keyof typeof CHANGE_LABEL] ?? k).join('; '),
          c.previousAmount ?? '', c.currentAmount ?? '', c.balanceDelta ?? '',
        ]),
      ]
    } else {
      aoa = [
        ['Vendor', 'Status', 'Certificate age (years)', 'Affects 43B(h)', 'Note'],
        ...[...(data.stale ?? []), ...(data.undated ?? [])].map((r: any) => [
          r.vendorName, r.status, r.ageYears ?? '', r.affects43b ? 'Yes' : 'No', r.reason,
        ]),
      ]
    }

    const ws = XLSX.utils.aoa_to_sheet([...title, ...aoa])
    ws['!cols'] = Array.from({ length: 8 }, () => ({ wch: 24 }))
    XLSX.utils.book_append_sheet(wb, ws, TABS.find(t => t.id === tab)!.label.slice(0, 28))
    XLSX.writeFile(wb, `msme-${tab}-${p.periodEnd}.xlsx`)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.55)',
      overflowY: 'auto', padding: '24px 16px',
    }}>
      <div className="no-print" style={{
        maxWidth: 1000, margin: '0 auto 12px', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.14)', borderRadius: 9, padding: 3 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              border: 'none', borderRadius: 7, padding: '7px 14px', cursor: 'pointer',
              fontSize: 12.5, fontWeight: 700,
              background: tab === t.id ? '#fff' : 'transparent',
              color:      tab === t.id ? ACCENT : 'rgba(255,255,255,0.85)',
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {data && !data.empty && (
            <button onClick={exportSheet} style={ghost}>↓ Excel</button>
          )}
          {tab === 'form1' && data && !data.empty && (
            <button onClick={() => window.print()} style={{
              background: ACCENT, border: 'none', color: '#fff', borderRadius: 8,
              padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>Print / Save as PDF</button>
          )}
          <button onClick={p.onClose} style={ghost}>Close</button>
        </div>
      </div>

      <div id="msme-report-printable" style={{
        maxWidth: 1000, margin: '0 auto', background: '#fff', color: '#0f172a',
        borderRadius: 10, padding: '30px 34px',
        fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
          {TABS.find(t => t.id === tab)!.label}
        </h1>
        <p style={{ margin: '5px 0 0', fontSize: 12.5, color: '#475569', lineHeight: 1.6 }}>
          {data?.period?.label ?? ''} · Filing for <strong>{scope}</strong>
          {p.clientName && <> · compiled by {p.firmName}</>}
        </p>

        {loading && <p style={{ marginTop: 24, fontSize: 13, color: '#64748b' }}>Loading…</p>}
        {error   && <p style={{ marginTop: 24, fontSize: 13, color: '#dc2626' }}>{error}</p>}

        {!loading && !error && data?.empty && (
          <p style={{ marginTop: 24, fontSize: 13, color: '#64748b' }}>
            No vendors in scope for this selection.
          </p>
        )}

        {!loading && !error && data && !data.empty && (
          <>
            {tab === 'form1'    && (
              <Form1 data={data} periodEnd={p.periodEnd} onSaved={() => load('form1')} />
            )}
            {tab === 'exposure' && <Exposure data={data} />}
            {tab === 'compare'  && <Compare data={data} />}
            {tab === 'udyam'    && <Udyam data={data} />}
          </>
        )}
      </div>
    </div>
  )
}

/* ── Form MSME-1 ─────────────────────────────────────────────────────────── */

function Form1({ data, periodEnd, onSaved }: {
  data: Record<string, any>; periodEnd: string; onSaved: () => void
}) {
  const rows = data.rows ?? []

  // The two fields the form requires from the BUYER rather than the vendor.
  // Editable in place, because discovering a missing reason at the MCA portal
  // and coming back here is the workflow this report exists to remove.
  const [editing, setEditing] = useState<string | null>(null)
  const [draft,   setDraft]   = useState('')
  const [saving,  setSaving]  = useState(false)

  async function save(vendorId: string, field: 'delay_reason' | 'due_from_date', value: string) {
    setSaving(true)
    try {
      const res = await fetch('/api/msme/declarations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_id: vendorId, period_end: periodEnd, [field]: value || null }),
      })
      if (res.ok) { setEditing(null); onSaved() }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Note>
        Form MSME-1 covers <strong>micro and small</strong> enterprises only. Medium
        enterprises are outside the return and are listed below as excluded, so their
        absence is visible rather than looking like an omission.
        {data.ledgerVendorCount > 0
          ? <> Balances for {data.ledgerVendorCount} vendor(s) are taken from the imported
              ledger — the buyer&apos;s own books — rather than the vendor&apos;s declaration.</>
          : <> No invoice ledger has been imported, so balances are the figures vendors
              declared.</>}
      </Note>

      {data.incompleteCount > 0 && (
        <Warn>
          {data.incompleteCount} row(s) are missing a field the form requires. They are
          marked below; the return cannot be filed until they are filled.
        </Warn>
      )}

      {rows.length === 0 ? (
        <Empty>No micro or small enterprise has a reportable balance for this period.</Empty>
      ) : (
        <Table head={['S.No', 'Name of supplier', 'PAN', 'Amount outstanding',
                      'Outstanding since', 'Reason for delay']}>
          {rows.map((r: any) => (
            <tr key={r.serial} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <Td>{r.serial}</Td>
              <Td style={{ fontWeight: 600 }}>
                {r.vendorName}
                <span style={{ color: '#64748b', fontWeight: 400 }}> · {r.category}</span>
              </Td>
              <Td><Missing v={r.pan} is={r.missing.includes('pan')} /></Td>
              <Td style={{ textAlign: 'right' }}>{inr(r.outstanding)}</Td>
              <Td>
                {editing === `${r.vendorId}:date` ? (
                  <input type="date" value={draft} autoFocus disabled={saving}
                    onChange={e => setDraft(e.target.value)}
                    onBlur={() => save(r.vendorId, 'due_from_date', draft)}
                    style={cellInput} />
                ) : (
                  // NOT marked no-print: the printed schedule needs this
                  // value. The pointer cursor is simply irrelevant on paper.
                  <span onClick={() => { setEditing(`${r.vendorId}:date`); setDraft(r.dueFromDate ?? '') }}
                    style={{ cursor: 'pointer' }} title="Click to set">
                    <Missing v={fmtDate(r.dueFromDate)} is={r.missing.includes('dueFromDate')} />
                  </span>
                )}
              </Td>
              <Td>
                {editing === `${r.vendorId}:reason` ? (
                  <input value={draft} autoFocus disabled={saving} maxLength={500}
                    placeholder="Why is this outstanding?"
                    onChange={e => setDraft(e.target.value)}
                    onBlur={() => save(r.vendorId, 'delay_reason', draft)}
                    style={cellInput} />
                ) : (
                  <span onClick={() => { setEditing(`${r.vendorId}:reason`); setDraft(r.delayReason ?? '') }}
                    style={{ cursor: 'pointer' }} title="Click to edit">
                    <Missing v={r.delayReason} is={r.missing.includes('delayReason')} />
                  </span>
                )}
              </Td>
            </tr>
          ))}
          <tr>
            <Td /><Td style={{ fontWeight: 800 }}>Total</Td><Td />
            <Td style={{ textAlign: 'right', fontWeight: 800 }}>{inr(data.totalOutstanding)}</Td>
            <Td /><Td />
          </tr>
        </Table>
      )}

      {(data.excluded ?? []).length > 0 && (
        <>
          <h2 style={h2}>Excluded from this return ({data.excluded.length})</h2>
          <Table head={['Vendor', 'Reason', 'Outstanding']}>
            {data.excluded.map((e: any, i: number) => (
              <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <Td style={{ fontWeight: 600 }}>{e.vendorName}</Td>
                <Td style={{ color: '#475569' }}>
                  {EXCLUSION_TEXT[e.reason as keyof typeof EXCLUSION_TEXT] ?? e.reason}
                </Td>
                <Td style={{ textAlign: 'right', color: '#64748b' }}>
                  {e.outstanding != null ? inr(e.outstanding) : '—'}
                </Td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </>
  )
}

/* ── Section 43B(h) ──────────────────────────────────────────────────────── */

function Exposure({ data }: { data: Record<string, any> }) {
  const t = data.traderExposure ?? {}
  const u = data.unknownStatus ?? {}
  return (
    <>
      <Note>
        Assessed as at <strong>{fmtDate(data.asOn)}</strong> using an RBI bank rate of{' '}
        <strong>{data.bankRate}%</strong>, so section 16 interest runs at{' '}
        <strong>{(data.bankRate * 3).toFixed(2)}%</strong> compounded monthly.
        {data.bankRateIsDefault && <> This is the built-in default — set your org&apos;s rate
          in MSME settings if the rate in force differs.</>}
      </Note>

      <Figures items={[
        { label: 'Disallowance u/s 43B(h)', value: inr(data.disallowed), strong: true },
        { label: 'Interest u/s 16 MSMED',   value: inr(data.interest) },
        { label: 'Outstanding assessed',    value: inr(data.outstanding) },
        { label: 'Invoices breaching s.15', value: String(data.breachedCount ?? 0) },
      ]} />

      <Note>
        The figures above cover <strong>micro and small non-trader</strong> suppliers, which
        is what section 43B(h) reaches. Two groups sit outside that and are shown separately
        so the number you file is the one you mean to defend.
      </Note>

      {(t.vendorCount ?? 0) > 0 && (
        <Warn tone="info">
          <strong>Traders: {inr(t.disallowed)} disallowance, {inr(t.interest)} interest
          across {t.vendorCount} vendor(s).</strong> Udyam registration is open to traders,
          but it was clarified as being for priority-sector lending, so whether 43B(h)
          reaches goods bought from a trader is a position rather than settled law. Decide
          whether to include this.
        </Warn>
      )}

      {(u.vendorCount ?? 0) > 0 && (
        <Warn>
          <strong>{inr(u.outstanding)} across {u.vendorCount} vendor(s) cannot be
          assessed</strong> because they have not declared their MSME status. This is
          unquantified risk, not nil risk — chasing these declarations is the cheapest way
          to shrink it.
        </Warn>
      )}

      {(data.vendorsWithoutLedger ?? 0) > 0 && (
        <Warn>
          {data.vendorsWithoutLedger} vendor(s) have no invoices on file and so are not
          assessed at all. Section 43B(h) is tested per invoice against its own date, so a
          closing balance alone cannot be assessed — import a creditors ledger to include
          them.
        </Warn>
      )}

      <h2 style={h2}>By vendor</h2>
      <Table head={['Vendor', 'Category', 'Breaching', 'Outstanding', 'Disallowance', 'Interest']}>
        {(data.vendors ?? [])
          .filter((v: any) => v.totalDisallowed > 0 || v.totalInterest > 0)
          .sort((a: any, b: any) => b.totalDisallowed - a.totalDisallowed)
          .map((v: any) => (
            <tr key={v.vendorId} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <Td style={{ fontWeight: 600 }}>
                {v.vendorName}
                {v.isTrader && <span style={{ color: '#b45309', fontWeight: 400 }}> · trader</span>}
              </Td>
              <Td style={{ color: '#475569' }}>{v.category ?? 'unknown'}</Td>
              <Td style={{ textAlign: 'right' }}>{v.breachedCount}</Td>
              <Td style={{ textAlign: 'right' }}>{inr(v.totalOutstanding)}</Td>
              <Td style={{ textAlign: 'right', fontWeight: 700 }}>{inr(v.totalDisallowed)}</Td>
              <Td style={{ textAlign: 'right' }}>{inr(v.totalInterest)}</Td>
            </tr>
          ))}
      </Table>
    </>
  )
}

/* ── Changes vs the previous half-year ───────────────────────────────────── */

function Compare({ data }: { data: Record<string, any> }) {
  const t = data.totals ?? {}
  return (
    <>
      <Note>
        Compared against <strong>{data.previousPeriod?.label ?? 'the previous period'}</strong>.
        A vendor who has not answered yet is never treated as having cleared their balance —
        an unstated figure stays unstated.
      </Note>

      <Figures items={[
        { label: 'Previous outstanding', value: inr(t.previousOutstanding) },
        { label: 'Current outstanding',  value: inr(t.currentOutstanding), strong: true },
        { label: 'Newly declared MSME',  value: String(t.newlyMsme ?? 0) },
        { label: 'Gone quiet',           value: String(t.newlySilent ?? 0) },
      ]} />

      <h2 style={h2}>Worth a look ({(data.notable ?? []).length})</h2>
      {(data.notable ?? []).length === 0 ? (
        <Empty>No status or category changes since the previous period.</Empty>
      ) : (
        <Table head={['Vendor', 'What changed', 'Previous', 'Current', 'Change']}>
          {data.notable.map((c: any) => (
            <tr key={c.vendorId} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <Td style={{ fontWeight: 600 }}>{c.vendorName}</Td>
              <Td style={{ color: '#475569' }}>
                {c.kinds.map((k: string) => CHANGE_LABEL[k as keyof typeof CHANGE_LABEL] ?? k).join(' · ')}
              </Td>
              <Td style={{ textAlign: 'right' }}>{c.previousAmount != null ? inr(c.previousAmount) : '—'}</Td>
              <Td style={{ textAlign: 'right' }}>{c.currentAmount != null ? inr(c.currentAmount) : '—'}</Td>
              <Td style={{ textAlign: 'right', color: (c.balanceDelta ?? 0) > 0 ? '#dc2626' : '#16a34a' }}>
                {c.balanceDelta != null ? inr(c.balanceDelta) : '—'}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  )
}

/* ── Udyam watch ─────────────────────────────────────────────────────────── */

function Udyam({ data }: { data: Record<string, any> }) {
  const rows = [...(data.stale ?? []), ...(data.undated ?? [])]
  return (
    <>
      <Note>
        A Udyam certificate states the classification at the date of registration, and
        classification is reviewed from the enterprise&apos;s own annual filings. So a
        certificate over a year old may no longer be accurate — and since section 43B(h)
        reaches micro and small only, a reclassification can move a supplier in or out of
        it entirely.
      </Note>

      <Figures items={[
        { label: 'Needs confirming',   value: String(rows.length), strong: true },
        { label: 'Affects 43B(h)',     value: String(data.affecting43bCount ?? 0) },
        { label: 'Current',            value: String((data.fresh ?? []).length) },
      ]} />

      {rows.length === 0 ? (
        <Empty>Every declared certificate is within a year old.</Empty>
      ) : (
        <Table head={['Vendor', 'Certificate age', 'Affects 43B(h)', 'Why it matters']}>
          {rows.map((r: any, i: number) => (
            <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <Td style={{ fontWeight: 600 }}>{r.vendorName}</Td>
              <Td style={{ color: '#475569' }}>
                {r.status === 'undated' ? 'No date on file' : `${r.ageYears} year(s)`}
              </Td>
              <Td>{r.affects43b
                ? <span style={{ color: '#b45309', fontWeight: 700 }}>Yes</span>
                : <span style={{ color: '#64748b' }}>No</span>}</Td>
              <Td style={{ color: '#475569' }}>{r.reason}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  )
}

/* ── small shared pieces ─────────────────────────────────────────────────── */

const h2: React.CSSProperties = {
  margin: '26px 0 10px', fontSize: 14, fontWeight: 800,
}
const cellInput: React.CSSProperties = {
  width: '100%', border: `1px solid ${ACCENT}`, borderRadius: 5,
  padding: '3px 6px', fontSize: 11.5, fontFamily: 'inherit',
}
const ghost: React.CSSProperties = {
  background: 'transparent', border: '1px solid rgba(255,255,255,0.4)', color: '#fff',
  borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      marginTop: 18, background: '#f8fafc', border: '1px solid #e2e8f0',
      borderRadius: 8, padding: '12px 16px',
    }}>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: '#334155' }}>{children}</p>
    </div>
  )
}

function Warn({ children, tone = 'warn' }: { children: React.ReactNode; tone?: 'warn' | 'info' }) {
  const c = tone === 'info'
    ? { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' }
    : { bg: '#fff7ed', border: '#fed7aa', text: '#92400e' }
  return (
    <div style={{
      marginTop: 12, background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 8, padding: '12px 16px',
    }}>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: c.text }}>{children}</p>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '14px 0 0', fontSize: 12.5, color: '#94a3b8', fontStyle: 'italic' }}>{children}</p>
}

function Figures({ items }: { items: Array<{ label: string; value: string; strong?: boolean }> }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: 10, marginTop: 16,
    }}>
      {items.map(i => (
        <div key={i.label} style={{
          border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px',
          background: i.strong ? `${ACCENT}0a` : '#fff',
        }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {i.label}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: i.strong ? 18 : 16, fontWeight: 800, color: i.strong ? ACCENT : '#0f172a' }}>
            {i.value}
          </p>
        </div>
      ))}
    </div>
  )
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, marginTop: 10 }}>
      <thead>
        <tr style={{ background: '#f1f5f9' }}>
          {head.map((h, i) => (
            <th key={h} style={{
              textAlign: i >= 2 ? 'right' : 'left', padding: '7px 8px', fontSize: 10,
              fontWeight: 700, color: '#475569', textTransform: 'uppercase',
              letterSpacing: '0.04em', borderBottom: '1px solid #cbd5e1',
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

function Td({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '7px 8px', verticalAlign: 'top', ...style }}>{children}</td>
}

/** A field the form requires that is not on file. Named rather than left
 *  blank, so the gap is found here and not at the MCA portal. */
function Missing({ v, is }: { v: string; is: boolean }) {
  if (!is) return <span>{v || '—'}</span>
  return (
    <span style={{ color: '#b45309', fontWeight: 700, fontSize: 10.5 }}>
      ⚠ required
    </span>
  )
}
