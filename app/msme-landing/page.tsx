import Link from 'next/link'
import type { Metadata } from 'next'

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
          <Link href="/login?redirect=/msme" style={{
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
          Looking for something automated<br/>
          for <span style={{ color: TEAL }}>MSME compliance?</span><br/>
          <span style={{ fontSize: '0.75em', fontWeight: 600, color: MUTED }}>We've got you covered.</span>
        </h1>

        <p style={{ fontSize: 17, color: MUTED, lineHeight: 1.7, maxWidth: 580, margin: '0 auto 36px' }}>
          Stop chasing vendors on WhatsApp. Stop missing deadlines on spreadsheets.
          Planora automates Udyam declarations, tracks payment deadlines, and keeps your Section 43B(h) compliance in order — on autopilot.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <Link href="/login?redirect=/msme" style={{
            background: TEAL, color: '#fff', borderRadius: 10, padding: '14px 32px',
            fontSize: 16, fontWeight: 700, textDecoration: 'none', display: 'inline-block',
          }}>Start free — no card needed</Link>
          <a href="#how-it-works" style={{
            background: 'rgba(255,255,255,0.06)', color: WHITE, borderRadius: 10,
            padding: '14px 28px', fontSize: 16, fontWeight: 600, textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>See how it works ↓</a>
        </div>

        <p style={{ fontSize: 13, color: MUTED }}>
          You can start free · No subscription · Pay only to scale
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
            { num: '100%', label: 'Automated — vendor emails, forms, and deadline tracking' },
            { num: '2 min', label: 'To add a vendor and send them a declaration form' },
            { num: '3×',   label: 'Automated reminders sent to each vendor' },
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
          Section 43B(h) is simple in theory. In practice, tracking it manually is a nightmare.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {[
            { icon: '📲', title: 'Chasing vendors on WhatsApp', body: "You need Udyam certificates from 50 vendors. You're sending messages manually, following up, waiting. Half don't reply." },
            { icon: '📋', title: 'No central record', body: "You don't know which vendors are MSME-registered, which have submitted their certificate, and which are still pending." },
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
              { step: '1', title: 'Add your MSME vendors', body: 'Add vendors one by one or bulk-import from Excel. Just need the vendor name and email.' },
              { step: '2', title: 'We send them a declaration form', body: 'Each vendor gets an email with a simple form to confirm their Udyam number and MSME category — no chasing on WhatsApp.' },
              { step: '3', title: 'Track payment deadlines', body: 'Log invoice dates. The tracker calculates the Section 43B(h) deadline and alerts you before it expires.' },
              { step: '4', title: 'Export for filing', body: 'Download a clean Excel report with all vendor details, payment statuses, and Udyam numbers.' },
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
            { icon: '⏱️', title: 'Deadline tracker',             body: 'Automatic calculation from invoice date. Visual status — green, amber, red.' },
            { icon: '✉️', title: 'Automated vendor emails',       body: 'Up to 3 reminder emails sent automatically asking for Udyam declarations. No manual follow-up.' },
            { icon: '🔗', title: 'One-click declaration form',    body: 'Each vendor gets a unique link. They fill in their MSME details — you receive it automatically.' },
            { icon: '📊', title: 'Dashboard summary',             body: 'See total vendors, payment statuses, outstanding amounts, and compliance health at a glance.' },
            { icon: '📥', title: 'Excel bulk import',             body: 'Import your full vendor list from Excel or CSV in one go.' },
            { icon: '📤', title: 'Excel export for filing',       body: 'One-click export with all Udyam numbers, categories, amounts, and statuses.' },
            { icon: '🔒', title: 'Secure & private',              body: "Your vendor data is stored securely. Each firm's data is completely isolated." },
            { icon: '📱', title: 'Mobile-friendly vendor form',   body: 'Vendors can fill the declaration form on their phone in under 2 minutes.' },
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

      {/* ── Comparison vs Zoho / spreadsheets ────────────────────────────── */}
      <section style={{
        background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.07)',
        borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '64px 24px',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
            Why not just use Zoho or a spreadsheet?
          </h2>
          <p style={{ color: MUTED, textAlign: 'center', fontSize: 15, marginBottom: 48 }}>
            General-purpose tools aren't built for MSME compliance. Here's the difference.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: MUTED, fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)', width: '34%' }}></th>
                  <th style={{ textAlign: 'center', padding: '12px 16px', color: WHITE, fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.08)', width: '33%' }}>
                    <span style={{ color: TEAL }}>Planora MSME Tracker</span>
                  </th>
                  <th style={{ textAlign: 'center', padding: '12px 16px', color: MUTED, fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)', width: '33%' }}>Zoho / Spreadsheet</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Automated vendor declaration emails', '✅ Built-in, automatic', '❌ Manual or custom setup'],
                  ['Vendor self-service form link', '✅ One click per vendor', '❌ Not available'],
                  ['Section 43B(h) deadline tracking', '✅ Auto-calculated', '⚠️ You set it manually'],
                  ['Deadline alerts before expiry', '✅ Automatic reminders', '❌ Manual reminders only'],
                  ['MSME-specific Excel export', '✅ One click', '⚠️ Build your own template'],
                  ['Setup time', '✅ Under 5 minutes', '⚠️ Hours of configuration'],
                  ['Built for Indian compliance', '✅ Yes', '❌ Generic global tool'],
                ].map(([feature, us, them]) => (
                  <tr key={feature} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '13px 16px', color: MUTED, fontSize: 13 }}>{feature}</td>
                    <td style={{ padding: '13px 16px', textAlign: 'center', color: '#4ade80', fontWeight: 600, fontSize: 13 }}>{us}</td>
                    <td style={{ padding: '13px 16px', textAlign: 'center', color: MUTED, fontSize: 13 }}>{them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 640, margin: '0 auto', padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Simple, transparent pricing</h2>
        <p style={{ color: MUTED, fontSize: 15, marginBottom: 40 }}>
          Start free. Pay only when you need more vendors.
        </p>
        <div style={{
          background: CARD, border: '1px solid rgba(13,148,136,0.4)', borderRadius: 16, padding: '36px',
          marginBottom: 20,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: TEAL, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Free tier
          </div>
          <div style={{ fontSize: 42, fontWeight: 800, marginBottom: 4 }}>Free</div>
          <div style={{ fontSize: 15, color: MUTED, marginBottom: 28 }}>You can start right away — no payment needed</div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20, marginBottom: 24 }}>
            {[
              '✓ Full access to all features',
              '✓ Automated vendor emails',
              '✓ Declaration form links',
              '✓ Deadline tracker',
              '✓ Excel export',
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
        <p style={{ fontSize: 13, color: MUTED }}>
          Need more vendors? Affordable packs are available inside the app after sign-up.
        </p>
      </section>

      {/* ── Who is this for ──────────────────────────────────────────────── */}
      <section style={{
        background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.07)',
        borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '64px 24px',
      }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 40 }}>
            Who uses MSME Tracker?
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {[
              { icon: '🏢', who: 'Business owners & CFOs',     desc: 'Companies with vendor lists who need to track Section 43B(h) payment deadlines and collect declarations.' },
              { icon: '📦', who: 'Purchase & finance teams',    desc: 'Teams managing vendor payments who need a single source of truth for MSME status and deadlines.' },
              { icon: '📑', who: 'Accountants & tax advisors',  desc: 'Professionals who need a clean Udyam declaration trail and payment record before the filing deadline.' },
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
              Need a full practice management tool?
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10, lineHeight: 1.3 }}>
              Explore Planora — task management, compliance, invoicing & more
            </h3>
            <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.7, margin: 0 }}>
              The same platform that powers MSME Tracker also manages tasks, recurring compliance deadlines, client portals, team collaboration, and invoicing — all in one place.
            </p>
          </div>
          <Link href="/login" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.06)', color: WHITE, border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 10, padding: '13px 24px', fontSize: 15, fontWeight: 600, textDecoration: 'none',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            Explore Planora →
          </Link>
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
          No credit card needed. You can start right away.
        </p>
        <Link href="/login?redirect=/msme" style={{
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
