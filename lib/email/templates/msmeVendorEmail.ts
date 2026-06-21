interface Props {
  vendorName:  string
  orgName:     string
  formUrl:     string
  attemptNo:   1 | 2 | 3 | 4 | 5
  totalEmails?: number  // total emails in the sequence (default 5)
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

export function msmeVendorEmailHtml(p: Props): string {
  const total      = p.totalEmails ?? 5
  const isReminder = p.attemptNo > 1
  const isFinal    = p.attemptNo === total

  const attentionLine = isFinal
    ? `<p style="font-weight:700;color:#0f172a;font-size:14px;margin:0 0 16px;line-height:1.6">
        ⚠️ It has come to our attention that despite ${total - 1} previous reminder${total - 2 > 0 ? 's' : ''}, your MSME details have not yet been submitted. This is our final request.
       </p>`
    : isReminder
    ? `<p style="font-weight:700;color:#0f172a;font-size:14px;margin:0 0 16px;line-height:1.6">
        It has come to our attention that you have missed to respond to the previous email.
       </p>`
    : ''

  const bodyText = isFinal
    ? `We have sent you ${total - 1} reminder${total - 2 > 0 ? 's' : ''} regarding your MSME registration status, but we have not yet received a response. Kindly submit your details at the earliest using the button below.`
    : isReminder
    ? `We are writing to follow up on our earlier request for your MSME registration details. Your response is still awaited. Kindly complete the short form below at your earliest convenience to ensure uninterrupted payment processing.`
    : `${p.orgName} is in the process of updating its vendor records for MSME compliance, as mandated under the Micro, Small and Medium Enterprises Development Act (MSMED Act), 2006. We request you to confirm whether your business holds a valid Udyam Registration, or whether it is not registered as an MSME. The process takes less than two minutes.`

  const deadlineColour = isFinal ? '#dc2626' : '#b45309'

  return `<!DOCTYPE html><html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
  <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0">

    <!-- Header -->
    <tr><td style="background:#0f172a;padding:28px 36px">
      <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:0.01em;line-height:1.2">${p.orgName}</div>
      <div style="color:#94a3b8;font-size:12px;margin-top:4px;letter-spacing:0.04em;text-transform:uppercase">MSME Compliance Notice</div>
    </td></tr>

    <!-- Body -->
    <tr><td style="padding:32px 36px">

      <p style="color:#334155;font-size:14px;margin:0 0 20px;line-height:1.7">Dear Sir/Madam,<br/><strong>${p.vendorName}</strong></p>

      ${attentionLine}

      <p style="color:#334155;font-size:14px;margin:0 0 20px;line-height:1.7">${bodyText}</p>

      <p style="color:#334155;font-size:14px;margin:0 0 24px;line-height:1.7">
        This is an <strong>MSME confirmation request</strong> issued in accordance with the requirements of the MSMED Act, 2006.
      </p>

      <!-- Checklist -->
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin-bottom:28px">
        <p style="color:#0f172a;font-size:13px;font-weight:700;margin:0 0 10px;text-transform:uppercase;letter-spacing:0.05em">If MSME-registered, please keep the following ready:</p>
        <ul style="margin:0;padding-left:20px;font-size:13px;color:#374151;line-height:2">
          <li>Udyam Registration Number (format: UDYAM-XX-00-0000000)</li>
          <li>MSME Category — Micro, Small, or Medium</li>
          <li>Nature of Business — Manufacturer, Service Provider, or Trader</li>
          <li>Outstanding receivable amount as on 31st March (if any)</li>
          <li>Udyam Registration Certificate (PDF or JPG)</li>
        </ul>
        <p style="color:#64748b;font-size:12px;margin:10px 0 0;line-height:1.6">
          If your business is <strong>not registered as an MSME</strong>, you may submit a simple declaration. No certificate is required.
        </p>
      </div>

      <!-- CTA Button -->
      <table cellpadding="0" cellspacing="0" style="margin-bottom:28px"><tr><td>
        <a href="${p.formUrl}"
          style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:700;letter-spacing:0.01em">
          Submit MSME Details →
        </a>
      </td></tr></table>

      <!-- Numbered Notes -->
      <div style="border-top:1px solid #e2e8f0;padding-top:20px">
        <p style="color:#0f172a;font-size:13px;font-weight:700;margin:0 0 12px">Notes:</p>
        <ol style="margin:0;padding-left:20px;font-size:12px;color:#475569;line-height:2">
          <li>This email has been sent as part of a statutory compliance exercise under the MSMED Act, 2006.</li>
          <li>If you have already submitted your details, kindly disregard this communication.</li>
          <li style="color:${deadlineColour};font-weight:600">
            Failure to respond will result in your MSME status being presumed as <em>Not Registered</em> for the purpose of our vendor records. This may affect future payment timelines as per Section 15 of the MSMED Act.
          </li>
          <li>${p.orgName} shall not be held liable for any consequence arising from non-submission or incorrect submission of MSME details by the vendor.</li>
          <li>Your information will be used solely for statutory compliance purposes and will not be shared with any third party.</li>
        </ol>
      </div>

    </td></tr>

    <!-- Footer / Sign-off -->
    <tr><td style="padding:20px 36px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <p style="color:#334155;font-size:13px;margin:0 0 4px;line-height:1.6">Regards,<br/><strong>On Behalf of ${p.orgName}</strong></p>
      <p style="color:#94a3b8;font-size:11px;margin:8px 0 0">Powered by upFloat</p>
    </td></tr>

  </table>
  </td></tr></table>
</body></html>`
}
