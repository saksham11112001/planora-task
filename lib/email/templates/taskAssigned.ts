interface Props {
  taskTitle:   string
  assigneeName: string
  assignerName: string
  orgName:     string
  dueDate?:    string | null
  projectName?: string | null
  taskUrl:     string
}

export function taskAssignedHtml(p: Props): string {
  const due = p.dueDate
    ? `<p style="color:#64748b;font-size:14px;margin:0 0 8px">📅 Due: <strong>${p.dueDate}</strong></p>`
    : ''
  const project = p.projectName
    ? `<p style="color:#64748b;font-size:14px;margin:0 0 8px">📁 Project: <strong>${p.projectName}</strong></p>`
    : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
        <!-- Header -->
        <tr><td style="background:#0f172a;padding:24px 32px">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:#0d9488;border-radius:8px;width:32px;height:32px;text-align:center;vertical-align:middle">
              <span style="color:#fff;font-size:16px;font-weight:700">P</span>
            </td>
            <td style="padding-left:10px;color:#ffffff;font-size:18px;font-weight:700">Planora</td>
          </tr></table>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 8px;color:#0f172a;font-size:20px;font-weight:700">New task assigned to you</h1>
          <p style="color:#64748b;font-size:14px;margin:0 0 24px">${p.assignerName} assigned you a task in <strong>${p.orgName}</strong></p>
          <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:20px;margin-bottom:24px">
            <p style="color:#0f172a;font-size:16px;font-weight:600;margin:0 0 12px">${p.taskTitle}</p>
            ${project}
            ${due}
          </div>
          <a href="${p.taskUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">View task →</a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #f1f5f9">
          <p style="color:#94a3b8;font-size:12px;margin:0">You're receiving this because you're a member of ${p.orgName} on Planora.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function taskAssignedText(p: Props): string {
  return `Hi ${p.assigneeName},

${p.assignerName} assigned you a task in ${p.orgName}:

"${p.taskTitle}"
${p.projectName ? `Project: ${p.projectName}` : ''}
${p.dueDate ? `Due: ${p.dueDate}` : ''}

View task: ${p.taskUrl}

— Planora`
}
