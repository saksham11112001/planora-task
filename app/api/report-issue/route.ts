import { createAdminClient }       from '@/lib/supabase/admin'
import { createClient }            from '@/lib/supabase/server'
import { NextResponse }            from 'next/server'
import { uploadToR2, r2SignedUrl, R2_CONFIGURED } from '@/lib/storage/r2'
import { resend, FROM }            from '@/lib/email/resend'

const MAX_REPORT_SIZE = 10 * 1024 * 1024 // 10 MB total for issue reports

export async function POST(req: Request) {
  try {
    // Reject oversized payloads before reading body into memory
    const contentLength = parseInt((req.headers as Headers).get('content-length') ?? '0', 10)
    if (contentLength > MAX_REPORT_SIZE) {
      return NextResponse.json({ error: 'Attachments exceed 10 MB limit' }, { status: 400 })
    }

    const sb  = await createClient()
    const { data: { user } } = await sb.auth.getUser()

    const form    = await req.formData()
    const message = (form.get('message') as string | null) ?? ''
    const url     = (form.get('url')     as string | null) ?? ''
    const files   = form.getAll('files') as File[]

    if (!message.trim() && files.length === 0) {
      return NextResponse.json({ error: 'Nothing to report' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Attempt to get org_id from user's profile
    let orgId: string | null = null
    if (user) {
      const { data: profile } = await admin.from('users').select('org_id').eq('id', user.id).maybeSingle()
      orgId = profile?.org_id ?? null
    }

    // Upload any attached files to storage
    const attachmentUrls: string[] = []
    function normaliseContentType(mime: string): string {
      if (!mime) return 'application/octet-stream'
      const zipTypes = ['application/x-zip-compressed', 'application/x-zip', 'application/zip', 'multipart/x-zip']
      if (zipTypes.includes(mime)) return 'application/zip'
      return mime
    }
    for (const file of files) {
      if (!(file instanceof File) || file.size === 0) continue
      const path  = `issue-reports/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const bytes = Buffer.from(await file.arrayBuffer())
      const uploadContentType = normaliseContentType(file.type || 'application/octet-stream')
      try {
        if (R2_CONFIGURED) {
          await uploadToR2(path, bytes, uploadContentType)
          // 7-day link — only accessed internally by the team reviewing the report
          const signedUrl = await r2SignedUrl(path, 604800)
          attachmentUrls.push(signedUrl)
        } else {
          // Supabase Storage fallback
          const { data: urlData } = admin.storage.from('issue-reports').getPublicUrl(path)
          await admin.storage.from('issue-reports').upload(path, bytes, { contentType: uploadContentType, upsert: false })
          attachmentUrls.push(urlData.publicUrl)
        }
      } catch { /* Non-fatal — report still saved without attachment */ }
    }

    // Insert into issue_reports table (table must exist; graceful fail if not)
    const { data: inserted } = await admin.from('issue_reports').insert({
      org_id:      orgId,
      reporter_id: user?.id ?? null,
      message:     message.trim(),
      page_url:    url,
      attachments: attachmentUrls.length > 0 ? attachmentUrls : null,
      status:      'open',
    }).select('id').maybeSingle()

    // Notify admin immediately — fire and forget, never blocks user response
    const reportId  = inserted?.id ?? 'unknown'
    const userEmail = user?.email ?? 'Anonymous'
    const pageLabel = url ? url.replace(/^https?:\/\/[^/]+/, '') || '/' : 'unknown page'
    resend.emails.send({
      from:    FROM,
      to:      ['saksham.gpt2001@gmail.com'],
      subject: `🚨 New complaint — ${pageLabel}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#dc2626;margin-bottom:4px">New Issue Report</h2>
          <p style="color:#64748b;margin-top:0;font-size:13px">Filed at ${new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
            <tr><td style="padding:8px 0;color:#64748b;width:120px">Reporter</td><td style="padding:8px 0;font-weight:600">${userEmail}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b">Page</td><td style="padding:8px 0;font-family:monospace;color:#0d9488">${pageLabel}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b">Full URL</td><td style="padding:8px 0;font-size:12px;color:#94a3b8">${url || 'not captured'}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b">Report ID</td><td style="padding:8px 0;font-size:12px;color:#94a3b8">${reportId}</td></tr>
          </table>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0">
            <p style="margin:0;font-size:14px;color:#1e293b;white-space:pre-wrap">${message.trim() || '(no message — attachments only)'}</p>
          </div>
          ${attachmentUrls.length > 0 ? `<p style="font-size:13px;color:#64748b">${attachmentUrls.length} attachment(s): ${attachmentUrls.map((u,i)=>`<a href="${u}">File ${i+1}</a>`).join(' · ')}</p>` : ''}
          <a href="https://sng-adwisers.com/complaints" style="display:inline-block;margin-top:8px;padding:12px 24px;background:#0d9488;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">View in Complaints Dashboard →</a>
        </div>
      `,
    }).catch(e => console.warn('[report-issue] admin email failed:', e))

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    // Even if DB insert fails, return success so UX is not blocked
    console.error('[report-issue]', err?.message)
    return NextResponse.json({ ok: true })
  }
}
