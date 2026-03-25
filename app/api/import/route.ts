import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse }       from 'next/server'
import type { NextRequest }   from 'next/server'

// ── tiny xlsx parser (no npm dep — reads OOXML directly) ──────────
// We use a lightweight approach: parse the zip, extract sheet XMLs,
// then pull cell values. Works for the simple flat sheets in our template.

async function parseXlsx(buffer: ArrayBuffer): Promise<Record<string, string[][]>> {
  // Dynamically import JSZip-compatible logic via the Web Streams API
  // Since we're in Next.js Edge/Node, use the 'xlsx' package approach via
  // dynamic import of the built-in xlsx library that Next bundles
  // We'll use a manual unzip approach with the fflate library available in Node
  const { unzipSync, strFromU8 } = await import('fflate')

  const u8 = new Uint8Array(buffer)
  const unzipped = unzipSync(u8)

  // Read workbook to get sheet names and rId → sheet mapping
  const wbXml = strFromU8(unzipped['xl/workbook.xml'])
  const sheetMatches = [...wbXml.matchAll(/<sheet[^>]+name="([^"]+)"[^>]+r:id="([^"]+)"/g)]

  // Read shared strings
  const sharedStrings: string[] = []
  if (unzipped['xl/sharedStrings.xml']) {
    const ssXml = strFromU8(unzipped['xl/sharedStrings.xml'])
    const siMatches = [...ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)]
    for (const m of siMatches) {
      // Extract all <t> text nodes within the <si> block
      const texts = [...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map(t =>
        t[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
      )
      sharedStrings.push(texts.join(''))
    }
  }

  // Read relationships to map rId → sheet file
  const relsXml = strFromU8(unzipped['xl/_rels/workbook.xml.rels'])
  const relMap: Record<string, string> = {}
  for (const m of relsXml.matchAll(/<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g)) {
    relMap[m[1]] = m[2]
  }

  const result: Record<string, string[][]> = {}

  for (const [, sheetName, rId] of sheetMatches) {
    const target = relMap[rId]
    if (!target) continue
    const path = target.startsWith('worksheets/') ? `xl/${target}` : `xl/worksheets/${target}`
    const sheetXml = strFromU8(unzipped[path] ?? unzipped[path.replace('xl/xl/', 'xl/')] ?? new Uint8Array())
    if (!sheetXml) continue

    // Parse rows/cells
    const rows: string[][] = []
    let maxCol = 0

    const rowMatches = [...sheetXml.matchAll(/<row[^>]+r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)]
    for (const rowM of rowMatches) {
      const rowIdx = parseInt(rowM[1]) - 1
      const cellMatches = [...rowM[2].matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g)]
      while (rows.length <= rowIdx) rows.push([])

      for (const cm of cellMatches) {
        const colStr = cm[1]
        const cellAttrs = cm[3]
        const cellInner = cm[4]
        const colIdx = colStr.split('').reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0) - 1
        maxCol = Math.max(maxCol, colIdx)

        // Get value
        const vMatch = cellInner.match(/<v>([^<]*)<\/v>/)
        let val = ''
        if (vMatch) {
          const raw = vMatch[1]
          if (cellAttrs.includes('t="s"')) {
            val = sharedStrings[parseInt(raw)] ?? ''
          } else if (cellAttrs.includes('t="str"') || cellAttrs.includes('t="inlineStr"')) {
            val = raw
          } else {
            // Number or date — just take as string
            val = raw
          }
        }
        // Inline string
        const isMatch = cellInner.match(/<is><t>([^<]*)<\/t><\/is>/)
        if (isMatch) val = isMatch[1]

        while (rows[rowIdx].length <= colIdx) rows[rowIdx].push('')
        rows[rowIdx][colIdx] = val.trim()
      }
    }
    result[sheetName] = rows
  }

  return result
}

