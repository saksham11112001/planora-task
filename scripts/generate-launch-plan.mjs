// Run: node scripts/generate-launch-plan.mjs
// Output: launch-plan-2026.xlsx
import ExcelJS from 'exceljs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '..', 'launch-plan-2026.xlsx')

const wb = new ExcelJS.Workbook()
wb.creator = 'Planora'
wb.created = new Date()

// ─── Helpers ──────────────────────────────────────────────────────────────────
function hdr(ws, row, cols) {
  const r = ws.addRow(cols)
  r.eachCell(c => {
    c.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF0D9488' } }
    c.font = { bold:true, color:{ argb:'FFFFFFFF' }, size:11 }
    c.alignment = { vertical:'middle', horizontal:'center', wrapText:true }
    c.border = { bottom:{ style:'thin', color:{ argb:'FFCCCCCC' } } }
  })
  ws.getRow(row).height = 22
}
function cell(ws, row, col, value, opts={}) {
  const c = ws.getCell(row, col)
  c.value = value
  c.alignment = { vertical:'middle', wrapText:true, ...opts.align }
  if (opts.bold) c.font = { bold:true }
  if (opts.fill) c.fill = { type:'pattern', pattern:'solid', fgColor:{ argb: opts.fill } }
  if (opts.color) c.font = { ...(c.font||{}), color:{ argb: opts.color } }
  if (opts.center) c.alignment = { ...c.alignment, horizontal:'center' }
  return c
}
function addRow(ws, vals, bg) {
  const r = ws.addRow(vals)
  if (bg) r.eachCell(c => { c.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:bg } } })
  r.eachCell(c => { if (!c.alignment) c.alignment = { vertical:'middle', wrapText:true } })
  return r
}

// ─── Sheet 1: 30-Day Timeline ──────────────────────────────────────────────────
const ws1 = wb.addWorksheet('🗓 30-Day Timeline')
ws1.columns = [
  { key:'week',  width:14 },
  { key:'dates', width:20 },
  { key:'area',  width:22 },
  { key:'task',  width:50 },
  { key:'owner', width:18 },
  { key:'status',width:14 },
]
ws1.getRow(1).height = 14
ws1.addRow(['PLANORA — LAUNCH PLAN  |  April 15 → May 15, 2026']).font = { bold:true, size:14, color:{ argb:'FF0D9488' } }
ws1.mergeCells('A1:F1')
ws1.getCell('A1').alignment = { horizontal:'center' }
ws1.addRow([])
hdr(ws1, 3, ['Week','Dates','Area','Task / Deliverable','Owner','Status'])

