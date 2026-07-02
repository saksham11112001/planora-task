import { createClient }   from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/authUser'
import { NextResponse }    from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 503 })

  const { title, projectName, clientName } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  const context = [
    projectName && `Project: ${projectName}`,
    clientName  && `Client: ${clientName}`,
  ].filter(Boolean).join('\n')

  const prompt = `You are a task management assistant for Indian CA/CPA accounting firms.
Given a task title, suggest:
1. A concise description (2–3 sentences, plain prose, under 70 words)
2. The best priority: low | medium | high | urgent
3. A suggested recurring frequency (if the task sounds periodic) — one of: daily | weekly | bi_weekly | monthly | quarterly | annual — or null if one-time
4. Up to 4 suggested subtask titles (short, actionable — empty array if none make sense)

Respond with ONLY valid JSON in this exact shape:
{"description":"...","priority":"medium","frequency":null,"subtasks":["...","..."]}

Task title: "${title}"
${context}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 350,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await res.json()
  const raw  = data.content?.[0]?.text?.trim() ?? ''
  try {
    const parsed = JSON.parse(raw)
    return NextResponse.json({
      description: parsed.description ?? '',
      priority:    ['low','medium','high','urgent'].includes(parsed.priority) ? parsed.priority : 'medium',
      frequency:   parsed.frequency ?? null,
      subtasks:    Array.isArray(parsed.subtasks) ? parsed.subtasks.slice(0, 4) : [],
    })
  } catch {
    return NextResponse.json({ description: raw, priority: 'medium', frequency: null, subtasks: [] })
  }
}
