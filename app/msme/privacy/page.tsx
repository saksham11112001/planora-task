// Public DPDP privacy notice for MSME vendor data collection.
// Linked from the vendor form consent checkbox and vendor emails.
// Written to satisfy the notice requirements of the Digital Personal Data
// Protection Act, 2023 read with the DPDP Rules, 2025: itemised description of
// the personal data, purpose of processing, data principal rights, grievance
// mechanism, and the right to complain to the Data Protection Board of India.
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'MSME Data Privacy Notice',
  robots: { index: true, follow: true },
}

const ACCENT = '#0d9488'

export default function MsmePrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '40px 16px', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", colorScheme: 'light' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '36px 32px' }}>

        <div style={{ borderBottom: '2px solid ' + ACCENT, paddingBottom: 16, marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0 }}>Privacy Notice — MSME Vendor Data Collection</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '8px 0 0' }}>
            Issued under the Digital Personal Data Protection Act, 2023 (&ldquo;DPDP Act&rdquo;) and the DPDP Rules, 2025.
            Last updated: 2 July 2026.
          </p>
        </div>

        <Section title="Who is collecting your data">
          <p style={p}>
            The business that sent you the MSME details request (named in the email and on the form — the
            &ldquo;<strong>Requesting Business</strong>&rdquo;) is the <strong>Data Fiduciary</strong> for the information you submit.
            upFloat (operated by SNG Adwisers) provides the software platform and acts as a <strong>Data Processor</strong> on the
            Requesting Business&rsquo;s behalf. Your data is not sold, and is not shared with any third party other than the
            Requesting Business and the infrastructure providers that host the platform.
          </p>
        </Section>

        <Section title="What personal data we collect">
          <ul style={ul}>
            <li style={li}>Your name (as the authorised signatory making the declaration)</li>
            <li style={li}>Your business contact email address (provided by the Requesting Business)</li>
            <li style={li}>Business identifiers: Udyam Registration Number, GSTIN and/or PAN where applicable</li>
            <li style={li}>MSME classification details: category (Micro / Small / Medium) and nature of business</li>
            <li style={li}>Outstanding receivable amount from the Requesting Business (if declared)</li>
            <li style={li}>Documents you upload: Udyam Registration Certificate and any supporting proof</li>
          </ul>
        </Section>

        <Section title="Why we collect it (purpose)">
          <p style={p}>
            Solely to enable the Requesting Business to verify your enterprise&rsquo;s MSME registration status and comply
            with its statutory obligations under the <strong>Micro, Small and Medium Enterprises Development Act, 2006</strong> and
            <strong> Section 43B(h) of the Income-tax Act, 1961</strong> (timely-payment and disclosure requirements). Your data is
            not used for marketing or any unrelated purpose.
          </p>
        </Section>

        <Section title="Legal basis">
          <p style={p}>
            Your <strong>consent</strong>, given by ticking the consent checkbox before submitting the form. Submitting the form is
            entirely voluntary. If you do not respond, the Requesting Business may presume (as stated in its email) that your
            organisation is not registered under the MSMED Act, 2006.
          </p>
        </Section>

        <Section title="How long we keep it (retention)">
          <p style={p}>
            Your data is retained for the duration of your vendor relationship with the Requesting Business, plus the period
            for which the Requesting Business is required to preserve compliance records under applicable law (including the
            Income-tax Act, 1961 and the Companies Act, 2013), and is deleted thereafter. Form links expire automatically
            30 days after issue.
          </p>
        </Section>

        <Section title="Your rights under the DPDP Act">
          <ul style={ul}>
            <li style={li}><strong>Access</strong> — request a summary of the personal data held about you</li>
            <li style={li}><strong>Correction &amp; erasure</strong> — request correction of inaccurate data or deletion of your data</li>
            <li style={li}><strong>Withdraw consent</strong> — at any time, with effect going forward (this does not affect the lawfulness of processing already carried out)</li>
            <li style={li}><strong>Grievance redressal</strong> — have your complaint addressed within the timelines set by the DPDP Rules</li>
            <li style={li}><strong>Nominate</strong> — nominate another person to exercise these rights on your behalf</li>
          </ul>
          <p style={p}>
            To exercise any of these rights, contact the Requesting Business at the contact details given in the email you
            received, or write to upFloat&rsquo;s grievance contact below — we will route your request to the Requesting Business
            and assist in fulfilling it.
          </p>
        </Section>

        <Section title="Opting out of emails">
          <p style={p}>
            Every email in this exercise contains an <strong>Unsubscribe</strong> link. Clicking it permanently stops further
            emails about this request to your address.
          </p>
        </Section>

        <Section title="Security">
          <p style={p}>
            Data is transmitted over HTTPS, stored with encryption at rest, and accessible only to the Requesting Business
            through authenticated, role-restricted accounts. Uploaded documents are stored in access-controlled object storage.
            Form links are single-use, unique to you, and expire automatically.
          </p>
        </Section>

        <Section title="Grievance Officer / contact">
          <p style={p}>
            <strong>Platform grievance contact (upFloat):</strong> <a href="mailto:support@upfloat.co" style={a}>support@upfloat.co</a><br />
            We acknowledge grievances promptly and resolve them within the timelines prescribed under the DPDP Rules, 2025.
          </p>
        </Section>

        <Section title="Complaints to the Data Protection Board">
          <p style={p}>
            If you are not satisfied with the resolution of your grievance, you have the right to lodge a complaint with the
            <strong> Data Protection Board of India</strong> constituted under the DPDP Act, 2023, after first exhausting the
            grievance redressal mechanism above.
          </p>
        </Section>

        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 28, borderTop: '1px solid #f1f5f9', paddingTop: 16, lineHeight: 1.6 }}>
          This notice is provided in English. If you require it in another language listed in the Eighth Schedule to the
          Constitution of India, please write to <a href="mailto:support@upfloat.co" style={a}>support@upfloat.co</a> and we
          will provide a translation. Powered by upFloat.
        </p>

      </div>
    </div>
  )
}

const p: React.CSSProperties  = { fontSize: 13.5, color: '#334155', lineHeight: 1.7, margin: '0 0 8px' }
const ul: React.CSSProperties = { margin: '0 0 8px', paddingLeft: 20 }
const li: React.CSSProperties = { fontSize: 13.5, color: '#334155', lineHeight: 1.9 }
const a: React.CSSProperties  = { color: ACCENT, textDecoration: 'underline' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>{title}</h2>
      {children}
    </div>
  )
}