const timeline = [
  // Week 1
  ['Week 1','Apr 15–18','Performance','Cap API query limits (tasks, clients, projects)','Dev','✅ Done'],
  ['Week 1','Apr 15–18','Performance','Fix N+1 DB query in task blocks check','Dev','✅ Done'],
  ['Week 1','Apr 15–18','Performance','Reduce initial page load from 2000→500 rows','Dev','✅ Done'],
  ['Week 1','Apr 15–18','Pagination','Add pagination to Clients, Inbox, Recurring views','Dev','✅ Done'],
  ['Week 1','Apr 15–18','QA','End-to-end smoke test on all major flows','Dev','🔄 Pending'],
  ['Week 1','Apr 19–21','Infra','Set up Supabase connection pooler (PgBouncer)','DevOps','🔄 Pending'],
  ['Week 1','Apr 19–21','Infra','Enable Supabase rate limiting / WAF rules','DevOps','🔄 Pending'],
  ['Week 1','Apr 19–21','Infra','Configure Next.js caching headers for static assets','Dev','🔄 Pending'],
  // Week 2
  ['Week 2','Apr 22–25','Payments','Razorpay — integrate subscription plan checkout','Dev','⬜ Todo'],
  ['Week 2','Apr 22–25','Payments','Razorpay — webhook handler for plan upgrades','Dev','⬜ Todo'],
  ['Week 2','Apr 22–25','Payments','Razorpay — billing portal (invoices, cancel)','Dev','⬜ Todo'],
  ['Week 2','Apr 26–28','WhatsApp','WhatsApp Business API — credentials & sandbox setup','Dev','⬜ Todo'],
  ['Week 2','Apr 26–28','WhatsApp','Task assignment notifications via WhatsApp','Dev','⬜ Todo'],
  ['Week 2','Apr 26–28','WhatsApp','Due-date reminders via WhatsApp (daily 9 AM)','Dev','⬜ Todo'],
  // Week 3
  ['Week 3','Apr 29–May 1','Client Portal','Magic link setup flow for new clients','Dev','⬜ Todo'],
  ['Week 3','Apr 29–May 1','Client Portal','Partner/client view — task visibility + upload only','Dev','⬜ Todo'],
  ['Week 3','Apr 29–May 1','Client Portal','Client portal: document checklist view','Dev','⬜ Todo'],
  ['Week 3','May 2–4','UI Polish','Dark mode audit — fix any remaining hardcoded colors','Dev','⬜ Todo'],
  ['Week 3','May 2–4','UI Polish','Mobile responsive pass on all major pages','Dev','⬜ Todo'],
  ['Week 3','May 2–4','QA','Load testing (k6 or locust) — simulate 100 concurrent users','QA','⬜ Todo'],
  // Week 4
  ['Week 4','May 5–7','Content','Demo video recording — core task workflow','Marketing','⬜ Todo'],
  ['Week 4','May 5–7','Content','Demo video recording — CA compliance module','Marketing','⬜ Todo'],
  ['Week 4','May 5–7','Content','Promotional video — 90-second product overview','Marketing','⬜ Todo'],
  ['Week 4','May 8–9','Marketing','Landing page update with new screenshots + pricing','Marketing','⬜ Todo'],
  ['Week 4','May 8–9','Marketing','Email announcement draft (existing users + waitlist)','Marketing','⬜ Todo'],
  ['Week 4','May 10–11','Marketing','Social media posts — LinkedIn, Twitter, Instagram scheduled','Marketing','⬜ Todo'],
  // Launch week
  ['Week 5','May 12–13','Final QA','Full regression test — all modules','Dev + QA','⬜ Todo'],
  ['Week 5','May 12–13','Final QA','Performance benchmark — page load < 2s (LCP)','Dev','⬜ Todo'],
  ['Week 5','May 14','Launch Prep','Backup DB snapshot, deploy to production','DevOps','⬜ Todo'],
  ['Week 5','May 14','Launch Prep','Warm-up caches, verify Inngest cron jobs running','Dev','⬜ Todo'],
  ['Week 5','May 15','🚀 LAUNCH','Send launch announcement emails','Marketing','🚀 Launch Day'],
  ['Week 5','May 15','🚀 LAUNCH','Post on all social media channels','Marketing','🚀 Launch Day'],
  ['Week 5','May 15','🚀 LAUNCH','Monitor error rates, DB performance, Inngest queue','Dev','🚀 Launch Day'],
]

const weekColors = {
  'Week 1': 'FFE8F5F3',
  'Week 2': 'FFFEF9C3',
  'Week 3': 'FFEFF6FF',
  'Week 4': 'FFFFF7ED',
  'Week 5': 'FFFCE8F3',
}
const statusColors = {
  '✅ Done':     'FF16A34A',
  '🔄 Pending':  'FFD97706',
  '⬜ Todo':     'FF94A3B8',
  '🚀 Launch Day':'FF7C3AED',
}

timeline.forEach(([week, dates, area, task, owner, status]) => {
  const r = ws1.addRow([week, dates, area, task, owner, status])
  const bg = weekColors[week] || 'FFFFFFFF'
  r.eachCell((c, col) => {
    c.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:bg } }
    c.alignment = { vertical:'middle', wrapText:true }
    if (col === 6) {
      c.font = { bold:true, color:{ argb: statusColors[status] || 'FF333333' } }
      c.alignment = { ...c.alignment, horizontal:'center' }
    }
  })
})
ws1.getColumn('D').alignment = { wrapText:true }

// ─── Sheet 2: Performance Audit & Fixes ───────────────────────────────────────
const ws2 = wb.addWorksheet('⚡ Performance Fixes')
ws2.columns = [
  { key:'sev',    width:12 },
  { key:'area',   width:18 },
  { key:'file',   width:38 },
  { key:'issue',  width:55 },
  { key:'fix',    width:50 },
  { key:'status', width:14 },
]
ws2.addRow(['PERFORMANCE AUDIT — Planora']).font = { bold:true, size:14, color:{ argb:'FFDC2626' } }
ws2.mergeCells('A1:F1')
ws2.getCell('A1').alignment = { horizontal:'center' }
ws2.addRow([])
hdr(ws2, 3, ['Severity','Area','File / Route','Issue','Fix Applied','Status'])

