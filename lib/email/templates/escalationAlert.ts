interface EscalationProps {
  managerName: string; assigneeName: string; taskTitle: string
  dueDate: string; daysOverdue: number; orgName: string
  taskUrl: string; projectName?: string | null
}

export function escalationAlertHtml(p: EscalationProps): string {
  const project = p.projectName
    ? `<p style="color:#64748b;font-size:13px;margin:4px 0 0">📁 ${p.projectName}</p>` : ''
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
        <tr><td style="background:#0f172a;padding:24px 32px">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:#0d9488;border-radius:8px;width:32px;height:32px;text-align:center;vertical-align:middle">
              <span style="color:#fff;font-size:16px;font-weight:700">P</span>
            </td>
            <td style="padding-left:10px;color:#ffffff;font-size:18px;font-weight:700">Taska</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:32px">
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin-bottom:24px;display:flex;align-items:center">
            <span style="font-size:20px;margin-right:8px">🚨</span>
            <p style="color:#991b1b;font-size:13px;font-weight:600;margin:0">Escalation alert — action required</p>
          </div>
          <h1 style="margin:0 0 8px;color:#0f172a;font-size:20px;font-weight:700">Task overdue by ${p.daysOverdue} day${p.daysOverdue === 1 ? '' : 's'}</h1>
          <p style="color:#64748b;font-size:14px;margin:0 0 24px">A task assigned to <strong>${p.assigneeName}</strong> in <strong>${p.orgName}</strong> has not been completed on time.</p>
          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:20px;margin-bottom:24px">
            <p style="color:#0f172a;font-size:15px;font-weight:600;margin:0 0 8px">${p.taskTitle}</p>
            ${project}
            <p style="color:#dc2626;font-size:13px;font-weight:600;margin:12px 0 0">⏰ Was due: ${p.dueDate} · Now ${p.daysOverdue} day${p.daysOverdue === 1 ? '' : 's'} late</p>
          </div>
          <table cellpadding="0" cellspacing="0"><tr>
            <td><a href="${p.taskUrl}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;margin-right:12px">Review task →</a></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #f1f5f9">
          <p style="color:#94a3b8;font-size:12px;margin:0">Taska · Manage notification preferences in Settings</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
