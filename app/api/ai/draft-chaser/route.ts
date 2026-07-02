import { createClient }      from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { createAdminClient }  from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'
import { getApiOrgMembership } from '@/lib/supabase/apiActiveOrg'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const mb = await getApiOrgMembership(supabase, user.id, req, 'org_id, role, organisations(name)')
  if (!mb) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 503 })

  const { taskId } = await req.json()
  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: task } = await admin.from('tasks')
    .select('id, title, due_date, client_id, clients(id, name)')
    .eq('id', taskId).eq('org_id', mb.org_id).maybeSingle()

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const clientName = (task as any).clients?.name ?? 'the client'
  const orgName    = (mb.organisations as any)?.name ?? 'our firm'
  const dueStr     = task.due_date ?? 'soon'

  const prompt = `You are an assistant for an Indian CA/CPA accounting firm called "${orgName}".
Draft a polite but firm follow-up message to the client "${clientName}" asking them to provide documents needed for the task: "${task.title}" (due ${dueStr}).

Write TWO versions — one for email (2-3 short paragraphs, professional) and one for WhatsApp (3-4 sentences, friendly but direct).

Respond ONLY with valid JSON:
{"email":"...","whatsapp":"..."}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await res.json()
  const raw  = data.content?.[0]?.text?.trim() ?? ''
  try {
    const parsed = JSON.parse(raw)
    return NextResponse.json({ email: parsed.email ?? '', whatsapp: parsed.whatsapp ?? '' })
  } catch {
    return NextResponse.json({ email: raw, whatsapp: '' })
  }
}
