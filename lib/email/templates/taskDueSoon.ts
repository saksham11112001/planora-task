interface Props {
  taskTitle: string; assigneeName: string; orgName: string
  dueDate: string; hoursLeft: number; projectName?: string | null; taskUrl: string
}

export function taskDueSoonHtml(p: Props): string {
  const urgency = p.hoursLeft <= 2 ? '#dc2626' : p.hoursLeft <= 6 ? '#ea580c' : '#ca8a04'
  const label   = p.hoursLeft <= 1 ? 'Due in under 1 hour!'
    : p.hoursLeft <= 24 ? `Due in ${p.hoursLeft} hours`
    : `Due today`

  return `<!DOCTYPE html><html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
    <tr><td style="background:#0f172a;padding:20px 32px">
      <span style="color:#fff;font-size:16px;font-weight:700">⚡ Planora</span>
    </td></tr>
    <tr><td style="padding:32px">
      <div style="display:inline-block;background:${urgency}20;color:${urgency};padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:16px">
        ⏰ ${label}
      </div>
      <h1 style="margin:0 0 8px;color:#0f172a;font-size:20px;font-weight:700">Task reminder</h1>
      <p style="color:#64748b;font-size:14px;margin:0 0 24px">Hi ${p.assigneeName}, you have a task due soon in <strong>${p.orgName}</strong></p>
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:20px;margin-bottom:24px">
        <p style="color:#0f172a;font-size:16px;font-weight:600;margin:0 0 8px">${p.taskTitle}</p>
        ${p.projectName ? `<p style="color:#64748b;font-size:13px;margin:0 0 4px">📁 ${p.projectName}</p>` : ''}
        <p style="color:${urgency};font-size:13px;font-weight:600;margin:0">📅 Due: ${p.dueDate}</p>
      </div>
      <a href="${p.taskUrl}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">Open task →</a>
    </td></tr>
    <tr><td style="padding:16px 32px;border-top:1px solid #f1f5f9">
      <p style="color:#94a3b8;font-size:12px;margin:0">Planora · ${p.orgName}</p>
    </td></tr>
  </table>
  </td></tr></table>
</body></html>`
}

export function taskDueSoonText(p: Props): string {
  return `Hi ${p.assigneeName},

Reminder: you have a task due soon!

"${p.taskTitle}"
${p.projectName ? `Project: ${p.projectName}` : ''}
Due: ${p.dueDate}

Open task: ${p.taskUrl}

— Planora`
}
