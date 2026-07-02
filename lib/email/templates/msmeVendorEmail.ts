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

export function msmeVendorEmailSubject(p: Props): string {
  if (p.attemptNo === 1)
    return `Action required: Share your MSME details with ${p.orgName}`
  const total = p.totalEmails ?? 5
  if (p.attemptNo === total)
    return `Final reminder: MSME compliance details required — ${p.orgName}`
  return `Reminder ${p.attemptNo}: MSME certificate details still pending — ${p.orgName}`
}

// Plain-text alternative part. HTML-only email is a classic spam-filter
// negative signal — always send multipart/alternative with a text version.
export function msmeVendorEmailText(p: Props): string {
  const total      = p.totalEmails ?? 5
  const isReminder = p.attemptNo > 1
  const isFinal    = p.attemptNo === total

  const intro = isFinal
    ? `FINAL REMINDER: We've sent ${total - 1} earlier email${total - 2 > 0 ? 's' : ''} but haven't received your MSME details yet.`
    : isReminder
    ? `REMINDER: We're following up on our earlier request for your MSME registration details.`
    : `${p.orgName} is collecting MSME registration details from all vendors, as required under the MSMED Act, 2006.`

  return [
    `Dear Sir/Madam,`,
    `${p.vendorName}`,
    ``,
    intro,
    ``,
    `Please fill in the short form (takes less than 2 minutes):`,
    p.formUrl,
    ``,
    `If you are MSME-registered, keep handy: your Udyam Registration Number`,
    `(UDYAM-XX-00-0000000), MSME category (Micro/Small/Medium), nature of`,
    `business, outstanding receivable amount as on 31st March (if any), and`,
    `your Udyam Registration Certificate (PDF or JPG).`,
    ``,
    `Not an MSME? You can simply declare that on the form - no certificate needed.`,
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

  const attentionLine = isFinal
    ? `<p style="font-weight:700;color:#0f172a;font-size:14px;margin:0 0 16px;line-height:1.6">
        ⚠️ We haven't heard back despite ${total - 1} earlier email${total - 2 > 0 ? 's' : ''}. This is our final request before we mark your status as unresponsive.
       </p>`
    : isReminder
    ? `<p style="font-weight:700;color:#0f172a;font-size:14px;margin:0 0 16px;line-height:1.6">
        We noticed you haven't responded to our earlier email. Just a gentle nudge!
       </p>`
    : ''

  const bodyText = isFinal
    ? `We've sent you ${total - 1} reminder${total - 2 > 0 ? 's' : ''} but haven't received your MSME details yet. Please take a moment to fill in the short form below — it takes less than 2 minutes.`
    : isReminder
    ? `We're following up on our earlier request for your MSME registration details. Please take a moment to fill in the short form below — it won't take more than 2 minutes.`
    : `${p.orgName} is collecting MSME registration details from all vendors. This is a standard compliance step required under the MSMED Act, 2006. We just need to know whether your business is registered as an MSME or not — it takes less than 2 minutes.`

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

      <p style="color:#334155;font-size:14px;margin:0 0 20px;line-height:1.7">Dear Sir/Madam,<br/><strong>${p.vendorName}</strong></p>

      ${attentionLine}

      <p style="color:#334155;font-size:14px;margin:0 0 24px;line-height:1.7">${bodyText}</p>

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

      <!-- CTA Button -->
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px">
        <tr><td align="center" style="background:${ACCENT};border-radius:8px">
          <a href="${p.formUrl}"
            style="display:block;padding:14px 0;font-size:15px;font-weight:700;color:#fff;text-decoration:none;letter-spacing:0.01em">
            Submit MSME Details →
          </a>
        </td></tr>
      </table>

      <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:0 0 20px">
        This link is valid for 30 days. Already submitted? You can ignore this email.
      </p>

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
