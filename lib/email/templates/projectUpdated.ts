interface ProjectProps {
  projectName: string; oldStatus: string; newStatus: string
  updatedBy: string; orgName: string; projectUrl: string; memberName: string
}

const STATUS_COLORS: Record<string, string> = {
  active: '#16a34a', on_hold: '#d97706', completed: '#0d9488', cancelled: '#dc2626'
}
const STATUS_LABELS: Record<string, string> = {
  active: 'Active', on_hold: 'On Hold', completed: 'Completed', cancelled: 'Cancelled'
}

export function projectUpdatedHtml(p: ProjectProps): string {
  const newColor = STATUS_COLORS[p.newStatus] ?? '#64748b'
  const newLabel = STATUS_LABELS[p.newStatus] ?? p.newStatus
  const oldLabel = STATUS_LABELS[p.oldStatus] ?? p.oldStatus
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
          <h1 style="margin:0 0 8px;color:#0f172a;font-size:20px;font-weight:700">Project status updated</h1>
          <p style="color:#64748b;font-size:14px;margin:0 0 24px">${p.updatedBy} updated a project in <strong>${p.orgName}</strong></p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:20px">
            <p style="color:#0f172a;font-size:16px;font-weight:700;margin:0 0 12px">📁 ${p.projectName}</p>
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="background:#fee2e2;color:#991b1b;padding:4px 12px;border-radius:99px;font-size:12px;font-weight:600">${oldLabel}</td>
              <td style="padding:0 12px;color:#64748b;font-size:14px">→</td>
              <td style="padding:4px 12px;border-radius:99px;font-size:12px;font-weight:600;color:#fff" bgcolor="${newColor}">${newLabel}</td>
            </tr></table>
          </div>
          <a href="${p.projectUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">View project →</a>
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
