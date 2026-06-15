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
    ? 'Final reminder: MSME details required'
    : isReminder
    ? 'Gentle reminder: your MSME details are pending'
    : 'We need your MSME registration details'

  const urgencyBadge = isFinal
    ? `<div style="display:inline-block;background:#dc262620;color:#dc2626;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:16px">⚠️ Final reminder</div>`
    : isReminder
    ? `<div style="display:inline-block;background:#ca8a0420;color:#ca8a04;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:16px">⏰ Reminder ${p.attemptNo} of ${total}</div>`
    : `<div style="display:inline-block;background:${ACCENT}20;color:${ACCENT};padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:16px">📋 Action required</div>`

  const bodyText = isFinal
    ? `This is our final attempt to collect your MSME registration details. Under the MSMED Act, ${p.orgName} is required to verify the MSME status of all vendors. If we do not receive your details, we may not be able to process payments within the standard timeline.`
    : isReminder
    ? `We noticed you haven't filled in your MSME registration details yet. ${p.orgName} needs this information to comply with the MSMED Act and ensure your payments are processed on time.`
    : `${p.orgName} is collecting MSME registration details from all vendors as part of their statutory compliance under the MSMED Act, 2006. This takes less than 2 minutes.`

  return `<!DOCTYPE html><html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">

    <tr><td style="background:#0f172a;padding:20px 32px">
      <span style="color:#fff;font-size:16px;font-weight:700">⚡ ${p.orgName}</span>
    </td></tr>

    <tr><td style="padding:32px">
      ${urgencyBadge}
      <h1 style="margin:0 0 8px;color:#0f172a;font-size:20px;font-weight:700">${headline}</h1>
      <p style="color:#64748b;font-size:14px;margin:0 0 24px;line-height:1.6">
        Hi ${p.vendorName}, ${bodyText}
      </p>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin-bottom:24px">
        <p style="color:#0f172a;font-size:14px;font-weight:600;margin:0 0 12px">What you'll need to provide:</p>
        <ul style="margin:0;padding-left:20px;font-size:13px;color:#374151;line-height:1.8">
          <li>Udyam Registration Number (from your Udyam certificate)</li>
          <li>MSME Category — Micro, Small, or Medium</li>
          <li>Nature of business — Manufacturer, Service Provider, or Trader</li>
          <li>Last outstanding amount as on 31st March</li>
          <li>Upload your Udyam Registration Certificate (PDF/JPG)</li>
        </ul>
        <p style="color:#64748b;font-size:12px;margin:12px 0 0">
          If you are <strong>not registered as an MSME</strong>, you can submit a declaration instead.
        </p>
      </div>

      <a href="${p.formUrl}"
        style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600">
        Fill MSME Details →
      </a>

      <p style="color:#94a3b8;font-size:12px;margin:24px 0 0;line-height:1.5">
        This link is valid for 30 days. If you've already submitted your details, please ignore this email.<br/>
        Your information is shared only with ${p.orgName} for compliance purposes.
      </p>
    </td></tr>

    <tr><td style="padding:16px 32px;border-top:1px solid #f1f5f9">
      <p style="color:#94a3b8;font-size:12px;margin:0">${p.orgName} · Powered by Floatup</p>
    </td></tr>

  </table>
  </td></tr></table>
</body></html>`
}
