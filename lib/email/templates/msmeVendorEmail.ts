interface Props {
  vendorName:      string
  orgName:         string
  formUrl:         string
  unsubscribeUrl?: string | null
  attemptNo:       1 | 2 | 3 | 4 | 5
  totalEmails?:    number
  contactName?:    string
  contactEmail?:   string
  contactPhone?:   string
}

const ACCENT = '#0d9488'

// Subject format follows the widely-recognised corporate MSME-exercise style
// (e.g. "Reminder 7 - MSME confirmations of Jones Lang ..."): first email has
// no reminder prefix; follow-ups are numbered sequentially.
export function msmeVendorEmailSubject(p: Props): string {
  if (p.attemptNo === 1)
    return `MSME confirmations of ${p.orgName}`
  const total = p.totalEmails ?? 5
  const n = p.attemptNo - 1   // attempt 2 = Reminder 1, etc.
  if (p.attemptNo === total)
    return `Final Reminder ${n} - MSME confirmations of ${p.orgName}`
  return `Reminder ${n} - MSME confirmations of ${p.orgName}`
}

// Plain-text alternative part. HTML-only email is a classic spam-filter
// negative signal — always send multipart/alternative with a text version.
export function msmeVendorEmailText(p: Props): string {
  const total      = p.totalEmails ?? 5
  const isReminder = p.attemptNo > 1
  const isFinal    = p.attemptNo === total

  const intro = isFinal
    ? `A quick final note — we've reached out a few times but haven't heard back yet.`
    : isReminder
    ? `Just a gentle follow-up on our earlier note.`
    : `As a valued vendor of ${p.orgName}, we need a quick confirmation.`

  return [
    `Dear Sir/Madam,`,
    `${p.vendorName}`,
    ``,
    intro,
    ``,
    `Is your business registered as an MSME (Udyam)? Please let us know:`,
    ``,
    `  YES — we're MSME registered:  ${p.formUrl}?a=msme`,
    `  NO  — we're not an MSME:      ${p.formUrl}?a=not_msme`,
    ``,
    `Why it helps you: registered MSMEs are entitled to protected payment`,
    `timelines under Section 43B(h) of the Income-tax Act — your buyers must`,
    `clear your dues on time or face interest and tax consequences.`,
    ``,
    `Takes about 90 seconds. No login or account needed.`,
    ``,
    `If you are MSME-registered, keep handy: your Udyam Registration Number`,
    `(UDYAM-XX-00-0000000), MSME category (Micro/Small/Medium), nature of`,
    `business, outstanding receivable amount as on 31st March (if any), and`,
    `your Udyam Registration Certificate (PDF or JPG).`,
    ``,
    `Note: if we do not receive any reply within 15 days, we shall presume your`,
    `organisation is not registered under the MSMED Act, 2006.`,
    ``,
    `This link is valid for 30 days. Already submitted? Please ignore this email.`,
    ``,
    `Privacy notice: https://upfloat.co/msme/privacy`,
    ``,
    `Warm regards,`,
    `On behalf of ${p.orgName}`,
    ...(p.contactName && p.contactEmail ? [``, `Questions? Contact ${p.contactName}${p.contactPhone ? ` (${p.contactPhone})` : ''} - ${p.contactEmail}`] : []),
    ``,
    `Powered by upFloat`,
    ...(p.unsubscribeUrl ? [``, `Don't want future emails about this? Unsubscribe: ${p.unsubscribeUrl}`] : []),
  ].join('\n')
}

