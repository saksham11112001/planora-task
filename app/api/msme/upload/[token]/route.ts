// Public endpoint — vendor uploads their Udyam certificate using their magic-link token.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { uploadToR2, R2_CONFIGURED, R2_BUCKET } from '@/lib/storage/r2'
import crypto                        from 'crypto'

const MAX_BYTES = 5 * 1024 * 1024  // 5 MB

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await params
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const admin     = createAdminClient()

  const { data: tokenRow } = await admin
    .from('msme_tokens')
    .select('id, vendor_id, org_id, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!tokenRow) return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
  if (new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Link expired' }, { status: 410 })
  }
  if (tokenRow.used_at) {
    return NextResponse.json({ error: 'This link has already been used' }, { status: 410 })
  }

  const formData = await req.formData()
  const file     = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Only PDF, JPG, or PNG files are accepted' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File must be under 5 MB' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // Validate file magic bytes server-side — never trust client-reported Content-Type
  const magic = buffer.subarray(0, 8)
  const isPdf  = magic[0] === 0x25 && magic[1] === 0x50 && magic[2] === 0x44 && magic[3] === 0x46  // %PDF
  const isJpeg = magic[0] === 0xFF && magic[1] === 0xD8 && magic[2] === 0xFF
  const isPng  = magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4E && magic[3] === 0x47  // \x89PNG
  if (!isPdf && !isJpeg && !isPng) {
    return NextResponse.json({ error: 'File content does not match an accepted format (PDF, JPG, or PNG)' }, { status: 400 })
  }
  const ext = isPdf ? 'pdf' : isJpeg ? 'jpg' : 'png'
  const key = `msme/${tokenRow.org_id}/${tokenRow.vendor_id}/${Date.now()}.${ext}`

  let certUrl: string

  if (R2_CONFIGURED) {
    await uploadToR2(key, buffer, file.type)
    certUrl = `r2:${key}`
  } else {
    // Fallback: Supabase Storage — create bucket if it doesn't exist yet
    await admin.storage.createBucket('attachments', { public: true }).catch(() => {
      // Ignore "already exists" error — any other error will surface on upload
    })
    const { data: uploadData, error: uploadError } = await admin.storage
      .from('attachments')
      .upload(key, buffer, { contentType: file.type, upsert: true })
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })
    const { data: urlData } = admin.storage.from('attachments').getPublicUrl(uploadData.path)
    certUrl = urlData.publicUrl
  }

  // Persist cert_url on the vendor record immediately (form submit will also send it as a backup)
  const { error: urlErr } = await admin.from('msme_vendors').update({ cert_url: certUrl }).eq('id', tokenRow.vendor_id).eq('org_id', tokenRow.org_id)
  if (urlErr) console.error('[msme/upload] cert_url pre-save failed (non-fatal):', urlErr.message)

  return NextResponse.json({ ok: true, cert_url: certUrl })
}
