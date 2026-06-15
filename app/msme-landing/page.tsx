import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'MSME Tracker — Section 43B(h) Compliance for CA Firms | SNG Advisors',
  description: 'Track MSME vendor payments, enforce 45-day deadlines, and stay compliant with Section 43B(h). First 5 vendors free.',
}

const TEAL  = '#0d9488'
const DARK  = '#0f172a'
const CARD  = '#1e293b'
const MUTED = '#94a3b8'
const WHITE = '#f1f5f9'

export default function MsmeLandingPage() {
  return (
    <div style={{ background: DARK, color: WHITE, minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 40px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        position: 'sticky', top: 0, background: DARK, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: TEAL,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 14, color: '#fff',
          }}>M</div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>MSME Tracker</span>
          <span style={{
            fontSize: 11, fontWeight: 600, color: TEAL, background: 'rgba(13,148,136,0.15)',
            border: '1px solid rgba(13,148,136,0.3)', borderRadius: 20, padding: '2px 8px',
          }}>by SNG Advisors</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link href="/login?redirect=/msme" style={{
            color: MUTED, fontSize: 14, textDecoration: 'none', fontWeight: 500,
          }}>Login</Link>
          <Link href="/login?redirect=/msme" style={{
            background: TEAL, color: '#fff', borderRadius: 8, padding: '8px 20px',
            fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}>Start Free →</Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 780, margin: '0 auto', padding: '80px 24px 60px', textAlign: 'center' }}>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24,
          background: 'rgba(13,148,136,0.12)', border: '1px solid rgba(13,148,136,0.3)',
          borderRadius: 20, padding: '6px 16px', fontSize: 13, color: TEAL, fontWeight: 600,
        }}>
          ⚡ Section 43B(h) Compliance Tool
        </div>

        <h1 style={{
          fontSize: 'clamp(32px, 5vw, 54px)', fontWeight: 800, lineHeight: 1.15,
          marginBottom: 20, letterSpacing: '-0.02em',
        }}>
          Never miss a <span style={{ color: TEAL }}>45-day MSME</span><br/>payment deadline again
        </h1>

        <p style={{ fontSize: 17, color: MUTED, lineHeight: 1.7, maxWidth: 580, margin: '0 auto 36px' }}>
          Section 43B(h) disallows your vendor payment deduction if you miss the 45-day deadline.
          Track every MSME vendor, get alerts before deadlines, and collect Udyam declarations — all in one place.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <Link href="/login?redirect=/msme" style={{
            background: TEAL, color: '#fff', borderRadius: 10, padding: '14px 32px',
            fontSize: 16, fontWeight: 700, textDecoration: 'none', display: 'inline-block',
          }}>Start free — 5 vendors on us</Link>
          <a href="#how-it-works" style={{
            background: 'rgba(255,255,255,0.06)', color: WHITE, borderRadius: 10,
            padding: '14px 28px', fontSize: 16, fontWeight: 600, textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>See how it works ↓</a>
        </div>

        <p style={{ fontSize: 13, color: MUTED }}>
          First 5 vendors free · ₹99/vendor after · No subscription
        </p>
      </section>

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      <section style={{
        borderTop: '1px solid rgba(255,255,255,0.07)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '28px 24px',
      }}>
        <div style={{
          maxWidth: 860, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, textAlign: 'center',
        }}>
          {[
            { num: '45 days', label: 'MSME payment deadline under Section 43B(h)' },
            { num: '₹99',     label: 'Per vendor, one-time. No recurring fees.' },
            { num: '3×',      label: 'Automated email reminders sent to vendor' },
          ].map(s => (
            <div key={s.num}>
              <div style={{ fontSize: 28, fontWeight: 800, color: TEAL, marginBottom: 4 }}>{s.num}</div>
              <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Problem ──────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 860, margin: '0 auto', padding: '64px 24px 48px' }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 12 }}>
          The risk CAs face every quarter
        </h2>
        <p style={{ color: MUTED, textAlign: 'center', fontSize: 15, marginBottom: 40, maxWidth: 540, margin: '0 auto 40px' }}>
          One missed 45-day payment deadline = deduction disallowed for that year. Your client pays more tax.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {[
            { icon: '❌', title: 'Deduction disallowed', body: 'If payment crosses 45 days, Section 43B(h) blocks the expense deduction — your client pays tax on money already spent.' },
            { icon: '📋', title: 'No Udyam declaration', body: "You don't know which vendors are MSME-registered until it's too late to do anything about it." },
            { icon: '🔔', title: 'No reminder system', body: 'Spreadsheets don\'t alert you. The deadline passes silently. You find out during filing — too late.' },
          ].map(c => (
            <div key={c.title} style={{
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
              borderRadius: 12, padding: '20px 22px',
            }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>{c.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{c.title}</div>
              <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>{c.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{
        background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.07)',
        borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '64px 24px',
      }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
            How it works
          </h2>
          <p style={{ color: MUTED, textAlign: 'center', fontSize: 15, marginBottom: 48 }}>
            Set up in under 5 minutes
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            {[
              { step: '1', title: 'Add your MSME vendors', body: 'Add vendors one by one or bulk-import from Excel. Just need the vendor name and email.' },
              { step: '2', title: 'We send them a declaration form', body: 'Each vendor gets an email with a simple form to confirm their Udyam registration number and MSME category.' },
              { step: '3', title: 'Track payment deadlines', body: 'Log invoice dates. The tracker calculates the 45-day deadline and alerts you 7 days before it expires.' },
              { step: '4', title: 'Export for filing', body: 'Download a clean Excel report with all vendor details, payment statuses, and Udyam numbers for your IT filing.' },
            ].map(s => (
              <div key={s.step} style={{ background: CARD, borderRadius: 12, padding: '22px' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', background: TEAL,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 14, marginBottom: 14, color: '#fff',
                }}>{s.step}</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 860, margin: '0 auto', padding: '64px 24px' }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 48 }}>
          Everything included
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {[
            { icon: '⏱️', title: '45-day deadline tracker',     body: 'Automatic calculation from invoice date. Visual status — green, amber, red.' },
            { icon: '✉️', title: 'Automated vendor emails',     body: 'Up to 3 reminder emails sent to each vendor asking for their Udyam declaration.' },
            { icon: '🔗', title: 'Declaration form link',        body: 'Shareable link for each vendor. They fill in their MSME details — you get it automatically.' },
            { icon: '📊', title: 'Dashboard summary',            body: 'See total vendors, payment statuses, outstanding amounts, and compliance health at a glance.' },
            { icon: '📥', title: 'Excel bulk import',            body: 'Import your full vendor list from Excel or CSV in one go. Template provided.' },
            { icon: '📤', title: 'Export for CA filing',         body: 'One-click Excel export with all Udyam numbers, categories, amounts, and statuses.' },
            { icon: '🔒', title: 'Secure & private',             body: 'Your vendor data is stored securely. Each firm\'s data is completely isolated.' },
            { icon: '💳', title: 'Pay only for what you use',    body: 'First 5 vendors free. ₹99 per vendor after that. No monthly subscription.' },
          ].map(f => (
            <div key={f.title} style={{
              background: CARD, borderRadius: 12, padding: '20px 22px',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.55 }}>{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section style={{
        background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.07)',
        borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '64px 24px',
      }}>
        <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Simple pricing</h2>
          <p style={{ color: MUTED, fontSize: 15, marginBottom: 40 }}>
            No subscriptions. Pay per vendor, once.
          </p>

          <div style={{
            background: CARD, border: '1px solid rgba(13,148,136,0.4)', borderRadius: 16, padding: '36px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: TEAL, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Pay-per-vendor
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
                <span style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>First</span>
                <span style={{ fontSize: 42, fontWeight: 800 }}>5</span>
                <span style={{ fontSize: 13, color: MUTED }}>vendors</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: TEAL, margin: '4px 0 2px' }}>FREE</div>
              <div style={{ fontSize: 13, color: MUTED }}>then ₹99 per vendor · one-time</div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20, marginBottom: 24 }}>
              {[
                '✓ All features included',
                '✓ Unlimited email reminders',
                '✓ Declaration form link per vendor',
                '✓ Excel export anytime',
                '✓ No monthly fees — ever',
              ].map(item => (
                <div key={item} style={{ fontSize: 14, color: MUTED, marginBottom: 8, textAlign: 'left' }}>
                  <span style={{ color: TEAL }}>{item.slice(0,1)}</span>{item.slice(1)}
                </div>
              ))}
            </div>

            <Link href="/login?redirect=/msme" style={{
              display: 'block', background: TEAL, color: '#fff', borderRadius: 10,
              padding: '13px 0', fontSize: 15, fontWeight: 700, textDecoration: 'none',
            }}>
              Get started free →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Who is this for ──────────────────────────────────────────────── */}
      <section style={{ maxWidth: 860, margin: '0 auto', padding: '64px 24px' }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 40 }}>
          Built for CA firms
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {[
            { icon: '🏢', who: 'CA firms',         desc: 'Managing Section 43B(h) compliance for multiple clients with MSME vendor exposure.' },
            { icon: '💼', who: 'CFOs & Finance teams', desc: 'Companies with large vendor lists who need to track 45-day MSME payment deadlines internally.' },
            { icon: '📑', who: 'Tax consultants',  desc: 'Advisors who need a clean Udyam declaration trail before the ITR filing deadline.' },
          ].map(w => (
            <div key={w.who} style={{
              background: CARD, borderRadius: 12, padding: '22px',
              border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center',
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{w.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{w.who}</div>
              <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>{w.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Explore Planora ──────────────────────────────────────────────── */}
      <section style={{
        background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.07)',
        borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '48px 24px',
      }}>
        <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Need more than MSME tracking?
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10, lineHeight: 1.3 }}>
              Explore Planora — complete CA practice management
            </h3>
            <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.7, margin: 0 }}>
              Task management, compliance tracker, client portal, invoicing, team collaboration — everything a CA firm needs in one place.
            </p>
          </div>
          <a href="https://sng-adwisers.com" target="_blank" rel="noopener noreferrer" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.06)', color: WHITE, border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 10, padding: '13px 24px', fontSize: 15, fontWeight: 600, textDecoration: 'none',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            Explore Planora →
          </a>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section style={{
        background: `linear-gradient(135deg, rgba(13,148,136,0.15) 0%, rgba(8,145,178,0.1) 100%)`,
        borderTop: '1px solid rgba(13,148,136,0.2)', padding: '64px 24px', textAlign: 'center',
      }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>
          Start tracking today
        </h2>
        <p style={{ color: MUTED, fontSize: 15, marginBottom: 32, maxWidth: 420, margin: '0 auto 32px' }}>
          First 5 MSME vendors are completely free. No credit card needed.
        </p>
        <Link href="/login?redirect=/msme" style={{
          display: 'inline-block', background: TEAL, color: '#fff', borderRadius: 10,
          padding: '14px 36px', fontSize: 16, fontWeight: 700, textDecoration: 'none',
        }}>
          Add your first vendor — it's free →
        </Link>
        <p style={{ marginTop: 16, fontSize: 13, color: MUTED }}>
          Already have an account? <Link href="/login?redirect=/msme" style={{ color: TEAL, textDecoration: 'none' }}>Login →</Link>
        </p>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.07)', padding: '24px 40px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ fontSize: 13, color: MUTED }}>
          © 2025 SNG Advisors · MSME Tracker
        </div>
        <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
          <Link href="/privacy" style={{ color: MUTED, textDecoration: 'none' }}>Privacy</Link>
          <Link href="/terms"   style={{ color: MUTED, textDecoration: 'none' }}>Terms</Link>
          <a href="mailto:info@sng-adwisers.com" style={{ color: MUTED, textDecoration: 'none' }}>Contact</a>
        </div>
      </footer>

    </div>
  )
}
