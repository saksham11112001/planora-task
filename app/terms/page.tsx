import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Terms & Conditions — Taska' }

export default function TermsPage() {
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
          <Link href="/privacy" style={{ color:'#6b7280', textDecoration:'none' }}>Privacy</Link>
          <Link href="/terms"   style={{ color:'#0d9488', fontWeight:600, textDecoration:'none' }}>Terms</Link>
          <Link href="/login"   style={{ color:'#6b7280', textDecoration:'none' }}>Sign in</Link>
        </div>
      </header>

      <main style={{ maxWidth:760, margin:'0 auto', padding:'60px 24px 100px' }}>
        <div style={{ marginBottom:40 }}>
          <div style={{ display:'inline-block', background:'#f0fdfa', color:'#0d9488', fontSize:12, fontWeight:600, padding:'4px 12px', borderRadius:99, border:'1px solid #99f6e4', marginBottom:16 }}>Legal Document</div>
          <h1 style={{ fontSize:36, fontWeight:800, color:'#111827', margin:'0 0 10px', lineHeight:1.15 }}>Terms & Conditions</h1>
          <p style={{ color:'#6b7280', fontSize:14, margin:0 }}>Last updated: {updated}</p>
        </div>

        <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10, padding:'16px 20px', marginBottom:40, fontSize:14, color:'#92400e', lineHeight:1.7 }}>
          <strong>Plain-language summary:</strong> Use Taska for legitimate work purposes, don't misuse it, pay for your plan, and we will keep the service running reliably. Your data is yours — we are just the platform.
        </div>

        {([
          {
            n:'1', title:'Acceptance of Terms',
            body:'By accessing or using Taska ("the Service"), you agree to be bound by these Terms & Conditions. If you are using Taska on behalf of an organisation, you represent that you have authority to bind that organisation. If you do not agree, you must not use the Service.',
          },
          {
            n:'2', title:'Description of Service',
            body:'Taska is a task, project, and workflow management platform for professional teams. The Service includes web and mobile interfaces, a REST API, automated recurring tasks, time tracking, compliance workflow tools, and data import/export features. Features may vary by plan.',
          },
          {
            n:'3', title:'Account Registration',
            body:'You must provide accurate information when creating an account. You are responsible for maintaining the confidentiality of your credentials and for all activity that occurs under your account. You must notify us immediately of any unauthorised access at <strong>support@sngadvisers.com</strong>.',
          },
          {
            n:'4', title:'Acceptable Use',
            body:`You agree not to:<br/>
• Use the Service for any unlawful purpose or in violation of any applicable law<br/>
• Upload malicious code, viruses, or any content intended to harm the Service or other users<br/>
• Attempt to gain unauthorised access to other organisations' data or to our systems<br/>
• Scrape, crawl, or systematically extract data beyond normal application use<br/>
• Resell, sublicense, or commercially exploit the Service without our written consent<br/>
• Use the Service to process data that violates applicable data protection laws<br/><br/>
Violation of this section may result in immediate account suspension without refund.`,
          },
          {
            n:'5', title:'Ownership of Data',
            body:'All data you upload to Taska — including tasks, projects, client information, attachments, and time logs — remains your property. We claim no ownership rights over your content. You grant us a limited licence to store and process your data solely to provide the Service.',
          },
          {
            n:'6', title:'Plans, Billing & Payments',
            body:`Taska offers a free tier and paid subscription plans billed monthly or annually. Paid plans are processed by Razorpay.<br/><br/><strong>Free plan:</strong> Available indefinitely with usage limits. No credit card required.<br/><strong>Paid plans:</strong> Billed in advance. Prices are shown in INR and are inclusive of applicable taxes.<br/><strong>Cancellation:</strong> You may cancel at any time. Access continues until the end of the billing period. No refunds are issued for partial periods except where required by law.<br/><strong>Price changes:</strong> We will give 30 days notice of any price changes via email.`,
          },
          {
            n:'7', title:'Service Availability & SLA',
            body:`We target 99.5% monthly uptime. Planned maintenance is announced at least 48 hours in advance. The Service is provided on an "as-is" basis, and we do not guarantee uninterrupted access.<br/><br/>Supabase (our database provider) has their own uptime commitments which affect our availability. Our status page at <strong>status.sngadvisers.com</strong> reflects current service health.`,
          },
          {
            n:'8', title:'Intellectual Property',
            body:'The Taska name, logo, product design, and code are the intellectual property of SNG Advisers and are protected by copyright and trademark law. You may not copy, modify, or distribute any part of the Service without our written consent.',
          },
          {
            n:'9', title:'Limitation of Liability',
            body:'To the maximum extent permitted by applicable law, SNG Advisers shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunity, arising from your use of the Service. Our total liability to you for any claim shall not exceed the amount you paid us in the 12 months preceding the claim.',
          },
          {
            n:'10', title:'Termination',
            body:`Either party may terminate the agreement at any time. We may suspend or terminate your account if you violate these terms, fail to pay, or if we discontinue the Service (with 30 days notice for the latter).<br/><br/>On termination, you may export your data within 30 days after which it will be permanently deleted.`,
          },
          {
            n:'11', title:'Governing Law & Disputes',
            body:'These Terms are governed by the laws of India. Any dispute shall first be attempted to be resolved through good-faith negotiation. If unresolved within 30 days, disputes shall be subject to the exclusive jurisdiction of the courts of New Delhi, India.',
          },
          {
            n:'12', title:'Changes to These Terms',
            body:'We may update these Terms from time to time. We will notify you of material changes by email and in-app at least 14 days before they take effect. Continued use after the effective date constitutes your acceptance of the updated Terms.',
          },
          {
            n:'13', title:'Contact',
            body:'Legal enquiries: <strong>legal@sngadvisers.com</strong>. Support: <strong>support@sngadvisers.com</strong>. Response time: within 2 business days.',
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

        <div style={{ background:'#f0fdfa', border:'1px solid #99f6e4', borderRadius:12, padding:'24px 28px', marginTop:8, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
          <p style={{ margin:0, fontSize:14, color:'#0f766e', lineHeight:1.7 }}>
            <strong>Questions about these terms?</strong> Email <strong>legal@sngadvisers.com</strong>
          </p>
          <Link href="/privacy" style={{ fontSize:13, color:'#0d9488', fontWeight:600, textDecoration:'none' }}>
            Read our Privacy Policy →
          </Link>
        </div>
      </main>
    </div>
  )
}