// ── column normaliser ─────────────────────────────────────────────
function normalise(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function findCol(headers: string[], ...keys: string[]): number {
  for (const key of keys) {
    const idx = headers.findIndex(h => normalise(h).includes(normalise(key)))
    if (idx !== -1) return idx
  }
  return -1
}

function cell(row: string[], idx: number) {
  return idx >= 0 ? (row[idx] ?? '').trim() : ''
}

// ── main handler ──────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: mb } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!mb || !['owner', 'admin', 'manager'].includes(mb.role))
    return NextResponse.json({ error: 'Only managers and above can import' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'xlsx')
    return NextResponse.json({ error: 'Please upload an .xlsx file' }, { status: 400 })

  if (file.size > 5 * 1024 * 1024)
    return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 400 })

  let sheets: Record<string, string[][]>
  try {
    const buffer = await file.arrayBuffer()
    sheets = await parseXlsx(buffer)
  } catch (e: any) {
    return NextResponse.json({ error: 'Could not parse file: ' + (e?.message ?? 'unknown error') }, { status: 400 })
  }

  const admin = createAdminClient()
  const orgId = mb.org_id

  const results = {
    members:  { created: 0, skipped: 0, errors: [] as string[] },
    projects: { created: 0, skipped: 0, errors: [] as string[] },
    tasks:    { created: 0, skipped: 0, errors: [] as string[] },
  }

  // Helper: resolve email → user id from users table
  const emailToUserId: Record<string, string> = {}
  async function resolveEmail(email: string): Promise<string | null> {
    if (!email) return null
    if (emailToUserId[email]) return emailToUserId[email]
    const { data } = await admin.from('users').select('id').eq('email', email.toLowerCase()).maybeSingle()
    if (data?.id) emailToUserId[email] = data.id
    return data?.id ?? null
  }

  // ── 1. MEMBERS ─────────────────────────────────────────────────
  const memberSheetKey = Object.keys(sheets).find(k => normalise(k).includes('member') || normalise(k).includes('team'))
  if (memberSheetKey) {
    const rows = sheets[memberSheetKey]
    // Find header row (row where 'email' appears)
    const hdrRowIdx = rows.findIndex(r => r.some(c => normalise(c).includes('email')))
    if (hdrRowIdx !== -1) {
      const headers = rows[hdrRowIdx].map(h => h.toLowerCase())
      const iName  = findCol(headers, 'name', 'fullname')
      const iEmail = findCol(headers, 'email')
      const iRole  = findCol(headers, 'role')

      const dataRows = rows.slice(hdrRowIdx + 2) // skip header + tip row

      for (const row of dataRows) {
        const email = cell(row, iEmail).toLowerCase()
        const name  = cell(row, iName)
        const role  = cell(row, iRole).toLowerCase() || 'member'

        if (!email || !email.includes('@')) continue
        if (!['admin','manager','member','viewer'].includes(role)) {
          results.members.errors.push(`${email}: invalid role "${role}"`)
          results.members.skipped++
          continue
        }

        // Check already in org
        const existing = await admin.from('org_members')
          .select('id, is_active')
          .eq('org_id', orgId)
          .eq('user_id', (await resolveEmail(email)) ?? '00000000-0000-0000-0000-000000000000')
          .maybeSingle()

        if (existing?.data?.is_active) {
          results.members.skipped++
          continue
        }

        const uid = await resolveEmail(email)
        if (uid) {
          if (existing?.data) {
            await admin.from('org_members').update({ is_active: true, role }).eq('id', existing.data.id)
          } else {
            await admin.from('org_members').insert({ org_id: orgId, user_id: uid, role, is_active: true })
          }
          // Update name if provided
          if (name) await admin.from('users').update({ name }).eq('id', uid)
          results.members.created++
        } else {
          // Invite new user
          const { error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
            data: { invited_to_org: orgId, invited_role: role, full_name: name },
            redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
          })
          if (invErr) {
            results.members.errors.push(`${email}: ${invErr.message}`)
            results.members.skipped++
          } else {
            results.members.created++
          }
        }
      }
    }
  }

  // ── 2. PROJECTS ────────────────────────────────────────────────
  const projNameToId: Record<string, string> = {}
  const projSheetKey = Object.keys(sheets).find(k => normalise(k).includes('project'))
  if (projSheetKey) {
    const rows = sheets[projSheetKey]
    const hdrRowIdx = rows.findIndex(r => r.some(c => normalise(c).includes('projectname') || normalise(c).includes('name')))
    if (hdrRowIdx !== -1) {
      const headers = rows[hdrRowIdx].map(h => h.toLowerCase())
      const iName   = findCol(headers, 'projectname', 'name')
      const iColor  = findCol(headers, 'color', 'colour')
      const iStatus = findCol(headers, 'status')
      const iDue    = findCol(headers, 'duedate', 'due')
      const iOwner  = findCol(headers, 'owneremail', 'owner')
      const iBudget = findCol(headers, 'budget')
      const iHours  = findCol(headers, 'hourbudget', 'hours')
      const iDesc   = findCol(headers, 'description', 'desc')

      const dataRows = rows.slice(hdrRowIdx + 2)

      for (const row of dataRows) {
        const name = cell(row, iName)
        if (!name) continue

        const color   = cell(row, iColor) || '#0d9488'
        const status  = cell(row, iStatus) || 'active'
        const dueDate = cell(row, iDue) || null
        const ownerEmail = cell(row, iOwner)
        const budget  = cell(row, iBudget)
        const hours   = cell(row, iHours)
        const desc    = cell(row, iDesc)

        if (!['active','on_hold','completed'].includes(status)) {
          results.projects.errors.push(`"${name}": invalid status "${status}"`)
          results.projects.skipped++
          continue
        }

        const ownerId = ownerEmail ? await resolveEmail(ownerEmail) : user.id

        const { data: proj, error: projErr } = await admin.from('projects').insert({
          org_id:       orgId,
          name:         name.trim(),
          color:        color.startsWith('#') ? color : `#${color}`,
          status,
          due_date:     dueDate || null,
          owner_id:     ownerId ?? user.id,
          budget:       budget ? parseFloat(budget) : null,
          hours_budget: hours  ? parseFloat(hours)  : null,
          description:  desc   || null,
        }).select('id').single()

        if (projErr) {
          results.projects.errors.push(`"${name}": ${projErr.message}`)
          results.projects.skipped++
        } else {
          projNameToId[name.toLowerCase()] = proj.id
          results.projects.created++
        }
      }
    }
  }

  // ── 3. TASKS ───────────────────────────────────────────────────
  const taskSheetKey = Object.keys(sheets).find(k => normalise(k).includes('task'))
  if (taskSheetKey) {
    const rows = sheets[taskSheetKey]
    const hdrRowIdx = rows.findIndex(r => r.some(c => normalise(c).includes('tasktitle') || normalise(c).includes('title')))
    if (hdrRowIdx !== -1) {
      const headers = rows[hdrRowIdx].map(h => h.toLowerCase())
      const iTitle   = findCol(headers, 'tasktitle', 'title')
      const iProject = findCol(headers, 'projectname', 'project')
      const iAssignee= findCol(headers, 'assigneeemail', 'assignee')
      const iPriority= findCol(headers, 'priority')
      const iDue     = findCol(headers, 'duedate', 'due')
      const iStatus  = findCol(headers, 'status')
      const iHours   = findCol(headers, 'esthours', 'hours')
      const iDesc    = findCol(headers, 'description', 'desc')

      const dataRows = rows.slice(hdrRowIdx + 2)

      for (const row of dataRows) {
        const title = cell(row, iTitle)
        if (!title) continue

        const projectName = cell(row, iProject).toLowerCase()
        const assigneeEmail = cell(row, iAssignee)
        const priority = cell(row, iPriority) || 'medium'
        const dueDate  = cell(row, iDue) || null
        const status   = cell(row, iStatus) || 'todo'
        const estHours = cell(row, iHours)
        const desc     = cell(row, iDesc)

        if (!['none','low','medium','high','urgent'].includes(priority)) {
          results.tasks.errors.push(`"${title}": invalid priority "${priority}"`)
          results.tasks.skipped++
          continue
        }

        // Resolve project — first check newly created, then look up existing in org
        let projectId: string | null = projNameToId[projectName] ?? null
        if (!projectId && projectName) {
          const { data: existingProj } = await admin.from('projects')
            .select('id')
            .eq('org_id', orgId)
            .ilike('name', projectName)
            .maybeSingle()
          if (existingProj?.id) projectId = existingProj.id
        }

        const assigneeId = assigneeEmail ? await resolveEmail(assigneeEmail) : null

        const { error: taskErr } = await admin.from('tasks').insert({
          org_id:          orgId,
          title:           title.trim(),
          description:     desc || null,
          status:          ['todo','in_progress','completed','blocked'].includes(status) ? status : 'todo',
          priority,
          project_id:      projectId,
          assignee_id:     assigneeId,
          due_date:        dueDate || null,
          estimated_hours: estHours ? parseFloat(estHours) : null,
          created_by:      user.id,
          is_recurring:    false,
          approval_required: false,
        })

        if (taskErr) {
          results.tasks.errors.push(`"${title}": ${taskErr.message}`)
          results.tasks.skipped++
        } else {
          results.tasks.created++
        }
      }
    }
  }

  const totalCreated = results.members.created + results.projects.created + results.tasks.created
  return NextResponse.json({ success: true, results, totalCreated })
}
