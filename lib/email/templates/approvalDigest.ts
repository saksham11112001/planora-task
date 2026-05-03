const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://taska.in'

interface DigestTask {
  taskId: string; taskTitle: string; assigneeName: string
  dueDate?: string | null; projectId?: string | null
}

export function approvalDigestHtml(p: {
  approverName: string; orgName: string; tasks: DigestTask[]
}): string {
  const rows = p.tasks.map(t => {
    const url = t.projectId ? `${APP_URL}/projects/${t.projectId}` : `${APP_URL}/approvals`
    const due = t.dueDate
      ? `<span style="color:#dc2626;font-size:11px;font-weight:600">Due ${t.dueDate}</span>`
      : ''
    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;vertical-align:top">
          <a href="${url}" style="color:#0f172a;font-size:14px;font-weight:600;text-decoration:none;display:block;margin-bottom:2px">${t.taskTitle}</a>
          <span style="color:#64748b;font-size:12px">From ${t.assigneeName}</span>
          ${due ? `&ensp;${due}` : ''}
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;vertical-align:top;text-align:right;white-space:nowrap">
          <a href="${url}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:5px 12px;border-radius:6px;font-size:12px;font-weight:600">Review →</a>
        </td>
      </tr>`
  }).join('')

  return `<!DOCTYPE html><html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
    <tr><td style="background:#0f172a;padding:20px 32px"><span style="color:#fff;font-size:16px;font-weight:700">⚡ Floatup</span></td></tr>
    <tr><td style="padding:32px">
      <div style="display:inline-block;background:#fffbeb;color:#ca8a04;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:16px">🔔 Morning approval summary</div>
      <h1 style="margin:0 0 6px;color:#0f172a;font-size:20px;font-weight:700">You have ${p.tasks.length} task${p.tasks.length !== 1 ? 's' : ''} waiting for approval</h1>
      <p style="color:#64748b;font-size:14px;margin:0 0 24px">Good morning, ${p.approverName}. Here's your pending review list for <strong>${p.orgName}</strong>.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f1f5f9">
        ${rows}
      </table>
      <div style="margin-top:24px">
        <a href="${APP_URL}/approvals" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">Open Approvals →</a>
      </div>
    </td></tr>
    <tr><td style="padding:16px 32px;border-top:1px solid #f1f5f9">
      <p style="color:#94a3b8;font-size:12px;margin:0">Floatup · Manage notification preferences in Settings</p>
    </td></tr>
  </table>
  </td></tr></table>
</body></html>`
}
