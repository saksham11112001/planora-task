export function approvalRequestedHtml(p: {
  taskTitle: string; submitterName: string; orgName: string; taskUrl: string
}): string {
  return `<!DOCTYPE html><html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
    <tr><td style="background:#0f172a;padding:20px 32px"><span style="color:#fff;font-size:16px;font-weight:700">⚡ Planora</span></td></tr>
    <tr><td style="padding:32px">
      <div style="display:inline-block;background:#fffbeb;color:#ca8a04;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:16px">🔔 Approval needed</div>
      <h1 style="margin:0 0 8px;color:#0f172a;font-size:20px;font-weight:700">Task submitted for review</h1>
      <p style="color:#64748b;font-size:14px;margin:0 0 24px"><strong>${p.submitterName}</strong> completed a task and needs your approval in <strong>${p.orgName}</strong></p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px">
        <p style="color:#0f172a;font-size:16px;font-weight:600;margin:0">${p.taskTitle}</p>
      </div>
      <a href="${p.taskUrl}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">Review & approve →</a>
    </td></tr>
  </table>
  </td></tr></table>
</body></html>`
}

export function approvalResultHtml(p: {
  taskTitle: string; decision: 'approved' | 'rejected'
  reviewerName: string; orgName: string; taskUrl: string
}): string {
  const approved = p.decision === 'approved'
  const color    = approved ? '#16a34a' : '#dc2626'
  const bg       = approved ? '#f0fdf4' : '#fef2f2'
  const border   = approved ? '#bbf7d0' : '#fecaca'
  const icon     = approved ? '✅' : '❌'
  const label    = approved ? 'Approved' : 'Rejected'

  return `<!DOCTYPE html><html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
    <tr><td style="background:#0f172a;padding:20px 32px"><span style="color:#fff;font-size:16px;font-weight:700">⚡ Planora</span></td></tr>
    <tr><td style="padding:32px">
      <div style="display:inline-block;background:${bg};color:${color};padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:16px">${icon} Task ${label}</div>
      <h1 style="margin:0 0 8px;color:#0f172a;font-size:20px;font-weight:700">Your task was ${label.toLowerCase()}</h1>
      <p style="color:#64748b;font-size:14px;margin:0 0 24px"><strong>${p.reviewerName}</strong> reviewed your task in <strong>${p.orgName}</strong></p>
      <div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:20px;margin-bottom:24px">
        <p style="color:#0f172a;font-size:16px;font-weight:600;margin:0">${p.taskTitle}</p>
      </div>
      <a href="${p.taskUrl}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">View task →</a>
    </td></tr>
  </table>
  </td></tr></table>
</body></html>`
}
