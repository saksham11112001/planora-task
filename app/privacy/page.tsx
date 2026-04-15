import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Privacy Policy — Taska' }

export default function PrivacyPage() {
  const updated = '27 March 2026'
  return (
    <div style={{ minHeight:'100vh', background:'#f8fafb', fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <header style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'0 32px', display:'flex', alignItems:'center', justifyContent:'space-between', height:60 }}>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
          <div style={{ width:30, height:30, borderRadius:8, background:'#0d9488', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg viewBox="0 0 20 20" fill="none" style={{ width:16, height:16 }}><path d="M3 5h14M3 10h10M3 15h7" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <span style={{ fontWeight:700, fontSize:17, color:'#111827' }}>Taska</span>
        </Link>
        <div style={{ display:'flex', gap:20, fontSize:13 }}>
          <Link href="/privacy" style={{ color:'#0d9488', fontWeight:600, textDecoration:'none' }}>Privacy</Link>
          <Link href="/terms"   style={{ color:'#6b7280', textDecoration:'none' }}>Terms</Link>
          <Link href="/login"   style={{ color:'#6b7280', textDecoration:'none' }}>Sign in</Link>
        </div>
      </header>

      <main style={{ maxWidth:760, margin:'0 auto', padding:'60px 24px 100px' }}>
        <div style={{ marginBottom:40 }}>
          <div style={{ display:'inline-block', background:'#f0fdfa', color:'#0d9488', fontSize:12, fontWeight:600, padding:'4px 12px', borderRadius:99, border:'1px solid #99f6e4', marginBottom:16 }}>Legal Document</div>
          <h1 style={{ fontSize:36, fontWeight:800, color:'#111827', margin:'0 0 10px', lineHeight:1.15 }}>Privacy Policy</h1>
          <p style={{ color:'#6b7280', fontSize:14, margin:0 }}>Last updated: {updated}</p>
        </div>

        <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10, padding:'16px 20px', marginBottom:40, fontSize:14, color:'#92400e', lineHeight:1.7 }}>
          <strong>Plain-language summary:</strong> Taska collects only what it needs to run the service, never sells your data, stores everything encrypted on enterprise-grade infrastructure in India, and you can export or delete your data at any time.
        </div>

        {([
          {
            n:'1', title:'Who We Are',
            body:'Taska is a project and task management platform operated by SNG Advisers. Our data controller contact is: <strong>legal@sngadvisers.com</strong>.',
          },
          {
            n:'2', title:'What Data We Collect',
            body:`<strong>Account data:</strong> Your name, email address, and password (bcrypt-hashed — never stored in plaintext).<br/><br/><strong>Organisation data:</strong> Tasks, projects, clients, time logs, comments, and file attachments you create. This data belongs to you.<br/><br/><strong>Usage data:</strong> Aggregated, anonymised page views and error logs used to improve the product.<br/><br/><strong>Payment data:</strong> Processed by Razorpay. We receive only a transaction confirmation and last-four-digit reference — never full card numbers.`,
          },
          {
            n:'3', title:'How We Use Your Data',
            body:`We use your data solely to provide, maintain, and improve Taska — including sending transactional notifications, processing payments, and preventing abuse.<br/><br/>We do <strong>not</strong> use your data to train AI models, serve advertisements, or sell to third parties under any circumstances.`,
          },
          {
            n:'4', title:'Data Storage & Security',
            body:`All data is stored on <strong>Supabase</strong> infrastructure hosted on AWS in the <strong>ap-south-1 (Mumbai)</strong> region — your data stays in India.<br/><br/><strong>Encryption at rest:</strong> AES-256 on all database volumes.<br/><strong>Encryption in transit:</strong> TLS 1.2+ enforced on all connections. HTTP redirects to HTTPS automatically.<br/><strong>Authentication:</strong> Passwords hashed with bcrypt. Sessions use signed JWTs with short expiry.<br/><strong>Row-level security:</strong> Every query is filtered by organisation ID at the database level — one org can never access another's data even if an application bug were to occur.<br/><strong>File attachments:</strong> Stored in private storage buckets, never publicly accessible — served only via signed, time-limited URLs.`,
          },
          {
            n:'5', title:'Data Backup & Retention',
            body:`<strong>Automated backups:</strong> Supabase performs daily automated backups with a 7-day retention window (free tier) or 30 days (paid plans), stored in a separate availability zone.<br/><br/><strong>Point-in-time recovery:</strong> Available on Pro and Business plans.<br/><br/><strong>Account deletion:</strong> When you delete your account, all associated data is permanently deleted within 30 days. Deleted tasks go to Trash and are purged after 30 days.`,
          },
          {
            n:'6', title:'Data Sharing & Sub-processors',
            body:`We share data only with these sub-processors, as necessary to provide the service:<br/><br/><strong>Supabase Inc.</strong> — database & file storage (AWS Mumbai)<br/><strong>Vercel Inc.</strong> — application hosting (USA)<br/><strong>Resend Inc.</strong> — transactional email (USA)<br/><strong>Razorpay Software Pvt. Ltd.</strong> — payment processing (India)<br/><strong>Inngest Inc.</strong> — background job processing (USA)<br/><br/>Each sub-processor is bound by data processing agreements. We share no data with any other third party.`,
          },
          {
            n:'7', title:'Your Rights',
            body:`You have the right to access, export, correct, or delete your data at any time. Export is available in-app at Reports → Tasks CSV or Time CSV. To exercise any other right, email <strong>privacy@sngadvisers.com</strong>. We respond within 30 days.`,
          },
          {
            n:'8', title:'Cookies',
            body:'Taska uses only a technically-necessary authentication session cookie. No advertising, tracking, or analytics cookies are set. No cookie banner is shown.',
          },
          {
            n:'9', title:'Changes to This Policy',
            body:'We will notify you of material changes by email and in-app at least 14 days before they take effect. Continued use after the effective date constitutes acceptance.',
          },
          {
            n:'10', title:'Contact',
            body:'Privacy questions: <strong>privacy@sngadvisers.com</strong>. Response time: within 2 business days.',
          },
        ] as {n:string;title:string;body:string}[]).map(s => (
          <section key={s.n} style={{ marginBottom:36 }}>
            <h2 style={{ fontSize:18, fontWeight:700, color:'#111827', margin:'0 0 12px', display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ width:26, height:26, borderRadius:6, background:'#0d9488', color:'#fff', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{s.n}</span>
              {s.title}
            </h2>
            <div style={{ fontSize:15, color:'#374151', lineHeight:1.8 }} dangerouslySetInnerHTML={{ __html: s.body }}/>
            <div style={{ borderBottom:'1px solid #f3f4f6', marginTop:28 }}/>
          </section>
        ))}

        <div style={{ background:'#f0fdfa', border:'1px solid #99f6e4', borderRadius:12, padding:'24px 28px', marginTop:8 }}>
          <p style={{ margin:0, fontSize:14, color:'#0f766e', lineHeight:1.7 }}>
            <strong>Questions?</strong> Email us at <strong>privacy@sngadvisers.com</strong> — you will get a response from a real person.
          </p>
        </div>
      </main>
    </div>
  )
}
