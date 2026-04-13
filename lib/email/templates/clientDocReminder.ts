interface Props {
  clientName:  string
  orgName:     string
  taskTitle:   string
  dueDate:     string
  collectionDeadline: string
  daysLeft:    number   // days until collection deadline (can be 0 or negative)
  portalUrl:   string
  missingDocs: string[] // list of document names still needed
}

export function clientDocReminderHtml(p: Props): string {
  const isOverdue  = p.daysLeft < 0
  const isToday    = p.daysLeft === 0
  const accentColor = isOverdue ? '#dc2626' : isToday ? '#ea580c' : p.daysLeft <= 2 ? '#ca8a04' : '#0d9488'

  const subjectLine = isOverdue
    ? `Deadline passed — documents still needed for ${p.taskTitle}`
    : isToday
    ? `Today is the deadline — please upload documents for ${p.taskTitle}`
    : `Upload needed in ${p.daysLeft} day${p.daysLeft === 1 ? '' : 's'}: ${p.taskTitle}`

  const headline = isOverdue
    ? 'Documents overdue'
    : isToday
    ? 'Document deadline is today'
    : `Documents needed in ${p.daysLeft} day${p.daysLeft === 1 ? '' : 's'}`

  const intro = isOverdue
    ? `The document collection deadline for <strong>${p.taskTitle}</strong> has passed. Please upload the required documents as soon as possible.`
    : isToday
    ? `Today is the last day to upload documents for <strong>${p.taskTitle}</strong>. Please act now to avoid delays.`
    : `Please upload the following documents for <strong>${p.taskTitle}</strong> before the deadline.`

  const missingList = p.missingDocs
    .map(d => `<li style="margin-bottom:4px;color:#0f172a">${d}</li>`)
    .join('')

  return `<!DOCTYPE html><html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
    <tr><td style="background:#0f172a;padding:20px 32px">
      <span style="color:#fff;font-size:16px;font-weight:700">⚡ ${p.orgName}</span>
    </td></tr>
    <tr><td style="padding:32px">
      <div style="display:inline-block;background:${accentColor}20;color:${accentColor};padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:16px">
        📎 ${headline}
      </div>
      <h1 style="margin:0 0 8px;color:#0f172a;font-size:20px;font-weight:700">Action required</h1>
      <p style="color:#64748b;font-size:14px;margin:0 0 20px">Hi ${p.clientName}, ${intro}</p>

      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:20px;margin-bottom:20px">
        <p style="color:#0f172a;font-size:15px;font-weight:600;margin:0 0 8px">${p.taskTitle}</p>
        <p style="color:#64748b;font-size:13px;margin:0 0 4px">📅 Filing deadline: <strong>${p.dueDate}</strong></p>
        <p style="color:${accentColor};font-size:13px;font-weight:600;margin:0">⬆ Upload by: <strong>${p.collectionDeadline}</strong></p>
      </div>

      ${p.missingDocs.length > 0 ? `
      <div style="margin-bottom:20px">
        <p style="font-size:13px;font-weight:600;color:#0f172a;margin:0 0 8px">Documents still needed:</p>
        <ul style="padding-left:20px;margin:0;font-size:13px">${missingList}</ul>
      </div>` : ''}

      <a href="${p.portalUrl}" style="display:inline-block;background:${accentColor};color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">
        Upload documents →
      </a>
    </td></tr>
    <tr><td style="padding:16px 32px;border-top:1px solid #f1f5f9">
      <p style="color:#94a3b8;font-size:12px;margin:0">${p.orgName} · Powered by Planora</p>
    </td></tr>
  </table>
  </td></tr></table>
</body></html>`
}

export function clientDocReminderSubject(p: Props): string {
  if (p.daysLeft < 0)  return `⚠️ Overdue: documents needed for ${p.taskTitle}`
  if (p.daysLeft === 0) return `🚨 Today's deadline: upload documents for ${p.taskTitle}`
  if (p.daysLeft <= 2)  return `⏰ ${p.daysLeft}d left: upload documents for ${p.taskTitle}`
  return `📎 Action needed: documents due in ${p.daysLeft} days — ${p.taskTitle}`
}
