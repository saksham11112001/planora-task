'use client'
import { useEffect } from 'react'
import {
  PRESUMPTION_WINDOW_DAYS, PRESUMPTION_LABEL,
} from '@/lib/msme/presumption'
import type { PresumptionPack, PresumptionEntry } from '@/lib/msme/presumption'

/**
 * The printable non-response presumption pack.
 *
 * Every vendor email promises a 15-day reply window and states that silence
 * will be taken as "not registered under the MSMED Act, 2006". This document
 * is the evidence for that presumption: who was written to, at what address,
 * on which dates, and that nothing came back — plus a declaration for the
 * firm to sign.
 *
 * Printed rather than generated as a PDF. The project has no PDF library, and
 * adding one (a headless browser, or a client-side renderer plus fonts) to
 * produce a document the browser already prints well would be a large
 * dependency for no gain. "Print → Save as PDF" yields the same filed
 * artefact. This follows the same approach as the reports export.
 *
 * Colours are hardcoded hex deliberately, unlike app surfaces: this renders
 * onto white paper, so it must not follow the viewer's dark mode.
 */

const PRINT_STYLE_ID = 'msme-presumption-print-style'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export interface PresumptionPackProps {
  pack:       PresumptionPack
  firmName:   string
  /** The client company the return is for, or null when not scoped. */
  clientName: string | null
  periodLabel: string
  periodAsOn:  string
  periodDue:   string
  /** The org's today, YYYY-MM-DD — the date the document is signed off. */
  today:       string
  onClose:     () => void
}

export default function MsmePresumptionPack(p: PresumptionPackProps) {
  // Print rules, matching the reports export: hide the app, show only this.
  useEffect(() => {
    if (document.getElementById(PRINT_STYLE_ID)) return
    const style = document.createElement('style')
    style.id = PRINT_STYLE_ID
    style.textContent = `
      @media print {
        body > * { display: none !important; }
        .app-shell { display: none !important; }
        #msme-presumption-printable {
          display: block !important; position: fixed; inset: 0; z-index: 99999;
          background: #fff; overflow: visible; padding: 0; margin: 0;
        }
        .no-print { display: none !important; }
        /* Keep a vendor's evidence row off a page boundary — a split row
           reads as two incomplete records in a filed document. */
        tr, .pp-group { page-break-inside: avoid; }
        thead { display: table-header-group; }
        @page { margin: 1.4cm; size: A4 portrait; }
      }
    `
    document.head.appendChild(style)
    return () => { document.getElementById(PRINT_STYLE_ID)?.remove() }
  }, [])

  const subject = p.clientName ?? p.firmName
  const counts = {
    presumed:       p.pack.presumed.length,
    windowOpen:     p.pack.windowOpen.length,
    undeliverable:  p.pack.undeliverable.length,
    responded:      p.pack.responded.length,
    neverContacted: p.pack.neverContacted.length,
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.55)',
      overflowY: 'auto', padding: '24px 16px',
    }}>
      {/* Toolbar — never printed */}
      <div className="no-print" style={{
        maxWidth: 820, margin: '0 auto 12px', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <p style={{ margin: 0, color: '#fff', fontSize: 13, fontWeight: 600 }}>
          Non-response presumption pack — {counts.presumed} vendor{counts.presumed === 1 ? '' : 's'} presumed
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.print()} style={{
            background: '#0d9488', border: 'none', color: '#fff', borderRadius: 8,
            padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>Print / Save as PDF</button>
          <button onClick={p.onClose} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.4)', color: '#fff',
            borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Close</button>
        </div>
      </div>

      <div id="msme-presumption-printable" style={{
        maxWidth: 820, margin: '0 auto', background: '#fff', color: '#0f172a',
        borderRadius: 10, padding: '36px 40px',
        fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      }}>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, lineHeight: 1.35 }}>
          MSME Status Enquiry — Record of Non-Response
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
          Micro, Small and Medium Enterprises Development Act, 2006 · Form MSME-1
        </p>

        <table style={{ width: '100%', marginTop: 20, borderCollapse: 'collapse', fontSize: 12.5 }}>
          <tbody>
            <MetaRow label="Enquiry made by" value={subject} />
            {p.clientName && <MetaRow label="Compiled by" value={p.firmName} />}
            <MetaRow label="Reporting period" value={p.periodLabel} />
            <MetaRow label="Outstanding dues as on" value={p.periodAsOn} />
            <MetaRow label="MSME-1 filing due" value={fmtDate(p.periodDue)} />
            <MetaRow label="Record prepared on" value={fmtDate(p.today)} />
          </tbody>
        </table>

        {/* The claim this document makes, stated plainly. */}
        <div style={{
          marginTop: 22, background: '#f8fafc', border: '1px solid #e2e8f0',
          borderRadius: 8, padding: '14px 18px',
        }}>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.75, color: '#334155' }}>
            Each vendor listed in <strong>Section A</strong> was sent a written request to confirm
            whether it is registered as a micro, small or medium enterprise under the MSMED Act, 2006.
            Each request stated that if no reply were received within <strong>{PRESUMPTION_WINDOW_DAYS} days</strong>,
            the enterprise would be presumed not to be so registered. The dates of every request are
            recorded below. No response had been received as at {fmtDate(p.today)}, and the stated
            period has elapsed in each case. Accordingly these vendors are treated as
            <strong> not registered</strong> under the Act for the period stated above.
          </p>
        </div>

        <Group
          id="A"
          title="Vendors presumed not registered"
          caption={`Request sent, ${PRESUMPTION_WINDOW_DAYS}-day period elapsed, no response received.`}
          entries={p.pack.presumed}
          emptyText="No vendor meets the conditions for presumption in this period."
          showWindow
        />

        {/* The groups the presumption does NOT cover are printed too. A pack
            that silently omitted them would overstate its own completeness —
            and a reader cannot tell a firm that chased everyone from one that
            emailed 40 of 200 vendors unless both numbers are on the page. */}
        <Group
          id="B"
          title="Reply period still open"
          caption={`Request sent, but the ${PRESUMPTION_WINDOW_DAYS}-day period has not yet elapsed. No presumption is made.`}
          entries={p.pack.windowOpen}
          emptyText="None."
          showWindow
        />

        <Group
          id="C"
          title="Request could not be delivered"
          caption="The email bounced or the vendor unsubscribed, so the request was not received. These require confirmation by another means, such as post or courier, before any presumption can be made."
          entries={p.pack.undeliverable}
          emptyText="None."
        />

        <Group
          id="D"
          title="Vendors not yet contacted"
          caption="No request has been sent for this period. No presumption can be made until one is."
          entries={p.pack.neverContacted}
          emptyText="None — every vendor on the list has been contacted."
          hideDates
        />

        <Group
          id="E"
          title="Vendors who responded"
          caption="Listed for completeness. Their declarations are held on file."
          entries={p.pack.responded}
          emptyText="None."
          hideDates
        />

        {/* Summary so a reader can reconcile the groups against the list. */}
        <table style={{ width: '100%', marginTop: 26, borderCollapse: 'collapse', fontSize: 12.5 }}>
          <tbody>
            <MetaRow label="Total vendors on the list" value={String(
              counts.presumed + counts.windowOpen + counts.undeliverable
              + counts.responded + counts.neverContacted,
            )} />
            <MetaRow label="Presumed not registered (Section A)" value={String(counts.presumed)} />
            <MetaRow label="Responded (Section E)" value={String(counts.responded)} />
          </tbody>
        </table>

        <div className="pp-group" style={{ marginTop: 30, borderTop: '1px solid #e2e8f0', paddingTop: 18 }}>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.75, color: '#334155' }}>
            I confirm that the requests recorded above were sent to the email addresses stated, and
            that no response had been received from the vendors in Section A as at the date of this
            record.
          </p>
          <div style={{ display: 'flex', gap: 40, marginTop: 34, flexWrap: 'wrap' }}>
            {['Signature', 'Name & designation', 'Date'].map(l => (
              <div key={l} style={{ flex: '1 1 180px' }}>
                <div style={{ borderBottom: '1px solid #94a3b8', height: 28 }} />
                <p style={{ margin: '5px 0 0', fontSize: 11, color: '#64748b' }}>{l}</p>
              </div>
            ))}
          </div>
        </div>

        <p style={{ margin: '26px 0 0', fontSize: 10.5, color: '#94a3b8', lineHeight: 1.6 }}>
          Generated by upFloat from the request log held for {subject}. This record evidences the
          enquiry made; it is not a substitute for the Form MSME-1 return itself.
        </p>
      </div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{
        padding: '5px 12px 5px 0', color: '#64748b', width: 190,
        verticalAlign: 'top', fontSize: 12,
      }}>{label}</td>
      <td style={{ padding: '5px 0', fontWeight: 600 }}>{value}</td>
    </tr>
  )
}

