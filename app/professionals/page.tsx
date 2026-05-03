import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import Link             from 'next/link'

export default async function ProfessionalsPage() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) redirect('/dashboard')
  } catch {}

  const COUNTRIES = [
    {
      code: 'US', flag: '🇺🇸', name: 'United States', pro: 'CPA / EA',
      color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe',
      tasks: [
        'Form 1040 / 1040NR – Individual Returns',
        'Form 1065 – Partnership Returns',
        'Form 1120 / 1120-S – Corporate Returns',
        'Form 941 / 940 – Quarterly & Annual Payroll',
        'W-2 / W-3 / 1099-NEC – Information Returns',
        'Form 1040-ES – Estimated Tax (4 instalments)',
        'FinCEN 114 – FBAR Filings',
        'State Income Tax Returns',
      ],
      stat: '23 task templates',
    },
    {
      code: 'UK', flag: '🇬🇧', name: 'United Kingdom', pro: 'CA / ACCA',
      color: '#dc2626', bg: '#fef2f2', border: '#fecaca',
      tasks: [
        'VAT Returns – MTD Quarterly Submissions',
        'Corporation Tax CT600 – Annual Return',
        'Self Assessment SA100 – (Jan 31 deadline)',
        'PAYE / RTI Full Payment Submission (Monthly)',
        'P60 – End of Year Employee Certificates',
        'P11D – Expenses & Benefits in Kind',
        'Confirmation Statement – Companies House',
        'Annual Accounts – Companies House Filing',
      ],
      stat: '14 task templates',
    },
    {
      code: 'CA', flag: '🇨🇦', name: 'Canada', pro: 'CPA Canada',
      color: '#dc2626', bg: '#fff1f2', border: '#fecdd3',
      tasks: [
        'T1 – Personal Income Tax Returns',
        'T2 – Corporate Income Tax Returns',
        'HST / GST Returns – Quarterly',
        'T4 / T4A / T5 – Information Slips (Feb 28)',
        'Source Deductions – PD7A Remittances',
        'Corporate Tax Instalments – Monthly',
        'Personal Tax Instalments – Quarterly',
      ],
      stat: '13 task templates',
    },
    {
      code: 'AU', flag: '🇦🇺', name: 'Australia', pro: 'CA / CPA',
      color: '#047857', bg: '#f0fdf4', border: '#bbf7d0',
      tasks: [
        'BAS – Quarterly Business Activity Statements',
        'IAS – Monthly Instalment Activity Statements',
        'Company Tax Return (CTR) – Annual',
        'Individual / Trust / Partnership Tax Returns',
        'STP – Single Touch Payroll Annual Finalisation',
        'TPAR – Taxable Payments Annual Report (Aug 28)',
        'FBT – Fringe Benefits Tax Return (May)',
        'ASIC – Annual Company Statement',
      ],
      stat: '14 task templates',
    },
    {
      code: 'EU', flag: '🇪🇺', name: 'Europe', pro: 'General EU',
      color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe',
      tasks: [
        'VAT Return – Monthly or Quarterly Filing',
        'EC Sales List (ECSL) – Recapitulative Statement',
        'Intrastat Declaration – Monthly',
        'Corporate Income Tax Return – Annual',
        'Annual Accounts – Statutory Register Filing',
        'Payroll Tax / Social Security – Monthly',
        'Transfer Pricing Documentation',
        'Country-by-Country Report (CbCR) for MNEs',
      ],
      stat: '11 task templates',
    },
  ] as const

  return (
    <div style={{
      minHeight: '100vh',
      background: '#ffffff',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      overflowX: 'hidden',
      color: '#0f172a',
      colorScheme: 'light',
    }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }

        @keyframes shimmer {
          0%   { background-position: 200% center }
          100% { background-position: -200% center }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(18px) }
          to   { opacity: 1; transform: translateY(0) }
        }

        .fade-up   { animation: fade-up 0.55s ease both }
        .fade-up-2 { animation: fade-up 0.55s 0.1s ease both }

        .btn-primary { transition: transform 0.18s ease, box-shadow 0.18s ease !important }
        .btn-primary:hover { transform: translateY(-2px) !important; box-shadow: 0 14px 36px rgba(124,58,237,0.42) !important; }

        .nav-link { transition: color 0.14s }
        .nav-link:hover { color: #7c3aed !important }

        .card-lift { transition: transform 0.2s ease, box-shadow 0.2s ease }
        .card-lift:hover { transform: translateY(-3px); box-shadow: 0 16px 48px rgba(0,0,0,0.1) !important; }

        .footer-link { transition: color 0.14s }
        .footer-link:hover { color: rgba(255,255,255,0.75) !important }

        @media (max-width: 960px) {
          .hero-cols { flex-direction: column !important }
          .grid-3 { grid-template-columns: 1fr !important }
          .grid-2 { grid-template-columns: 1fr !important }
          .country-grid { grid-template-columns: 1fr 1fr !important }
          .pricing-grid { grid-template-columns: 1fr !important }
        }
        @media (max-width: 640px) {
          .nav-mid { display: none !important }
          .country-grid { grid-template-columns: 1fr !important }
        }
      `}</style>

      {/* ━━━ NAV ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex', alignItems: 'center', padding: '0 6%', height: 64, gap: 32,
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', flexShrink: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(13,148,136,0.3)',
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8l3 3 7-7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.5px', color: '#0f172a' }}>Floatup</span>
        </Link>

        <div className="nav-mid" style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 28 }}>
          {[['Compliance','#compliance'],['Pricing','#pricing'],['Countries','#countries'],['How it works','#how']].map(([l,h]) => (
            <a key={l} href={h} className="nav-link"
              style={{ color: '#64748b', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>{l}</a>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <Link href="/" style={{ color: '#64748b', fontSize: 13, textDecoration: 'none', fontWeight: 500 }}>← Back to Floatup</Link>
          <Link href="/login" className="nav-link" style={{ color: '#64748b', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
          <Link href="/login" className="btn-primary"
            style={{
              background: '#7c3aed', color: '#fff', padding: '9px 20px', borderRadius: 9,
              fontSize: 14, fontWeight: 600, textDecoration: 'none',
              boxShadow: '0 2px 10px rgba(124,58,237,0.3)', display: 'inline-block',
            }}>
            Start free →
          </Link>
        </div>
      </nav>

      {/* ━━━ HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section style={{
        background: 'linear-gradient(170deg, #0f0a1e 0%, #1e0a4a 55%, #0d0a2e 100%)',
        padding: '88px 6% 80px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(124,58,237,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,0.07) 1px,transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 100%)',
          pointerEvents: 'none',
        }}/>
        <div style={{
          position: 'absolute', top: -80, left: '30%', width: 600, height: 420,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 68%)',
          pointerEvents: 'none',
        }}/>

        <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }} className="fade-up">
          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.35)', borderRadius: 99, padding: '6px 16px', marginBottom: 32 }}>
            <span style={{ fontSize: 16 }}>🏛️</span>
            <span style={{ color: '#c4b5fd', fontSize: 13, fontWeight: 700, letterSpacing: '0.02em' }}>
              For CPA & CA Professionals · US · UK · Canada · Australia · Europe
            </span>
          </div>

          <h1 style={{
            fontSize: 'clamp(36px, 5vw, 64px)',
            fontWeight: 800, lineHeight: 1.06,
            letterSpacing: '-2.5px', margin: '0 0 22px', color: '#fff',
          }}>
            The practice management tool<br/>
            <span style={{
              background: 'linear-gradient(90deg, #c4b5fd 0%, #818cf8 35%, #a78bfa 70%, #c4b5fd 100%)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              animation: 'shimmer 6s linear infinite',
            }}>built for your jurisdiction.</span>
          </h1>

          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)', lineHeight: 1.78, marginBottom: 40, maxWidth: 600, margin: '0 auto 36px' }}>
            Pre-built compliance task templates for every country you serve. Load them in one click, assign to clients in bulk, and track every deadline — all in one platform.
          </p>

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 28 }}>
            <Link href="/login" className="btn-primary"
              style={{
                background: '#7c3aed', color: '#fff', padding: '15px 36px', borderRadius: 11,
                fontSize: 16, fontWeight: 700, textDecoration: 'none',
                boxShadow: '0 4px 22px rgba(124,58,237,0.5)', display: 'inline-block',
              }}>
              Start free — no card needed
            </Link>
            <a href="#compliance"
              style={{
                background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.8)',
                padding: '15px 28px', borderRadius: 11,
                fontSize: 15, fontWeight: 500, textDecoration: 'none',
                border: '1px solid rgba(255,255,255,0.12)', display: 'inline-block',
              }}>
              See compliance module ↓
            </a>
          </div>

          {/* Country flags */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
            {[['🇺🇸','US CPA'],['🇬🇧','UK CA/ACCA'],['🇨🇦','Canada CPA'],['🇦🇺','AU CA/CPA'],['🇪🇺','EU Practices']].map(([flag, label]) => (
              <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 99, padding: '5px 12px' }}>
                {flag} {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ COMPLIANCE MODULE OVERVIEW ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="compliance" style={{ padding: '92px 6%', background: '#fff' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: 99, padding: '4px 14px', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Compliance Module</span>
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.1, margin: '0 0 14px' }}>
              Everything your practice needs<br/>to never miss a deadline
            </h2>
            <p style={{ fontSize: 16, color: '#64748b', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
              From task templates to client assignment to document tracking — the compliance module handles the full workflow for professional practices.
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 48 }}>
            {[
              {
                step: '01',
                icon: '📋',
                color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe',
                title: 'Load country templates',
                body: 'Select one or more countries from the compliance master. Load pre-built task templates for US, UK, Canada, Australia, or EU in a single click. Each template comes with correct deadlines, frequencies, and required document checklists.',
              },
              {
                step: '02',
                icon: '✏️',
                color: '#0d9488', bg: '#f0fdfa', border: '#5eead4',
                title: 'Customise for your practice',
                body: 'Rename tasks, adjust frequencies, override deadlines, and define exactly which client documents are required for each compliance item. Your customisations apply org-wide and persist permanently.',
              },
              {
                step: '03',
                icon: '👥',
                color: '#f97316', bg: '#fff7ed', border: '#fed7aa',
                title: 'Assign to clients in bulk',
                body: 'Select which master tasks apply to each client during onboarding. Floatup auto-generates individual recurring compliance tasks with the exact attachment checklist you defined — ready for the whole financial year.',
              },
              {
                step: '04',
                icon: '📎',
                color: '#0891b2', bg: '#f0f9ff', border: '#7dd3fc',
                title: 'Enforce document collection',
                body: 'Each compliance task spawns document subtasks for required attachments. Staff must upload signed returns, computations, acknowledgements, and other documents before the task is marked complete.',
              },
              {
                step: '05',
                icon: '🔔',
                color: '#dc2626', bg: '#fef2f2', border: '#fecaca',
                title: 'Deadline alerts & escalation',
                body: 'Automated reminders fire N days before each due date. If a task is overdue or stuck in approval, it escalates to the manager automatically — no one needs to manually chase anyone.',
              },
              {
                step: '06',
                icon: '📊',
                color: '#475569', bg: '#f8fafc', border: '#e2e8f0',
                title: 'Track across all clients',
                body: 'The compliance dashboard shows every client\'s task status across all periods. Filter by country, group, due date, or staff member. Export compliance reports in one click for partner reviews.',
              },
            ].map((f, i) => (
              <div key={i} className="card-lift" style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', border: '1px solid #f1f5f9', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: f.bg, border: `1px solid ${f.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{f.icon}</div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: f.color, background: f.bg, border: `1px solid ${f.border}`, padding: '2px 9px', borderRadius: 99 }}>Step {f.step}</span>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 9, color: '#0f172a' }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.72, margin: 0 }}>{f.body}</p>
              </div>
            ))}
          </div>

          {/* Multi-country callout */}
          <div style={{
            borderRadius: 18, padding: '32px 36px',
            background: 'linear-gradient(135deg, #0f0a1e 0%, #1e0a4a 100%)',
            border: '1px solid rgba(124,58,237,0.25)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'center', gap: 36, flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 99, padding: '3px 12px', marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Multi-country practices</span>
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', marginBottom: 10 }}>
                Serve clients in multiple jurisdictions?
              </h3>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, margin: '0 0 18px' }}>
                Load task templates from multiple countries simultaneously. US federal + state returns sit alongside UK VAT returns and Canadian T-filings — all in one compliance master, clearly organised by country prefix.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['US-F1040','UK-SA100','CA-T2','AU-BAS-Q1','EU-VAT-Q'].map(c => (
                  <span key={c} style={{ fontSize: 11, fontWeight: 700, background: 'rgba(124,58,237,0.2)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.35)', padding: '4px 10px', borderRadius: 99 }}>{c}</span>
                ))}
              </div>
            </div>
            <div style={{ flexShrink: 0 }}>
              <Link href="/login" style={{
                display: 'inline-block', padding: '13px 28px', borderRadius: 10,
                background: '#7c3aed', color: '#fff',
                fontSize: 14, fontWeight: 700, textDecoration: 'none',
                boxShadow: '0 4px 20px rgba(124,58,237,0.45)',
              }}>
                Start free →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ COUNTRIES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="countries" style={{ padding: '92px 6%', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 99, padding: '4px 14px', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Compliance by country</span>
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-1.2px', margin: '0 0 12px' }}>
              Pre-built templates for every jurisdiction
            </h2>
            <p style={{ fontSize: 15, color: '#64748b', maxWidth: 440, margin: '0 auto', lineHeight: 1.7 }}>
              Each country template is built by practitioners familiar with local filing requirements. Load, customise, and go.
            </p>
          </div>

          <div className="country-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {COUNTRIES.map((c) => (
              <div key={c.code} className="card-lift" style={{
                background: '#fff', borderRadius: 18, padding: '28px 24px',
                border: `1px solid ${c.border}`,
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                  <span style={{ fontSize: 36, lineHeight: 1 }}>{c.flag}</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>{c.name}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: c.color, background: c.bg, border: `1px solid ${c.border}`, display: 'inline-block', padding: '2px 8px', borderRadius: 99, marginTop: 3 }}>{c.pro} · {c.stat}</div>
                  </div>
                </div>

                {/* Task list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {c.tasks.map((t) => (
                    <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#475569' }}>
                      <span style={{ color: c.color, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* + India card */}
            <div className="card-lift" style={{
              background: '#fff', borderRadius: 18, padding: '28px 24px',
              border: '1px solid #fed7aa',
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <span style={{ fontSize: 36, lineHeight: 1 }}>🇮🇳</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>India</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316', background: '#fff7ed', border: '1px solid #fed7aa', display: 'inline-block', padding: '2px 8px', borderRadius: 99, marginTop: 3 }}>CA / CMA · 60+ task templates</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  'GST R1, GSTR 3B, GSTR 9 / 9C – Monthly / Quarterly / Annual',
                  'TDS 26Q / 24Q / 27EQ Returns & Challans',
                  'Income Tax – ITR (Individual / Unaudited / with Audit)',
                  'Advance Tax – 4 quarterly instalments',
                  'ROC / MCA – AOC-4, MGT-7, DIR-3 KYC, Form 11/8',
                  'Audit – Tax Audit, Statutory Audit',
                  'Labour & Payroll – PF, ESI, PT',
                ].map(t => (
                  <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#475569' }}>
                    <span style={{ color: '#f97316', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ HOW IT WORKS (professional workflow) ━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="how" style={{ padding: '92px 6%', background: '#fff', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdfa', border: '1px solid #5eead4', borderRadius: 99, padding: '4px 14px', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Professional workflow</span>
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, letterSpacing: '-1.2px', margin: '0 0 12px' }}>
              From setup to client delivery in minutes
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              {
                n: '01', color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe',
                title: 'Load your country templates',
                body: 'Go to Compliance → Master Tasks → Load Defaults. Select the countries you serve (US, UK, Canada, Australia, EU, India). Floatup loads all relevant task templates instantly — deadlines, frequencies, and document requirements pre-filled.',
                tag: '< 60 seconds',
              },
              {
                n: '02', color: '#0d9488', bg: '#f0fdfa', border: '#5eead4',
                title: 'Customise for your practice',
                body: 'In the Compliance Master (Step 1), review each task template. Rename, adjust frequency, override deadlines, or specify exactly which documents your clients must upload. Changes apply to all future client assignments.',
                tag: 'One-time setup',
              },
              {
                n: '03', color: '#f97316', bg: '#fff7ed', border: '#fed7aa',
                title: 'Onboard clients in bulk',
                body: 'In Client Setup (Step 2), select a client and check off which master tasks apply to them. Assign a staff member and approver. Floatup auto-generates their full compliance schedule — task by task, month by month — for the entire financial year.',
                tag: '2 min per client',
              },
              {
                n: '04', color: '#0891b2', bg: '#f0f9ff', border: '#7dd3fc',
                title: 'Track, approve & deliver',
                body: 'Staff work through their compliance tasks, upload required documents, and submit for approval. Managers review and approve in one click. Automated reminders ensure nothing slips. You have full audit trail visibility across every client.',
                tag: 'Ongoing autopilot',
              },
            ].map((step, i) => (
              <div key={i} style={{
                display: 'flex', gap: 28, padding: '28px 0',
                borderBottom: i < 3 ? '1px solid #f1f5f9' : 'none',
                alignItems: 'flex-start',
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                  background: step.bg, border: `2px solid ${step.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 16, color: step.color,
                }}>{step.n}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.3px' }}>{step.title}</h3>
                    <span style={{ fontSize: 10, fontWeight: 700, color: step.color, background: step.bg, border: `1px solid ${step.border}`, padding: '2px 9px', borderRadius: 99 }}>{step.tag}</span>
                  </div>
                  <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.75, margin: 0 }}>{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ PRICING ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section id="pricing" style={{ padding: '92px 6%', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: 99, padding: '4px 14px', marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Pricing</span>
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 36px)', fontWeight: 800, letterSpacing: '-1.2px', margin: '0 0 10px' }}>
              Flat team pricing, billed in USD
            </h2>
            <p style={{ fontSize: 15, color: '#64748b', margin: '0 auto', lineHeight: 1.7 }}>
              Not per user. Your whole practice, one predictable bill.
            </p>
          </div>

          <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'start' }}>
            {[
              {
                name: 'Starter', price: '29', color: '#0d9488', border: '#0d9488', primary: false,
                badge: '',
                features: ['Up to 15 members', '15 projects', 'Recurring task automation', 'Approval workflows', 'Time tracking', 'Reports & CSV export'],
                note: 'Compliance module not included',
              },
              {
                name: 'Pro', price: '79', color: '#7c3aed', border: '#7c3aed', primary: true,
                badge: 'Recommended for practices',
                features: ['Up to 50 members', 'Unlimited projects', '✦ Compliance module — all countries', '✦ Country task templates (US/UK/CA/AU/EU)', '✦ Client bulk task assignment', 'Custom fields & API access'],
                note: 'Full compliance module included',
              },
              {
                name: 'Business', price: '149', color: '#0891b2', border: '#7dd3fc', primary: false,
                badge: '',
                features: ['Unlimited members', 'Unlimited projects', '✦ Compliance module — all countries', '✦ Multi-country task libraries', '✦ Advanced reports & analytics', 'White-label client portal'],
                note: 'Full compliance + advanced features',
              },
            ].map((plan) => (
              <div key={plan.name} style={{
                background: '#fff',
                border: plan.primary ? `2px solid ${plan.color}` : `1px solid #e2e8f0`,
                borderRadius: 18, padding: '28px 24px', position: 'relative',
                boxShadow: plan.primary ? '0 8px 32px rgba(124,58,237,0.16)' : '0 2px 8px rgba(0,0,0,0.04)',
              }}>
                {plan.badge && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: plan.color, color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 14px', borderRadius: 99, whiteSpace: 'nowrap' }}>{plan.badge}</div>
                )}
                <div style={{ fontSize: 12, fontWeight: 700, color: plan.primary ? plan.color : '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>{plan.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>$</span>
                  <span style={{ fontSize: 36, fontWeight: 900, color: '#0f172a', letterSpacing: '-1.5px' }}>{plan.price}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>/mo</span>
                </div>
                <div style={{ fontSize: 11, color: plan.primary ? plan.color : '#94a3b8', fontWeight: 600, marginBottom: 18, background: plan.primary ? '#faf5ff' : 'transparent', padding: plan.primary ? '3px 8px' : '3px 0', borderRadius: plan.primary ? 6 : 0, display: 'inline-block' }}>{plan.note}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 22 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: f.startsWith('✦') ? '#374151' : '#374151' }}>
                      <span style={{ color: f.startsWith('✦') ? plan.color : '#94a3b8', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
                        {f.startsWith('✦') ? '✦' : '✓'}
                      </span>
                      {f.replace('✦ ', '')}
                    </div>
                  ))}
                </div>
                <Link href="/login" style={{
                  display: 'block', textAlign: 'center', padding: '11px 16px', borderRadius: 10,
                  background: plan.primary ? plan.color : 'transparent',
                  color: plan.primary ? '#fff' : plan.color,
                  border: `1.5px solid ${plan.color}`,
                  fontSize: 14, fontWeight: 700, textDecoration: 'none',
                  boxShadow: plan.primary ? `0 4px 16px ${plan.color}40` : 'none',
                }}>Start free trial</Link>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: 13, color: '#94a3b8', marginTop: 20 }}>
            14-day free trial · No credit card required · Cancel anytime · Billed in USD
          </p>
        </div>
      </section>

      {/* ━━━ FINAL CTA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section style={{
        padding: '100px 6%',
        background: 'linear-gradient(160deg, #0f0a1e 0%, #1e0a4a 55%, #0d0a2e 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -80, left: '28%', width: 560, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)', pointerEvents: 'none' }}/>
        <div style={{ maxWidth: 620, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 'clamp(28px, 4.5vw, 52px)', fontWeight: 800, color: '#fff', letterSpacing: '-2px', marginBottom: 16, lineHeight: 1.1 }}>
            Your practice deserves<br/>better than spreadsheets.
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.46)', marginBottom: 36, lineHeight: 1.75 }}>
            Pre-built compliance templates for every jurisdiction you serve.<br/>Free to start — no credit card needed.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" className="btn-primary"
              style={{
                background: '#7c3aed', color: '#fff', padding: '15px 36px', borderRadius: 11,
                fontSize: 16, fontWeight: 700, textDecoration: 'none',
                boxShadow: '0 6px 28px rgba(124,58,237,0.5)', display: 'inline-block',
              }}>
              Start free trial
            </Link>
            <Link href="/"
              style={{
                background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)',
                padding: '15px 24px', borderRadius: 11, fontSize: 15, fontWeight: 500,
                textDecoration: 'none', border: '1px solid rgba(255,255,255,0.12)', display: 'inline-block',
              }}>
              ← Back to Floatup
            </Link>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)', marginTop: 20 }}>
            US · UK · Canada · Australia · Europe · India
          </p>
        </div>
      </section>
    </div>
  )
}
