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

  const headline = isFinal
    ? 'Final Request: MSME Registration Details Required'
    : isReminder
    ? 'Follow-up: MSME Registration Details Pending'
    : 'MSME Registration Details Required'

  const urgencyBadge = isFinal
    ? `<div style="display:inline-block;background:#dc262620;color:#dc2626;padding:4px 12px;border-radius:4px;font-size:12px;font-weight:600;margin-bottom:16px;letter-spacing:0.05em">FINAL REQUEST</div>`
    : isReminder
    ? `<div style="display:inline-block;background:#92400e20;color:#92400e;padding:4px 12px;border-radius:4px;font-size:12px;font-weight:600;margin-bottom:16px;letter-spacing:0.05em">REMINDER ${p.attemptNo} OF ${total}</div>`
    : `<div style="display:inline-block;background:${ACCENT}20;color:${ACCENT};padding:4px 12px;border-radius:4px;font-size:12px;font-weight:600;margin-bottom:16px;letter-spacing:0.05em">ACTION REQUIRED</div>`

  const priorRef = isReminder
    ? `<p style="color:#64748b;font-size:14px;margin:0 0 16px;line-height:1.6">Further to our previous communication${p.attemptNo === total ? ` (${total - 1} reminder${total - 2 > 0 ? 's' : ''} sent)` : ''}, your MSME registration details have not yet been received.</p>`
    : ''

  const bodyText = isFinal
    ? `As this is our final request, we urge you to submit your details at the earliest. Under the Micro, Small and Medium Enterprises Development Act (MSMED Act), ${p.orgName} is required to verify the MSME status of all vendors. Delays in submission may affect payment processing timelines.`
    : isReminder
    ? `Your MSME registration details are still pending. ${p.orgName} requires this information to comply with the MSMED Act, 2006 and ensure your payments are processed without delays.`
    : `${p.orgName} is collecting MSME registration details from all vendors as part of their statutory compliance obligations under the MSMED Act, 2006. This process takes less than 2 minutes.`

  return `<!DOCTYPE html><html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">

    <tr><td style="background:#0f172a;padding:20px 32px">
      <span style="color:#fff;font-size:16px;font-weight:700">MSME Compliance — ${p.orgName}</span>
    </td></tr>

    <tr><td style="padding:32px">
      ${urgencyBadge}
      <h1 style="margin:0 0 8px;color:#0f172a;font-size:20px;font-weight:700">${headline}</h1>
      <p style="color:#64748b;font-size:14px;margin:0 0 16px;line-height:1.6">Dear ${p.vendorName},</p>
      ${priorRef}
      <p style="color:#64748b;font-size:14px;margin:0 0 24px;line-height:1.6">${bodyText}</p>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin-bottom:24px">
        <p style="color:#0f172a;font-size:14px;font-weight:600;margin:0 0 12px">Documents and details required:</p>
        <ul style="margin:0;padding-left:20px;font-size:13px;color:#374151;line-height:1.8">
          <li>Udyam Registration Number (from your Udyam certificate)</li>
          <li>MSME Category — Micro, Small, or Medium</li>
          <li>Nature of business — Manufacturer, Service Provider, or Trader</li>
          <li>Last outstanding amount as on 31st March</li>
          <li>Udyam Registration Certificate (PDF/JPG)</li>
        </ul>
        <p style="color:#64748b;font-size:12px;margin:12px 0 0">
          If your business is <strong>not registered as an MSME</strong>, you may submit a declaration to that effect instead.
        </p>
      </div>

      <a href="${p.formUrl}"
        style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600">
        Submit MSME Details
      </a>

      <p style="color:#94a3b8;font-size:12px;margin:24px 0 0;line-height:1.5">
        This link is valid for 30 days. If you have already submitted your details, please disregard this email.<br/>
        Your information will be shared only with ${p.orgName} for statutory compliance purposes.
      </p>
    </td></tr>

    <tr><td style="padding:16px 32px;border-top:1px solid #f1f5f9">
      <p style="color:#94a3b8;font-size:12px;margin:0">On behalf of ${p.orgName} &nbsp;|&nbsp; Powered by upFloat</p>
    </td></tr>

  </table>
  </td></tr></table>
</body></html>`
}