function Group(p: {
  id: string; title: string; caption: string
  entries: PresumptionEntry[]; emptyText: string
  showWindow?: boolean; hideDates?: boolean
}) {
  return (
    <div className="pp-group" style={{ marginTop: 26 }}>
      <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>
        Section {p.id} — {p.title}{' '}
        <span style={{ fontWeight: 600, color: '#64748b' }}>({p.entries.length})</span>
      </h2>
      <p style={{ margin: '4px 0 10px', fontSize: 11.5, color: '#64748b', lineHeight: 1.6 }}>
        {p.caption}
      </p>

      {p.entries.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>{p.emptyText}</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <Th style={{ width: 28 }}>#</Th>
              <Th>Vendor</Th>
              <Th>Email address</Th>
              {!p.hideDates && <Th>Requests sent on</Th>}
              {p.showWindow && <Th style={{ width: 96 }}>Period ends</Th>}
            </tr>
          </thead>
          <tbody>
            {p.entries.map((e, i) => (
              <tr key={`${e.vendorEmail}-${i}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <Td style={{ color: '#94a3b8' }}>{i + 1}</Td>
                <Td style={{ fontWeight: 600 }}>{e.vendorName}</Td>
                <Td style={{ wordBreak: 'break-all', color: '#475569' }}>{e.vendorEmail}</Td>
                {!p.hideDates && (
                  <Td style={{ color: '#475569' }}>
                    {e.emailDates.length
                      ? e.emailDates.map(d => fmtDate(d)).join(', ')
                      : '—'}
                  </Td>
                )}
                {p.showWindow && <Td style={{ color: '#475569' }}>{fmtDate(e.windowClosesOn)}</Td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function Th({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th style={{
      textAlign: 'left', padding: '7px 8px', fontSize: 10.5, fontWeight: 700,
      color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em',
      borderBottom: '1px solid #cbd5e1', ...style,
    }}>{children}</th>
  )
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '7px 8px', verticalAlign: 'top', ...style }}>{children}</td>
}

export { PRESUMPTION_LABEL }
