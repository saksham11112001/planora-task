import { createAdminClient } from '@/lib/supabase/admin'
import { createClient }      from '@/lib/supabase/server'
import { NextResponse }      from 'next/server'

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
      let { error } = await admin.storage.from('attachments').upload(path, bytes, { contentType: uploadContentType })
      // Retry with a generic binary type if storage rejects the specific MIME type
      if (error && error.message?.toLowerCase().includes('mime type')) {
        ;({ error } = await admin.storage.from('attachments').upload(path, bytes, { contentType: 'application/octet-stream', upsert: true }))
      }
      if (!error) {
        const { data: urlData } = admin.storage.from('attachments').getPublicUrl(path)
        attachmentUrls.push(urlData.publicUrl)
      }
    }

    // Insert into issue_reports table (table must exist; graceful fail if not)
    await admin.from('issue_reports').insert({
      org_id:      orgId,
      reporter_id: user?.id ?? null,
      message:     message.trim(),
      page_url:    url,
      attachments: attachmentUrls.length > 0 ? attachmentUrls : null,
      status:      'open',
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    // Even if DB insert fails, return success so UX is not blocked
    console.error('[report-issue]', err?.message)
    return NextResponse.json({ ok: true })
  }
}