const sevColors = { HIGH:'FFFEE2E2', MEDIUM:'FFFEF3C7', LOW:'FFF0FDF4' }
const fixes = [
  ['HIGH','API — Tasks','app/api/tasks/route.ts','No max limit cap — clients could request 10,000+ rows','Capped at 500 rows; added offset/range pagination','✅ Fixed'],
  ['HIGH','API — Projects','app/api/projects/route.ts','No max limit cap on project query','Capped at 500 rows','✅ Fixed'],
  ['HIGH','API — Clients','app/api/clients/route.ts','No limit or pagination — full table scan for large orgs','Added limit (500) + offset pagination params','✅ Fixed'],
  ['HIGH','DB — N+1','app/api/tasks/[id]/route.ts','Blocks check fired 1 DB query per blocking task (N+1)','Replaced Promise.all loop with single .in() batch query','✅ Fixed'],
  ['HIGH','Page Load','app/(app)/tasks/page.tsx','Initial SSR load was .limit(2000) on 4 parallel queries','Reduced to .limit(500) per query','✅ Fixed'],
  ['HIGH','Page Load','app/(app)/inbox/page.tsx','Initial SSR load was .limit(2000)','Reduced to .limit(500)','✅ Fixed'],
  ['HIGH','Pagination','ClientsView.tsx','No pagination — all clients rendered in one grid','Added 50-per-page client-side pagination with Prev/Next','✅ Fixed'],
  ['HIGH','Pagination','InboxView.tsx','No pagination — all tasks in each section rendered at once','Added 100-per-section show-more button','✅ Fixed'],
  ['HIGH','Pagination','RecurringView.tsx','No pagination — all recurring tasks rendered at once','Added show-more (100 at a time)','✅ Fixed'],
  ['HIGH','No Rate Limiting','All API routes','Zero rate limiting — any user can spam any endpoint','TODO: Add Upstash Redis rate limiter in middleware','⬜ Pending'],
  ['HIGH','No DB Indexes','Supabase schema','Missing indexes on tasks.assignee_id, parent_task_id, org_id+status','TODO: Add via Supabase migration','⬜ Pending'],
  ['MEDIUM','N+1 — Clone','app/api/projects/[id]/clone/route.ts','Cloning tasks loops with individual INSERT + SELECT per task','TODO: Batch insert tasks, batch fetch subtasks','⬜ Pending'],
  ['MEDIUM','Heavy Join','app/api/tasks/[id]/approve','4+ serial DB queries per approval decision','TODO: Combine into fewer queries with joins','⬜ Pending'],
  ['MEDIUM','JSONB Index','tasks table','JSONB _blocked_by array containment — no GIN index','TODO: CREATE INDEX on custom_fields using GIN','⬜ Pending'],
  ['MEDIUM','Auth Overhead','middleware.ts','supabase.auth.getUser() on every request — no caching','TODO: Cache session token validation (short TTL)','⬜ Pending'],
  ['MEDIUM','Large Select','app/api/tasks/[id]/route.ts','SELECT * wildcard fetches all JSONB custom_fields unnecessarily','TODO: Enumerate only needed columns','⬜ Pending'],
  ['MEDIUM','CA Tasks Load','app/(app)/tasks/page.tsx','caInstances fetched with no limit (could be thousands)','TODO: Add .limit(500) and lazy-load older instances','⬜ Pending'],
  ['MEDIUM','No Caching','All pages','No client-side caching — repeated page visits re-fetch all data','TODO: Implement React Query or SWR for data fetching','⬜ Pending'],
  ['LOW','Comments','app/api/tasks/[id]/comments','No limit on comments fetch — tasks with 1000s comments slow','TODO: Add .limit(200) and pagination UI','⬜ Pending'],
  ['LOW','Email Burst','lib/inngest/functions/','100 task assignments fire 100 emails serially','TODO: Batch to digest, rate-limit sends','⬜ Pending'],
  ['LOW','No CDN','next.config.ts','Static assets not cached with CDN headers','TODO: Configure cache-control headers + Vercel CDN','⬜ Pending'],
]

