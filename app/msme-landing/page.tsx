import Link from 'next/link'
import type { Metadata } from 'next'
import { TryPlanoraSidebar } from './TryPlanoraSidebar'

export const metadata: Metadata = {
  title: 'MSME Tracker — Automate Section 43B(h) Compliance | Planora',
  description: 'Struggling to track MSME vendor payments and collect Udyam declarations? Planora automates the entire process — reminders, forms, deadlines, and export. Start free.',
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
          }}>by Planora</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link href="/login?redirect=/msme" style={{
            color: MUTED, fontSize: 14, textDecoration: 'none', fontWeight: 500,
          }}>Login</Link>
          <Link href="/login?redirect=/msme&mode=signup" style={{
            background: TEAL, color: '#fff', borderRadius: 8, padding: '8px 20px',
            fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}>Get Started Free →</Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 780, margin: '0 auto', padding: '80px 24px 60px', textAlign: 'center' }}>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24,
          background: 'rgba(13,148,136,0.12)', border: '1px solid rgba(13,148,136,0.3)',
          borderRadius: 20, padding: '6px 16px', fontSize: 13, color: TEAL, fontWeight: 600,
        }}>
          ⚡ Section 43B(h) Compliance — fully automated
        </div>

        <h1 style={{
          fontSize: 'clamp(32px, 5vw, 54px)', fontWeight: 800, lineHeight: 1.15,
          marginBottom: 20, letterSpacing: '-0.02em',
        }}>
          Worried about<br/>
          <span style={{ color: TEAL }}>MSME compliance?</span><br/>
          <span style={{ fontSize: '0.75em', fontWeight: 600, color: MUTED }}>We've got you covered.</span>
        </h1>

        <p style={{ fontSize: 17, color: MUTED, lineHeight: 1.7, maxWidth: 580, margin: '0 auto 36px' }}>
         Stop chasing vendors manually.

Planora automates vendor follow-ups for MSME status and compliance documents — so you never have to ask twice.

Every communication is logged in an audit-ready trail, ready to hand to your auditor.

One upload. Zero worries.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <Link href="/login?redirect=/msme&mode=signup" style={{
            background: TEAL, color: '#fff', borderRadius: 10, padding: '14px 32px',
            fontSize: 16, fontWeight: 700, textDecoration: 'none', display: 'inline-block',
          }}>Start free</Link>
          <a href="#how-it-works" style={{
            background: 'rgba(255,255,255,0.06)', color: WHITE, borderRadius: 10,
            padding: '14px 28px', fontSize: 16, fontWeight: 600, textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>See how it works ↓</a>
        </div>

        
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
            { num: '100%', label: 'Automated — vendor emails, forms, and deadline tracking' },
            { num: '2 min', label: 'To add a vendor' },
            { num: '3×',   label: 'Audit Logs' },
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
          The problem every business faces
        </h2>
        <p style={{ color: MUTED, textAlign: 'center', fontSize: 15, marginBottom: 40, maxWidth: 540, margin: '0 auto 40px' }}>
          MSME Trackingh= is simple in theory. In practice, tracking it manually is a nightmare.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {[
            { icon: '📲', title: 'Chasing vendors Manually', body: "You need Udyam certificates from 50 vendors. You're sending messages manually, following up, waiting. Half don't reply." },
            { icon: '📋', title: 'No central record', body: "You cant share with auditors which vendors are MSME registered." },
            { icon: '🔔', title: 'Missing deadlines silently', body: "Payment deadlines pass without any alert. You find out during filing that a deduction is disallowed — and you've already paid the tax." },
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
              { step: '1', title: 'Add your MSME vendors', body: 'Add vendors one by one or bulk-import from Excel. Just need the vendor name,email and other basic information.' },
              { step: '2', title: 'Automatic followups', body: 'Each vendor gets an email with a simple form to confirm their Udyam number and MSME category — no chasing manually.' },
              { step: '3', title: 'Export for filing', body: 'Download a clean Excel report with all vendor details, payment statuses, and Udyam numbers.' },
              { step: '4', title: 'Downloadable audit log', body: 'Downloadable audit log to be shared to auditor' },
              
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

      
      {/* ── Explore Planora ──────────────────────────────────────────────── */}
      <section style={{
        borderTop: '1px solid rgba(255,255,255,0.07)',
        borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '48px 24px',
      }}>
        <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Are you a CA, Need a full practice management tool?
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10, lineHeight: 1.3 }}>
              Explore Planora — task management, compliance, invoicing & more
            </h3>
            <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.7, margin: 0 }}>
              The same platform that powers MSME Tracker also manages tasks, recurring compliance deadlines, client portals, team collaboration, and invoicing — all in one place.
            </p>
          </div>
          <TryPlanoraSidebar />
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
          You can start right away.
        </p>
        <Link href="/login?redirect=/msme&mode=signup" style={{
          display: 'inline-block', background: TEAL, color: '#fff', borderRadius: 10,
          padding: '14px 36px', fontSize: 16, fontWeight: 700, textDecoration: 'none',
        }}>
          Get started free →
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
          © 2025 Planora · MSME Tracker
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
