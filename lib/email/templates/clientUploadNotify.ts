interface Props {
  assigneeName: string
  clientName:   string
  orgName:      string
  taskTitle:    string
  docTypeName:  string
  periodKey:    string
  fileName:     string
  taskUrl:      string
}

export function clientUploadNotifyHtml(p: Props): string {
  const periodLabel = formatPeriodKey(p.periodKey)

  return `<!DOCTYPE html><html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
    <tr><td style="background:#0f172a;padding:20px 32px">
      <span style="color:#fff;font-size:16px;font-weight:700">⚡ Taska</span>
    </td></tr>
    <tr><td style="padding:32px">
      <div style="display:inline-block;background:rgba(13,148,136,0.1);color:#0d9488;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:16px">
        📤 Document uploaded by client
      </div>
      <h1 style="margin:0 0 8px;color:#0f172a;font-size:20px;font-weight:700">New client upload</h1>
      <p style="color:#64748b;font-size:14px;margin:0 0 24px">
        Hi ${p.assigneeName}, <strong>${p.clientName}</strong> has uploaded a document for a task assigned to you in <strong>${p.orgName}</strong>.
      </p>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin-bottom:24px">
        <p style="color:#0f172a;font-size:15px;font-weight:600;margin:0 0 10px">${p.taskTitle}</p>
        <table cellpadding="0" cellspacing="0">
          <tr><td style="padding-right:12px;padding-bottom:6px">
            <span style="font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Document</span>
          </td><td style="padding-bottom:6px">
            <span style="font-size:13px;color:#0f172a">${p.docTypeName}</span>
          </td></tr>
          ${periodLabel ? `<tr><td style="padding-right:12px;padding-bottom:6px">
            <span style="font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Period</span>
          </td><td style="padding-bottom:6px">
            <span style="font-size:13px;color:#0f172a">${periodLabel}</span>
          </td></tr>` : ''}
          <tr><td style="padding-right:12px">
            <span style="font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">File</span>
          </td><td>
            <span style="font-size:13px;color:#0f172a">${p.fileName}</span>
          </td></tr>
        </table>
      </div>

      <a href="${p.taskUrl}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">
        View task →
      </a>
    </td></tr>
    <tr><td style="padding:16px 32px;border-top:1px solid #f1f5f9">
      <p style="color:#94a3b8;font-size:12px;margin:0">Taska · ${p.orgName}</p>
    </td></tr>
  </table>
  </td></tr></table>
</body></html>`
}

export function clientUploadNotifySubject(p: Props): string {
  return `📤 ${p.clientName} uploaded ${p.docTypeName} for ${p.taskTitle}`
}

function formatPeriodKey(key: string): string {
  if (key === 'evergreen') return 'Permanent document'
  // apr-2026 → April 2026
  const parts = key.split('-')
  if (parts.length === 2 && isNaN(Number(parts[0]))) {
    const months: Record<string, string> = {
      jan: 'January', feb: 'February', mar: 'March', apr: 'April',
      may: 'May',     jun: 'June',     jul: 'July',  aug: 'August',
      sep: 'September', oct: 'October', nov: 'November', dec: 'December',
    }
    return `${months[parts[0]] ?? parts[0]} ${parts[1]}`
  }
  // q1-2026 → Q1 2026
  if (parts.length === 2 && parts[0].startsWith('q')) {
    return `${parts[0].toUpperCase()} ${parts[1]}`
  }
  return key
}