fixes.forEach(([sev, area, file, issue, fix, status]) => {
  const r = ws2.addRow([sev, area, file, issue, fix, status])
  const bg = sevColors[sev] || 'FFFFFFFF'
  r.eachCell((c, col) => {
    c.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:bg } }
    c.alignment = { vertical:'middle', wrapText:true }
    if (col === 1) c.font = { bold:true, color:{ argb: sev==='HIGH'?'FFDC2626':sev==='MEDIUM'?'FFD97706':'FF16A34A' } }
    if (col === 6) c.font = { bold:true, color:{ argb: status.startsWith('✅')?'FF16A34A':'FF94A3B8' } }
  })
})

// ─── Sheet 3: Feature Roadmap ──────────────────────────────────────────────────
const ws3 = wb.addWorksheet('🚀 Feature Roadmap')
ws3.columns = [
  { key:'feature', width:25 },
  { key:'desc',    width:50 },
  { key:'effort',  width:12 },
  { key:'week',    width:12 },
  { key:'depends', width:30 },
  { key:'status',  width:14 },
]
ws3.addRow(['FEATURE ROADMAP — Planora Launch']).font = { bold:true, size:14, color:{ argb:'FF7C3AED' } }
ws3.mergeCells('A1:F1'); ws3.getCell('A1').alignment = { horizontal:'center' }
ws3.addRow([])
hdr(ws3, 3, ['Feature','Description','Effort','Target Week','Dependencies','Status'])

const features = [
  ['Razorpay — Checkout','Replace manual billing with Razorpay subscription checkout (plan pages, upgrade flow)','Large','Week 2','Razorpay account approved','⬜ Todo'],
  ['Razorpay — Webhooks','Handle payment.captured, subscription.charged, subscription.cancelled events to update plan in DB','Medium','Week 2','Razorpay Checkout','⬜ Todo'],
  ['Razorpay — Billing Portal','Show invoices, current plan, cancel subscription in /settings/billing','Medium','Week 2','Razorpay Webhooks','⬜ Todo'],
  ['WhatsApp Notifications','Task-assigned and due-date-reminder messages via WhatsApp Business API','Large','Week 2','WA Business account','⬜ Todo'],
  ['WhatsApp Opt-in','User phone number field + opt-in toggle in /settings/notifications','Small','Week 2','WhatsApp Notifications','⬜ Todo'],
  ['Magic Link — Client Setup','Email link for new clients; on click, sets password + lands in client portal','Medium','Week 3','Client portal exists','⬜ Todo'],
  ['Partner / Client View','Read-only task + document upload view for clients (no sidebar, no edit)','Large','Week 3','Magic Link setup','⬜ Todo'],
  ['Client Document Checklist','Clients see required documents and can upload inline in their portal','Medium','Week 3','Partner View','⬜ Todo'],
  ['DB Indexes','Add missing Supabase indexes via migration for scalability','Small','Week 1–2','Supabase access','⬜ Todo'],
  ['Rate Limiting','Per-user, per-IP rate limits via Upstash Redis in Next.js middleware','Medium','Week 1–2','Upstash Redis account','⬜ Todo'],
  ['Load Testing','k6 or Locust test suite — simulate 500 concurrent users, identify bottlenecks','Medium','Week 3','Staging environment','⬜ Todo'],
  ['SEO + OG Tags','Add Open Graph meta + structured data to landing page for product hunt','Small','Week 4','Landing page copy','⬜ Todo'],
]
const featureColors = { Large:'FFFCE8F3', Medium:'FFEFF6FF', Small:'FFF0FDF4' }
features.forEach(([f,d,e,w,dep,s]) => {
  const r = ws3.addRow([f,d,e,w,dep,s])
  r.eachCell((c,col) => {
    c.fill = { type:'pattern', pattern:'solid', fgColor:{ argb: featureColors[e]||'FFFFFFFF' } }
    c.alignment = { vertical:'middle', wrapText:true }
    if (col===3) { c.alignment = { ...c.alignment, horizontal:'center' }; c.font = { bold:true } }
    if (col===6) c.font = { bold:true, color:{ argb:'FF94A3B8' } }
  })
})

