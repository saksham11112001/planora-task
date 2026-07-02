// Returns a presigned R2 PUT URL so the browser can upload directly to R2,
// skipping Vercel entirely (no bandwidth used for the upload itself).
import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { getApiOrgMembership }      from '@/lib/supabase/apiActiveOrg'
import { R2_CONFIGURED, R2_BUCKET, r2PresignedPutUrl } from '@/lib/storage/r2'

const ALLOWED_TYPES = new Set([
  'application/pdf','image/jpeg','image/png','image/gif','image/webp',
  'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain','text/csv','application/zip','application/x-zip-compressed',
  'application/octet-stream',
])

const BLOCKED_EXTENSIONS = new Set([
  'exe','bat','cmd','com','msi','dll','scr','pif',
  'sh','bash','zsh','ps1','py','rb','php','pl','js','ts','vbs',
  'jar','class','app','dmg','pkg','elf',
])

export async function POST(req: NextRequest) {
  if (!R2_CONFIGURED) {
    return NextResponse.json({ error: 'R2 not configured' }, { status: 503 })
  }

  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id')
  if (!mb) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { task_id, filename, content_type, size } = await req.json()
  if (!task_id || !filename || !content_type) {
    return NextResponse.json({ error: 'task_id, filename, content_type required' }, { status: 400 })
  }
  if (size > 100 * 1024 * 1024) {
    return NextResponse.json({ error: 'Max file size is 100 MB' }, { status: 400 })
  }

  const ext = (filename.split('.').pop() ?? 'bin').toLowerCase()
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: `File type ".${ext}" is not allowed` }, { status: 400 })
  }

  const safeType = ALLOWED_TYPES.has(content_type) ? content_type : 'application/octet-stream'
  const key = `${mb.org_id}/${task_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const upload_url = await r2PresignedPutUrl(key, safeType, 300)
  return NextResponse.json({ upload_url, key, bucket: R2_BUCKET }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