export function msmeVendorEmailHtml(p: Props): string {
  const hasContact = p.contactName && p.contactEmail
  const total      = p.totalEmails ?? 5
  const isReminder = p.attemptNo > 1
  const isFinal    = p.attemptNo === total

  // One-click answer buttons — the form pre-selects the path from the ?a= param.
  const yesUrl = `${p.formUrl}?a=msme`
  const noUrl  = `${p.formUrl}?a=not_msme`

  const attentionLine = isFinal
    ? `<p style="color:#b45309;font-size:13px;margin:0 0 18px;line-height:1.6">
        A quick final note — we've reached out a few times but haven't heard back yet. It only takes a moment to reply below.
       </p>`
    : isReminder
    ? `<p style="color:#64748b;font-size:13px;margin:0 0 18px;line-height:1.6">
        Just a gentle follow-up on our earlier note — a quick reply below is all we need.
       </p>`
    : ''

  const deadlineColour = isFinal ? '#dc2626' : '#b45309'

  return `<!DOCTYPE html><html lang="en">
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
  <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0">

    <!-- Header -->
    <tr><td style="background:#0f172a;padding:28px 36px">
      <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:0.01em;line-height:1.2">${p.orgName}</div>
      <div style="color:#94a3b8;font-size:12px;margin-top:4px;letter-spacing:0.04em;text-transform:uppercase">MSME Compliance</div>
    </td></tr>

    <!-- Body -->
    <tr><td style="padding:32px 36px">

      <p style="color:#334155;font-size:14px;margin:0 0 18px;line-height:1.7">Dear Sir/Madam,<br/><strong>${p.vendorName}</strong></p>

      ${attentionLine}

      <p style="color:#334155;font-size:15px;margin:0 0 14px;line-height:1.7">
        As a valued vendor of <strong>${p.orgName}</strong>, we just need a quick confirmation:
        <strong>is your business registered as an MSME (Udyam)?</strong>
      </p>

      <!-- Benefit callout -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;margin:0 0 22px">
        <tr><td style="padding:14px 18px">
          <p style="color:#065f46;font-size:13px;line-height:1.7;margin:0">
            💡 <strong>Why it helps you:</strong> registered MSMEs are entitled to protected payment timelines
            under Section&nbsp;43B(h) of the Income-tax Act — your buyers are required to clear your dues on time,
            or face interest and tax consequences. Confirming your status keeps your payments on record and on time.
          </p>
        </td></tr>
      </table>

      <!-- One-click answer buttons -->
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:12px">
        <tr><td align="center" style="background:${ACCENT};border-radius:8px">
          <a href="${yesUrl}" style="display:block;padding:15px 0;font-size:15px;font-weight:700;color:#fff;text-decoration:none">
            ✓ &nbsp;Yes — we're MSME registered
          </a>
        </td></tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:12px">
        <tr><td align="center" style="border:1.5px solid #cbd5e1;border-radius:8px">
          <a href="${noUrl}" style="display:block;padding:13px 0;font-size:15px;font-weight:600;color:#475569;text-decoration:none">
            No — we're not an MSME
          </a>
        </td></tr>
      </table>

      <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:0 0 24px;text-align:center">
        Takes about 90 seconds &nbsp;·&nbsp; No login or account needed &nbsp;·&nbsp; Link valid for 30 days
      </p>

      <!-- Checklist -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px">
        <tr><td style="padding:16px 20px">
          <p style="color:#0f172a;font-size:13px;font-weight:700;margin:0 0 10px">If you are MSME-registered, please keep these handy:</p>
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr><td style="color:#374151;font-size:13px;line-height:1.9;vertical-align:top;padding-right:6px">•</td><td style="color:#374151;font-size:13px;line-height:1.9">Udyam Registration Number (format: UDYAM-XX-00-0000000)</td></tr>
            <tr><td style="color:#374151;font-size:13px;line-height:1.9;vertical-align:top;padding-right:6px">•</td><td style="color:#374151;font-size:13px;line-height:1.9">MSME Category — Micro, Small, or Medium</td></tr>
            <tr><td style="color:#374151;font-size:13px;line-height:1.9;vertical-align:top;padding-right:6px">•</td><td style="color:#374151;font-size:13px;line-height:1.9">Nature of Business — Manufacturer, Service Provider, or Trader</td></tr>
            <tr><td style="color:#374151;font-size:13px;line-height:1.9;vertical-align:top;padding-right:6px">•</td><td style="color:#374151;font-size:13px;line-height:1.9">Outstanding receivable amount as on 31st March (if any)</td></tr>
            <tr><td style="color:#374151;font-size:13px;line-height:1.9;vertical-align:top;padding-right:6px">•</td><td style="color:#374151;font-size:13px;line-height:1.9">Udyam Registration Certificate (PDF or JPG)</td></tr>
          </table>
          <p style="color:#64748b;font-size:12px;line-height:1.6;margin:10px 0 0">
            <strong>Not an MSME?</strong> You can simply declare that — no certificate needed.
          </p>
        </td></tr>
      </table>

      <!-- Notes -->
      <div style="border-top:1px solid #e2e8f0;padding-top:18px;margin-bottom:24px">
        <p style="color:#0f172a;font-size:12px;font-weight:700;margin:0 0 10px">A few things to note:</p>
        <ol style="margin:0;padding-left:18px;font-size:12px;color:#475569;line-height:2">
          <li>This request is part of a compliance exercise under the MSMED Act, 2006 — not a promotional email.</li>
          <li style="color:${deadlineColour};font-weight:600">If we do not receive any reply within 15 days of receiving this email, we shall presume your organisation is not registered under the MSMED Act, 2006.</li>
          <li>${p.orgName} will not be liable for any damages demanded at a later date due to non-compliance of the Act arising from your non-response.</li>
          <li>If you are not the right recipient, please forward this email to the authorised person in your organisation.</li>
        </ol>
      </div>

      <!-- Data & Privacy Notice -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:20px">
        <tr><td style="padding:16px 20px">
          <p style="color:#0f172a;font-size:13px;font-weight:700;margin:0 0 6px">Data & Privacy Notice</p>
          <p style="color:#374151;font-size:12px;line-height:1.7;margin:0 0 8px">
            The above information is collected solely to verify your MSME status as required under the MSMED Act, 2006. It will be retained for the duration of our vendor relationship plus the period mandated under applicable record-retention laws, and securely erased thereafter. It is processed on our behalf by upFloat (data processor) and will not be shared with any third party.
          </p>
          <p style="color:#374151;font-size:12px;line-height:1.7;margin:0 0 8px">
            By submitting this form, you consent to this collection and processing. You may withdraw consent or request correction/erasure at any time by writing to our Grievance Officer (details below), without affecting the lawfulness of prior processing.
          </p>
          <p style="color:#374151;font-size:12px;line-height:1.7;margin:0">
            Full privacy notice: <a href="https://upfloat.co/msme/privacy" style="color:#0d9488;text-decoration:underline">upfloat.co/msme/privacy</a>
          </p>
        </td></tr>
      </table>

    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:20px 36px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <p style="color:#334155;font-size:13px;margin:0 0 4px;line-height:1.6">Warm regards,<br/><strong>On Behalf of ${p.orgName}</strong></p>
      ${hasContact ? `
      <p style="color:#475569;font-size:12px;margin:12px 0 0;line-height:1.8">
        <strong style="color:#0f172a">Questions? Contact us:</strong><br/>
        ${p.contactName}${p.contactPhone ? ` &nbsp;·&nbsp; ${p.contactPhone}` : ''}<br/>
        <a href="mailto:${p.contactEmail}" style="color:${ACCENT};text-decoration:none">${p.contactEmail}</a>
      </p>` : ''}
      <p style="color:#94a3b8;font-size:11px;margin:8px 0 0">Powered by upFloat</p>
      ${p.unsubscribeUrl ? `<p style="color:#cbd5e1;font-size:10px;margin:10px 0 0">
        Don't want future emails about this?
        <a href="${p.unsubscribeUrl}" style="color:#94a3b8;text-decoration:underline">Unsubscribe</a>
      </p>` : ''}
    </td></tr>

  </table>
  </td></tr></table>
</body></html>`
}
