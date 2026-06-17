// Pure-CSS looping demo animation. No client JS needed.
const TEAL   = '#0d9488'
const DARK   = '#0f172a'
const MUTED  = '#64748b'
const BORDER = '#e2e8f0'
const BG     = '#f8fafc'

// Each scene is 3 s; total loop = 15 s
const TOTAL  = 15
function makeFrameAnim(startS: number, endS: number) {
  const s  = (v: number) => `${+(v * 100 / TOTAL).toFixed(3)}%`
  const fs = Math.max(0, startS - 0.3)
  const fe = Math.min(TOTAL, endS - 0.3)
  return `
    ${s(0)}      { opacity:0 }
    ${s(fs)}     { opacity:0 }
    ${s(startS)} { opacity:1 }
    ${s(fe)}     { opacity:1 }
    ${s(endS)}   { opacity:0 }
    100%          { opacity:0 }
  `
}

const css = `
  @keyframes s1 { ${makeFrameAnim(0,   3.3)} }
  @keyframes s2 { ${makeFrameAnim(3,   6.3)} }
  @keyframes s3 { ${makeFrameAnim(6,   9.3)} }
  @keyframes s4 { ${makeFrameAnim(9,  12.3)} }
  @keyframes s5 { ${makeFrameAnim(12, 15.3)} }

  @keyframes cursor-blink { 0%,100% { opacity:1 } 50% { opacity:0 } }
  @keyframes btn-pulse    { 0%,100% { box-shadow: 0 0 0 0   rgba(13,148,136,0.5) }
                            50%     { box-shadow: 0 0 0 6px rgba(13,148,136,0)   } }
  @keyframes type1 { from { width:0 } to { width:22ch } }
  @keyframes type2 { from { width:0 } to { width:26ch } }
  @keyframes row-slide { from { opacity:0; transform:translateY(-6px) } to { opacity:1; transform:none } }
  @keyframes badge-pop { 0% { transform:scale(0.7); opacity:0 } 60% { transform:scale(1.1) } 100% { transform:scale(1); opacity:1 } }
  @keyframes email-fly { 0% { transform:translateX(0) translateY(0) scale(1); opacity:1 }
                         100% { transform:translateX(60px) translateY(-30px) scale(0.4); opacity:0 } }
  @keyframes stat-tick { 0%,80% { opacity:1 } 85% { opacity:0 } 90% { opacity:1 } }
  @keyframes check-draw { from { stroke-dashoffset:20 } to { stroke-dashoffset:0 } }

  .msme-scene { position:absolute; inset:0; opacity:0; }
  .msme-scene-1 { animation: s1 ${TOTAL}s linear infinite; }
  .msme-scene-2 { animation: s2 ${TOTAL}s linear infinite; }
  .msme-scene-3 { animation: s3 ${TOTAL}s linear infinite; }
  .msme-scene-4 { animation: s4 ${TOTAL}s linear infinite; }
  .msme-scene-5 { animation: s5 ${TOTAL}s linear infinite; }
`

// ── Shared sub-components (static, inline styles only) ───────────────────────

