interface CommentProps {
  taskTitle: string; commenterName: string; commentText: string
  orgName: string; taskUrl: string; assigneeName: string
}

export function taskCommentedHtml(p: CommentProps): string {
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
            <td style="padding-left:10px;color:#ffffff;font-size:18px;font-weight:700">Planora</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 8px;color:#0f172a;font-size:20px;font-weight:700">New comment on your task</h1>
          <p style="color:#64748b;font-size:14px;margin:0 0 24px">${p.commenterName} commented in <strong>${p.orgName}</strong></p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin-bottom:16px">
            <p style="color:#475569;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px">TASK</p>
            <p style="color:#0f172a;font-size:15px;font-weight:600;margin:0">${p.taskTitle}</p>
          </div>
          <div style="background:#f0f9ff;border-left:3px solid #0ea5e9;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px">
            <p style="color:#475569;font-size:12px;font-weight:600;margin:0 0 6px">${p.commenterName} said:</p>
            <p style="color:#0f172a;font-size:14px;margin:0;line-height:1.6">${p.commentText}</p>
          </div>
          <a href="${p.taskUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">View & reply →</a>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #f1f5f9">
          <p style="color:#94a3b8;font-size:12px;margin:0">Planora · Manage notification preferences in Settings</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