// ─── Sheet 4: Marketing Plan ──────────────────────────────────────────────────
const ws4 = wb.addWorksheet('📣 Marketing Plan')
ws4.columns = [
  { key:'channel', width:22 },
  { key:'action',  width:55 },
  { key:'target',  width:20 },
  { key:'date',    width:14 },
  { key:'owner',   width:16 },
  { key:'status',  width:14 },
]
ws4.addRow(['MARKETING PLAN — Planora Launch (May 15, 2026)']).font = { bold:true, size:14, color:{ argb:'FFD97706' } }
ws4.mergeCells('A1:F1'); ws4.getCell('A1').alignment = { horizontal:'center' }
ws4.addRow([])
hdr(ws4, 3, ['Channel','Action','Target Audience','Date','Owner','Status'])

const marketing = [
  // Content
  ['Demo Video','Record 3–5 min walkthrough of core task + approval workflow','CA firms, SMBs','May 5–7','Marketing','⬜ Todo'],
  ['Demo Video — CA Module','Record 2–3 min CA compliance module deep-dive','CA / Tax firms','May 5–7','Marketing','⬜ Todo'],
  ['Promo Video','90-second snappy product overview for ads + social','General B2B','May 5–7','Marketing','⬜ Todo'],
  ['Screenshot Pack','10 polished screenshots for landing page & ads','All segments','May 3–4','Design','⬜ Todo'],
  // Digital
  ['LinkedIn','Post launch announcement + article on "how Planora helps CA firms"','CA professionals','May 15','Founder','⬜ Todo'],
  ['LinkedIn','Share behind-the-scenes build story (product journey) 3 days before launch','Early adopters','May 12','Founder','⬜ Todo'],
  ['Twitter / X','Tweet thread: "We built a task manager for CA firms because..."','Tech + CA community','May 15','Founder','⬜ Todo'],
  ['Instagram Reels','30-sec demo reel + promo video','Gen-Z professionals','May 15','Marketing','⬜ Todo'],
  ['WhatsApp Broadcast','Message to existing network of CA contacts','CA professionals','May 14','Founder','⬜ Todo'],
  // Email
  ['Email — Waitlist','Launch announcement to waitlist: features + discount code','Waitlist','May 15','Marketing','⬜ Todo'],
  ['Email — Existing Users','Changelog email to beta users: new features + thank you','Beta users','May 14','Marketing','⬜ Todo'],
  // Product Hunt / Communities
  ['Product Hunt','Submit product listing (prepare 2 weeks before)','Tech community','May 15','Founder','⬜ Todo'],
  ['Reddit','Post in r/Accounting, r/smallbusiness: "We built X for CA firms"','CA + SMB','May 15–16','Founder','⬜ Todo'],
  ['CA Community Groups','Share in WhatsApp / Telegram groups of CAs and accountants','CA firms','May 15','Founder','⬜ Todo'],
  // Paid (optional)
  ['Google Ads (optional)','Run search ads for "task manager for CA firms"','CA professionals','May 15+','Marketing','⬜ Todo'],
  ['LinkedIn Ads (optional)','Sponsored post targeting finance + accounting professionals','B2B decision makers','May 15+','Marketing','⬜ Todo'],
]
marketing.forEach(([ch,act,tgt,dt,own,st]) => {
  const r = ws4.addRow([ch,act,tgt,dt,own,st])
  r.eachCell(c => { c.alignment = { vertical:'middle', wrapText:true } })
})

// ─── Sheet 5: Issue Reports Guide ─────────────────────────────────────────────
const ws5 = wb.addWorksheet('🐛 Issue Reports Guide')
ws5.columns = [{ key:'k', width:30 },{ key:'v', width:70 }]
ws5.addRow(['WHERE DO USER-REPORTED ISSUES GO?']).font = { bold:true, size:14, color:{ argb:'FFDC2626' } }
ws5.mergeCells('A1:B1'); ws5.getCell('A1').alignment = { horizontal:'center' }
ws5.addRow([])
const guide = [
  ['Button location','Header bar — the "speech bubble with +" icon (MessageSquarePlus)'],
  ['How to trigger','Click the icon in the top-right header; type message, attach screenshot, submit'],
  ['API endpoint','POST /api/report-issue'],
  ['Storage — text','Saved to Supabase table: issue_reports (columns: id, org_id, reporter_id, message, page_url, attachments, status, created_at)'],
  ['Storage — files','Uploaded to Supabase Storage bucket: attachments, path: issue-reports/{timestamp}-{filename}'],
  ['Default status','open (you can manually update to resolved / in_progress in Supabase dashboard)'],
  ['How to view','Go to Supabase → Table Editor → issue_reports. Filter by status=open to see all open reports.'],
  ['Tip','Add a Supabase Webhook or trigger to email yourself on INSERT to issue_reports for instant alerts'],
  ['Current limitation','No in-app issue tracking dashboard — plan to build one in post-launch iteration'],
]
guide.forEach(([k,v]) => {
  const r = ws5.addRow([k,v])
  r.getCell(1).font = { bold:true }
  r.getCell(1).fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFF8FAFC' } }
  r.eachCell(c => { c.alignment = { vertical:'middle', wrapText:true } })
  ws5.getRow(ws5.rowCount).height = 28
})

