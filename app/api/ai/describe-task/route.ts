import { createClient }    from '@/lib/supabase/server'
import { NextResponse }    from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { title, projectName, clientName } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 503 })

  const context = [
    projectName && `Project: ${projectName}`,
    clientName  && `Client: ${clientName}`,
  ].filter(Boolean).join('\n')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [{
        role:    'user',
        content: `Write a concise task description for a project management tool.

Task title: "${title}"
${context}

Write 2-4 sentences that explain what needs to be done and include 1-2 clear acceptance criteria. Professional, actionable, plain prose only — no bullet points or headers. Keep it under 80 words.`,
      }],
    }),
  })

  const data = await res.json()
  const description = data.content?.[0]?.text?.trim() ?? ''
  return NextResponse.json({ description })
}