function StatsRow({ verified, pending, emailed }: { verified: number; pending: number; emailed: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
      {[
        { label: 'Total Vendors', value: String(verified + pending + emailed), color: TEAL },
        { label: 'MSME Verified', value: String(verified), color: '#10b981' },
        { label: 'Pending Reply', value: String(emailed), color: '#f59e0b' },
        { label: 'Not MSME',      value: '1',              color: MUTED     },
      ].map(s => (
        <div key={s.label} style={{ background: BG, borderRadius: 8, padding: '8px 10px', border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: s.color }}>{s.value}</div>
          <div style={{ fontSize: 10, color: MUTED, marginTop: 1 }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

function VendorRow({ name, email, status, statusColor, statusBg, action, extraStyle }: {
  name: string; email: string; status: string; statusColor: string; statusBg: string; action?: string; extraStyle?: React.CSSProperties
}) {
  return (
    <div style={{ padding: '8px 12px', display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: 8, alignItems: 'center', fontSize: 11, borderBottom: `1px solid ${BORDER}`, background: '#fff', ...extraStyle }}>
      <span style={{ fontWeight: 600, color: DARK }}>{name}</span>
      <span style={{ color: MUTED }}>{email}</span>
      <span style={{ background: statusBg, color: statusColor, borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700, display: 'inline-block' }}>{status}</span>
      <span style={{ color: TEAL, fontWeight: 600, fontSize: 10, cursor: 'pointer' }}>{action ?? 'Send Email →'}</span>
    </div>
  )
}

function TableHead() {
  return (
    <div style={{ background: BG, padding: '7px 12px', display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: 8, fontSize: 10, fontWeight: 700, color: MUTED, borderBottom: `1px solid ${BORDER}`, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      <span>Vendor</span><span>Email</span><span>Status</span><span>Action</span>
    </div>
  )
}

function DashboardHeader({ slot, children }: { slot: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 14, color: DARK, marginBottom: 2 }}>MSME Vendor Tracker</div>
        <div style={{ fontSize: 11, color: MUTED }}>{slot}</div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>{children}</div>
    </div>
  )
}

const addBtn = { background: `rgba(13,148,136,0.08)`, border: `1px solid rgba(13,148,136,0.2)`, borderRadius: 6, padding: '5px 10px', fontSize: 11, color: TEAL, fontWeight: 700 } as React.CSSProperties
const solidBtn = { background: TEAL, borderRadius: 6, padding: '5px 10px', fontSize: 11, color: '#fff', fontWeight: 700 } as React.CSSProperties

// ── Scene wrappers ────────────────────────────────────────────────────────────

function SceneShell({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <div className={`msme-scene ${className}`} style={{ padding: 20, textAlign: 'left', background: '#fff' }}>
      {children}
    </div>
  )
}

// Scene 1: Overview — 3 vendors in different states, "+ Add vendor" pulsing
function Scene1() {
  return (
    <SceneShell className="msme-scene-1">
      <DashboardHeader slot="3/5 vendor slots used">
        <div style={addBtn}>↑ Import</div>
        <div style={{ ...solidBtn, animation: `btn-pulse 1.2s ease-in-out infinite` }}>+ Add vendor</div>
      </DashboardHeader>
      <StatsRow verified={1} pending={1} emailed={1} />
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
        <TableHead />
        <VendorRow name="Mehta Textiles Pvt Ltd" email="accounts@mehtax.in" status="Verified"    statusColor="#10b981" statusBg="#d1fae5" action="View →" />
        <VendorRow name="Ravi Auto Parts"         email="ravi@autoparts.co"  status="Email Sent"  statusColor="#6366f1" statusBg="#e0e7ff" />
        <VendorRow name="Gupta Traders"           email="info@gupta.in"      status="Pending"     statusColor="#d97706" statusBg="#fef3c7" />
      </div>
    </SceneShell>
  )
}

// Scene 2: Add-vendor modal appears over the dashboard
function Scene2() {
  return (
    <SceneShell className="msme-scene-2">
      {/* Dimmed background dashboard */}
      <div style={{ opacity: 0.25, pointerEvents: 'none' }}>
        <DashboardHeader slot="3/5 vendor slots used">
          <div style={addBtn}>↑ Import</div>
          <div style={solidBtn}>+ Add vendor</div>
        </DashboardHeader>
        <StatsRow verified={1} pending={1} emailed={1} />
      </div>

      {/* Modal */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: '#fff', border: `1.5px solid ${TEAL}40`, borderRadius: 14, padding: 20, width: '100%', maxWidth: 340, boxShadow: '0 8px 32px rgba(13,148,136,0.15)' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: DARK, marginBottom: 14 }}>Add vendor</div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 4 }}>Vendor name</div>
            <div style={{ border: `1.5px solid ${TEAL}`, borderRadius: 7, padding: '6px 10px', fontSize: 12, color: DARK, background: '#fff', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <span style={{ display: 'inline-block', maxWidth: '22ch', overflow: 'hidden', whiteSpace: 'nowrap', animation: 'type1 1.8s steps(22,end) forwards', borderRight: `2px solid ${TEAL}`, animationFillMode: 'forwards' }}>Sharma Industries Ltd</span>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 4 }}>Email</div>
            <div style={{ border: `1.5px solid ${BORDER}`, borderRadius: 7, padding: '6px 10px', fontSize: 12, color: DARK, background: '#fff', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <span style={{ display: 'inline-block', maxWidth: '26ch', overflow: 'hidden', whiteSpace: 'nowrap', animationDelay: '1.9s', animation: 'type2 1.6s steps(26,end) forwards', animationFillMode: 'forwards', borderRight: `2px solid ${TEAL}` }}>accounts@sharmaindustries.in</span>
            </div>
          </div>
          <div style={{ background: TEAL, color: '#fff', borderRadius: 8, padding: '8px 0', fontSize: 12, fontWeight: 700, textAlign: 'center', marginTop: 4 }}>
            Add &amp; Send Email
          </div>
        </div>
      </div>
    </SceneShell>
  )
}

// Scene 3: Vendor added, row slides in, "Send Email" highlighted
function Scene3() {
  return (
    <SceneShell className="msme-scene-3">
      <DashboardHeader slot="4/5 vendor slots used">
        <div style={addBtn}>↑ Import</div>
        <div style={solidBtn}>+ Add vendor</div>
      </DashboardHeader>
      <StatsRow verified={1} pending={2} emailed={1} />
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
        <TableHead />
        <VendorRow name="Mehta Textiles Pvt Ltd" email="accounts@mehtax.in" status="Verified"    statusColor="#10b981" statusBg="#d1fae5" action="View →" />
        <VendorRow name="Ravi Auto Parts"         email="ravi@autoparts.co"  status="Email Sent"  statusColor="#6366f1" statusBg="#e0e7ff" />
        <VendorRow name="Gupta Traders"           email="info@gupta.in"      status="Pending"     statusColor="#d97706" statusBg="#fef3c7" />
        {/* New row slides in */}
        <div style={{ animation: 'row-slide 0.4s ease forwards', background: `${TEAL}08`, borderBottom: `1px solid ${TEAL}30` }}>
          <VendorRow name="Sharma Industries Ltd" email="accounts@sharmaindustries.in" status="Pending" statusColor="#d97706" statusBg="#fef3c7"
            extraStyle={{ background: 'transparent', animation: undefined }}
          />
        </div>
      </div>
    </SceneShell>
  )
}

// Scene 4: Email sending — icon flies out of row, status flips to "Email Sent"
function Scene4() {
  return (
    <SceneShell className="msme-scene-4">
      <DashboardHeader slot="4/5 vendor slots used">
        <div style={addBtn}>↑ Import</div>
        <div style={solidBtn}>+ Add vendor</div>
      </DashboardHeader>
      <StatsRow verified={1} pending={1} emailed={2} />
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
        <TableHead />
        <VendorRow name="Mehta Textiles Pvt Ltd" email="accounts@mehtax.in" status="Verified"    statusColor="#10b981" statusBg="#d1fae5" action="View →" />
        <VendorRow name="Ravi Auto Parts"         email="ravi@autoparts.co"  status="Email Sent"  statusColor="#6366f1" statusBg="#e0e7ff" />
        <VendorRow name="Gupta Traders"           email="info@gupta.in"      status="Pending"     statusColor="#d97706" statusBg="#fef3c7" />
        <div style={{ position: 'relative', background: `${TEAL}08` }}>
          <VendorRow name="Sharma Industries Ltd" email="accounts@sharmaindustries.in" status="Email Sent" statusColor="#6366f1" statusBg="#e0e7ff"
            action="Resend →" extraStyle={{ background: 'transparent' }}
          />
          {/* Flying email icon */}
          <div style={{ position: 'absolute', right: 40, top: 6, fontSize: 16, animation: 'email-fly 1.2s ease forwards' }}>✉️</div>
        </div>
      </div>
    </SceneShell>
  )
}

// Scene 5: Sharma Industries verified — green badge pops in, stats update
function Scene5() {
  return (
    <SceneShell className="msme-scene-5">
      <DashboardHeader slot="4/5 vendor slots used">
        <div style={addBtn}>↑ Import</div>
        <div style={solidBtn}>+ Add vendor</div>
      </DashboardHeader>
      <StatsRow verified={2} pending={1} emailed={1} />
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
        <TableHead />
        <VendorRow name="Mehta Textiles Pvt Ltd" email="accounts@mehtax.in" status="Verified"    statusColor="#10b981" statusBg="#d1fae5" action="View →" />
        <VendorRow name="Ravi Auto Parts"         email="ravi@autoparts.co"  status="Email Sent"  statusColor="#6366f1" statusBg="#e0e7ff" />
        <VendorRow name="Gupta Traders"           email="info@gupta.in"      status="Pending"     statusColor="#d97706" statusBg="#fef3c7" />
        {/* Verified row with pop animation */}
        <div style={{ padding: '8px 12px', display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: 8, alignItems: 'center', fontSize: 11, background: '#f0fdf4' }}>
          <span style={{ fontWeight: 600, color: DARK }}>Sharma Industries Ltd</span>
          <span style={{ color: MUTED }}>accounts@sharmaindustries.in</span>
          <span style={{ background: '#d1fae5', color: '#10b981', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3, animation: 'badge-pop 0.4s ease forwards' }}>
            <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 20, strokeDashoffset: 20, animation: 'check-draw 0.5s 0.2s ease forwards' }}><polyline points="4 10 8 14 16 6"/></svg>
            Verified
          </span>
          <span style={{ color: TEAL, fontWeight: 600, fontSize: 10 }}>View →</span>
        </div>
      </div>
    </SceneShell>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function MsmeDemoAnimation() {
  return (
    <div style={{ position: 'relative', height: 310, overflow: 'hidden', background: '#fff' }}>
      <style>{css}</style>
      <Scene1 />
      <Scene2 />
      <Scene3 />
      <Scene4 />
      <Scene5 />
    </div>
  )
}