// ─── Sheet 6: Launch Checklist ─────────────────────────────────────────────────
const ws6 = wb.addWorksheet('✅ Launch Checklist')
ws6.columns = [
  { key:'category', width:20 },
  { key:'item',     width:55 },
  { key:'done',     width:10 },
  { key:'notes',    width:35 },
]
ws6.addRow(['LAUNCH CHECKLIST — May 15, 2026']).font = { bold:true, size:14, color:{ argb:'FF0D9488' } }
ws6.mergeCells('A1:D1'); ws6.getCell('A1').alignment = { horizontal:'center' }
ws6.addRow([])
hdr(ws6, 3, ['Category','Checklist Item','Done?','Notes'])

const checklist = [
  ['Performance','API query limits capped (500 max)','☐',''],
  ['Performance','N+1 DB queries fixed in task blocks','☐',''],
  ['Performance','DB indexes added for org_id, assignee_id, parent_task_id','☐','Run Supabase migration'],
  ['Performance','Rate limiting enabled in middleware','☐','Needs Upstash Redis'],
  ['Performance','Load test passed (100+ concurrent users)','☐','Use k6 or locust'],
  ['Payments','Razorpay integration working (checkout + webhooks)','☐',''],
  ['Payments','Plan upgrades reflected immediately in UI','☐',''],
  ['Payments','Failed payment handling tested','☐',''],
  ['WhatsApp','Task-assigned WA notification sending correctly','☐',''],
  ['WhatsApp','Due-date reminders at 9 AM IST','☐',''],
  ['Client Portal','Magic link setup flow tested end-to-end','☐',''],
  ['Client Portal','Partner view renders correctly (no edit access)','☐',''],
  ['Email','All Inngest email functions verified (task assigned, approval, reminder)','☐',''],
  ['Email','FROM email domain verified in Resend','☐','Check DNS records'],
  ['Auth','OAuth (Google) login tested in production','☐',''],
  ['Auth','Magic link login tested in production','☐',''],
  ['UI / UX','Dark mode audit complete (no hardcoded hex backgrounds)','☐',''],
  ['UI / UX','Mobile responsive on all main pages','☐',''],
  ['SEO','Landing page has correct OG tags and meta description','☐',''],
  ['Infra','Custom domain configured + SSL active','☐','sng-adwisers.com'],
  ['Infra','Supabase DB backup snapshot taken before launch','☐',''],
  ['Infra','Inngest cron jobs (7 AM IST) verified in production','☐',''],
  ['Infra','Error monitoring (Sentry or similar) configured','☐',''],
  ['Content','Demo video uploaded and linked on landing page','☐',''],
  ['Content','Promo video ready for social media','☐',''],
  ['Marketing','Product Hunt listing scheduled for 12:01 AM PST May 15','☐',''],
  ['Marketing','Email to waitlist + existing users drafted and scheduled','☐',''],
  ['Marketing','Social posts pre-scheduled in tool (Buffer/Hootsuite)','☐',''],
  ['Marketing','WhatsApp broadcast list ready','☐',''],
  ['Post-Launch','Monitoring dashboard open on launch day','☐','Check Supabase metrics'],
  ['Post-Launch','On-call person assigned for launch day','☐',''],
]
checklist.forEach(([cat, item, done, notes]) => {
  const r = ws6.addRow([cat, item, done, notes])
  r.getCell(1).fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFF8FAFC' } }
  r.getCell(1).font = { bold:true }
  r.getCell(3).alignment = { horizontal:'center' }
  r.eachCell(c => { if (!c.alignment?.horizontal) c.alignment = { vertical:'middle', wrapText:true } })
})

// ─── Write ──────────────────────────────────────────────────────────────────
await wb.xlsx.writeFile(OUT)
console.log('✅  Excel written to:', OUT)
