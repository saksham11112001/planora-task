// Shell renderer for engagement emails — one premium, consistent design that
// every catalogue item (lib/email/engagementContent.ts) renders through.
// Educational-first layout: category eyebrow, big idea, short body, optional
// tip box, ONE soft CTA, and a compliant footer with unsubscribe.
import type { EngagementItem } from '../engagementContent'

const CATEGORY_META: Record<EngagementItem['category'], { label: string; color: string; soft: string }> = {
  feature:    { label: 'upFloat tip',        color: '#0d9488', soft: '#f0fdfa' },
  msme:       { label: 'MSME insights',      color: '#ea580c', soft: '#fff7ed' },
  compliance: { label: 'Compliance craft',   color: '#0369a1', soft: '#f0f9ff' },
  practice:   { label: 'Practice growth',    color: '#7c3aed', soft: '#faf5ff' },
  trends:     { label: 'Profession trends',  color: '#be185d', soft: '#fdf2f8' },
  clients:    { label: 'Client relations',   color: '#b45309', soft: '#fffbeb' },
}

export function engagementEmailSubject(item: EngagementItem): string {
  return `${item.emoji} ${item.subject}`
}

export function engagementEmailHtml(item: EngagementItem, p: { recipientName: string; unsubscribeUrl: string }): string {
  const cat = CATEGORY_META[item.category]
  return `<!DOCTYPE html><html lang="en">
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:36px 16px"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">

    <!-- Brand bar -->
    <tr><td style="height:5px;background:linear-gradient(90deg,${cat.color},#14b8a6);font-size:0;line-height:0">&nbsp;</td></tr>

    <!-- Header -->
    <tr><td style="padding:26px 34px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:16px;font-weight:800;color:#0f172a;letter-spacing:-0.02em">up<span style="color:#0d9488">Float</span></td>
        <td align="right" style="font-size:10.5px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${cat.color}">${cat.label}</td>
      </tr></table>
    </td></tr>

    <!-- Hero -->
    <tr><td style="padding:26px 34px 6px">
      <div style="font-size:34px;line-height:1;margin-bottom:14px">${item.emoji}</div>
      <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:800;color:#0f172a;letter-spacing:-0.01em">${item.title}</h1>
    </td></tr>

    <!-- Body -->
    <tr><td style="padding:14px 34px 4px">
      <p style="margin:0 0 4px;font-size:13px;color:#64748b">Hi ${p.recipientName},</p>
      ${item.body.map(par => `<p style="margin:12px 0 0;font-size:14px;line-height:1.75;color:#334155">${par}</p>`).join('')}
    </td></tr>

    ${item.tip ? `
    <!-- Tip -->
    <tr><td style="padding:18px 34px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${cat.soft};border-left:3px solid ${cat.color};border-radius:0 8px 8px 0">
        <tr><td style="padding:12px 16px;font-size:12.5px;line-height:1.65;color:#334155">
          <strong style="color:${cat.color}">Tip:</strong> ${item.tip}
        </td></tr>
      </table>
    </td></tr>` : ''}

    <!-- CTA -->
    <tr><td style="padding:26px 34px 30px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="background:${cat.color};border-radius:8px">
          <a href="${item.cta.href}" style="display:inline-block;padding:12px 26px;font-size:13.5px;font-weight:700;color:#ffffff;text-decoration:none">${item.cta.label} →</a>
        </td>
      </tr></table>
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:18px 34px 22px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:11.5px;line-height:1.7;color:#94a3b8">
        You're receiving this because you use upFloat — practice management built for Indian CA firms.<br/>
        <a href="https://upfloat.co" style="color:#0d9488;text-decoration:none">upfloat.co</a>
        &nbsp;·&nbsp;
        <a href="${p.unsubscribeUrl}" style="color:#94a3b8;text-decoration:underline">Unsubscribe from these emails</a>
      </p>
    </td></tr>

  </table>
  </td></tr></table>
</body></html>`
}

export function engagementEmailText(item: EngagementItem, p: { recipientName: string; unsubscribeUrl: string }): string {
  return [
    `${item.title}`,
    ``,
    `Hi ${p.recipientName},`,
    ``,
    ...item.body,
    ...(item.tip ? [``, `Tip: ${item.tip}`] : []),
    ``,
    `${item.cta.label}: ${item.cta.href}`,
    ``,
    `—`,
    `You're receiving this because you use upFloat (upfloat.co).`,
    `Unsubscribe: ${p.unsubscribeUrl}`,
  ].join('\n')
}
