/**
 * Engagement email catalogue — 102 hand-written educational/promotional pieces.
 *
 * One polished shell template (templates/engagementEmail.ts) renders these, so
 * every send looks consistent and premium while the CONTENT is always new for
 * the recipient (marketing_email_log guarantees no repeats per user).
 *
 * Categories rotate so consecutive weeks feel varied:
 *   feature   — upFloat how-tos & hidden gems
 *   msme      — Section 43B(h) / MSME ecosystem education
 *   compliance— statutory calendar tips & deadline know-how
 *   practice  — CA practice growth & operations
 *   trends    — tech & profession trends (evergreen wording, no dated claims)
 *   clients   — client communication & relationship craft
 *
 * Content rules: evergreen (no years/dates that stale), educational-first with
 * a soft CTA, short (2 paragraphs + optional tip) — never salesy walls of text.
 */

export interface EngagementItem {
  id:       string
  category: 'feature' | 'msme' | 'compliance' | 'practice' | 'trends' | 'clients'
  emoji:    string
  subject:  string
  title:    string
  body:     string[]          // 1–3 short paragraphs (plain text; shell handles styling)
  tip?:     string            // optional highlighted tip box
  cta:      { label: string; href: string }
}

const APP = 'https://upfloat.co'
const MSME = 'https://msme.upfloat.co'

export const ENGAGEMENT_ITEMS: EngagementItem[] = [
  // ── Cycle 1 ────────────────────────────────────────────────────────────────
  { id: 'feat-email-approvals', category: 'feature', emoji: '✅',
    subject: 'Approve work without opening the app',
    title: 'One click in your inbox = task approved',
    body: [
      'Every approval email upFloat sends carries Approve and Reject buttons. Tap one — the task updates instantly, the assignee is notified, and you never left your inbox.',
      'Partners tell us this alone saves them 20–30 app visits a week during filing season.',
    ],
    tip: 'Works on your phone too — approve from the train, the court corridor, anywhere.',
    cta: { label: 'See your pending approvals', href: `${APP}/approvals` } },

  { id: 'msme-what-is-43bh', category: 'msme', emoji: '⚖️',
    subject: 'The 45-day rule your clients keep asking about',
    title: 'Section 43B(h), in plain words',
    body: [
      'If a business buys from a registered Micro or Small enterprise and doesn\'t pay within 45 days (or 15 without a written agreement), the expense is only deductible in the year it\'s actually paid. That timing hit surprises a lot of businesses at tax time.',
      'The first step of staying safe is simply knowing which vendors are registered MSMEs — which means collecting Udyam declarations from every supplier.',
    ],
    cta: { label: 'Collect vendor declarations automatically', href: MSME } },

  { id: 'comp-nil-returns', category: 'compliance', emoji: '📋',
    subject: 'NIL returns still need a paper trail',
    title: 'A NIL month is not a "skip" month',
    body: [
      'A quiet month for a client still needs the filing marked, logged and defensible — "we had nothing to file" is an audit answer only if you can show when and who decided that.',
      'In upFloat, Mark as NIL stamps the task with who clicked it and when, so your working-paper file builds itself even in quiet months.',
    ],
    cta: { label: 'Open your compliance board', href: `${APP}/compliance` } },

  { id: 'prac-monday-list', category: 'practice', emoji: '🗓️',
    subject: 'The 15-minute Monday that saves your week',
    title: 'Run Monday like a partner, not a firefighter',
    body: [
      'High-performing firms start the week the same way: 15 minutes on one screen — what\'s due, what\'s overdue, what has no owner. Decisions get made before the phone starts ringing.',
      'The Monitor page was built for exactly this: every task in the firm, grouped by person or client, with unassigned work highlighted so nothing floats ownerless into Thursday.',
    ],
    cta: { label: 'Try the Monday review', href: `${APP}/monitor` } },

  { id: 'trend-clients-expect-portals', category: 'trends', emoji: '📱',
    subject: 'Your clients\' bank has an app. Their CA should too.',
    title: 'Client expectations moved. Quietly.',
    body: [
      'Your clients track parcels in real time and open fixed deposits from a phone. Then they email their CA a scan and hear nothing for a week. The gap between those two experiences is where firms lose clients — usually without ever being told why.',
      'A shared portal — where a client sees what\'s pending, uploads documents, and watches status change — closes that gap with zero extra effort from your team.',
    ],
    cta: { label: 'See the client portal', href: `${APP}/clients` } },

  { id: 'client-chasing-psychology', category: 'clients', emoji: '💬',
    subject: 'Why clients ignore your document requests',
    title: 'It\'s not laziness — it\'s friction',
    body: [
      'When a client has to dig through WhatsApp to find what you asked for, guess the format, and email it back, every step loses a percentage of them. Multiply by ten documents and silence is the predictable outcome.',
      'Give them one link with a checklist — what\'s needed, what\'s done, drag-and-drop upload — and the same clients respond in hours. The ask didn\'t change; the friction did.',
    ],
    tip: 'upFloat portal links need no login or account — one tap from any phone.',
    cta: { label: 'Send your first portal link', href: `${APP}/clients` } },

  // ── Cycle 2 ────────────────────────────────────────────────────────────────
  { id: 'feat-recurring-autopilot', category: 'feature', emoji: '🔄',
    subject: 'Set GST tasks once. Never create them again.',
    title: 'Recurring tasks: your filing calendar on autopilot',
    body: [
      'Monthly GSTR-3B, quarterly TDS, annual ROC — if you create these by hand every period, you\'re spending partner time on clerk work and gambling that nobody forgets.',
      'Set the frequency once and upFloat spawns each occurrence on schedule, assigns it, and reminds the owner. The calendar runs itself.',
    ],
    cta: { label: 'Set up a repeat task', href: `${APP}/recurring` } },

  { id: 'msme-vendor-resistance', category: 'msme', emoji: '🤝',
    subject: 'When vendors won\'t reply to MSME requests',
    title: 'The trick to vendor responses: make "No" effortless',
    body: [
      'Most vendors ignoring your MSME status request aren\'t hiding anything — they\'re simply not MSMEs and can\'t be bothered to fill a form to say so.',
      'That\'s why upFloat\'s vendor email leads with two buttons: "Yes, we\'re registered" and "No, we\'re not." The No takes ten seconds, needs no login, and still gives your client a signed, timestamped declaration for the file.',
    ],
    cta: { label: 'See the vendor flow', href: MSME } },

  { id: 'comp-deadline-buffer', category: 'compliance', emoji: '⏰',
    subject: 'Why good firms finish 3 days early',
    title: 'The internal deadline is the real deadline',
    body: [
      'Portals crash on due dates. OTPs don\'t arrive. Clients discover a missing challan at 6 pm. Firms that never file late aren\'t luckier — they simply treat T-minus-3 as the finish line.',
      'upFloat\'s "days before due" setting spawns every compliance task early by exactly the buffer you choose, so your team\'s deadline and the government\'s deadline are never the same day.',
    ],
    cta: { label: 'Set your buffer days', href: `${APP}/compliance` } },

  { id: 'prac-delegation-ladder', category: 'practice', emoji: '🪜',
    subject: 'The delegation problem every growing firm hits',
    title: 'Delegate the task, keep the control',
    body: [
      'Partners under-delegate for one reason: handing work over used to mean losing sight of it. So the partner stays the bottleneck and the juniors stay under-used.',
      'Approval flows break that trade-off — juniors do the work, mark it done, and it comes to you for one-click sign-off. You see everything, touch only what needs you.',
    ],
    cta: { label: 'Turn on approvals', href: `${APP}/tasks` } },

  { id: 'trend-solo-to-team', category: 'trends', emoji: '📈',
    subject: 'Why one-partner firms are hiring their first team',
    title: 'The profession is quietly restructuring',
    body: [
      'Compliance volume per client keeps rising — more filings, more disclosures, more portals. Solo practices are hitting the ceiling of hours, and the answer is small teams with clear systems, not longer nights.',
      'The firms making that jump smoothly all share one habit: work lives in a system, not in the partner\'s head. That\'s what makes the second and third hire productive from week one.',
    ],
    cta: { label: 'Bring your team in', href: `${APP}/team` } },

  { id: 'client-status-updates', category: 'clients', emoji: '📣',
    subject: 'The message clients actually want from you',
    title: '"It\'s filed" beats any newsletter',
    body: [
      'Clients don\'t want more content from their CA — they want certainty. "Your GSTR-3B is filed, acknowledgement attached" lands better than any festive greeting ever will.',
      'When your task system logs completion the moment it happens, that message becomes a habit instead of an afterthought — and clients notice the difference within a month.',
    ],
    cta: { label: 'See what\'s completing today', href: `${APP}/monitor` } },

  // ── Cycle 3 ────────────────────────────────────────────────────────────────
  { id: 'feat-unassigned-amber', category: 'feature', emoji: '🟠',
    subject: 'The amber rows that save filings',
    title: 'Unassigned work now glows — on purpose',
    body: [
      'Every missed deadline post-mortem ends the same way: "I thought someone else had it." The dangerous task isn\'t the late one — it\'s the ownerless one.',
      'Across upFloat, any open task with no assignee is highlighted amber — in My Tasks, CA Compliance, and the Monitor. If something\'s glowing, someone claims it. Simple as that.',
    ],
    cta: { label: 'Check for amber rows now', href: `${APP}/monitor` } },

  { id: 'msme-interest-cost', category: 'msme', emoji: '💸',
    subject: 'Late MSME payments cost 3× bank interest',
    title: 'The expensive part isn\'t the tax timing',
    body: [
      'Beyond the 43B(h) deduction deferral, the MSMED Act entitles Micro and Small suppliers to compound interest at three times the RBI bank rate on delayed payments — and buyers must disclose outstanding MSME dues in their accounts.',
      'Clean vendor classification is what keeps this manageable: know who\'s an MSME, watch the payment clock, disclose accurately. It starts with declarations on file.',
    ],
    cta: { label: 'Get vendor status on record', href: MSME } },

  { id: 'comp-working-papers', category: 'compliance', emoji: '🗂️',
    subject: 'Working papers that assemble themselves',
    title: 'The file should build while the work happens',
    body: [
      'Assembling working papers after the fact is how weekends disappear — hunting attachments across email, WhatsApp and desktop folders, months after anyone remembers where things went.',
      'When each compliance task requires its documents to be attached before it can close, the working-paper file is complete the moment the filing is. Nothing to assemble later, ever.',
    ],
    cta: { label: 'See document checklists', href: `${APP}/compliance` } },

  { id: 'prac-capacity-truth', category: 'practice', emoji: '⚖️',
    subject: 'Who on your team is actually overloaded?',
    title: 'Feelings lie about workload. Counts don\'t.',
    body: [
      'The loudest person isn\'t always the busiest, and the quiet one drowning in TDS returns won\'t tell you until something slips. Allocating by impression is how good staff burn out and average staff coast.',
      'Group the firm\'s open tasks by assignee once a week and the truth is right there — who\'s stacked, who has room, what to move. Two minutes, better decisions.',
    ],
    cta: { label: 'View workload by person', href: `${APP}/monitor` } },

  { id: 'trend-email-actions', category: 'trends', emoji: '⚡',
    subject: 'Software is coming to you now',
    title: 'The best tools stopped making you visit them',
    body: [
      'Notice how modern tools behave: the action comes to where you already are. Meeting links in the invite, approvals in the chat, payments in the message. Opening yet another dashboard is becoming the exception.',
      'That\'s the thinking behind upFloat\'s email actions — approve, reject or complete a task from the notification itself. The system adapts to your day, not the other way around.',
    ],
    cta: { label: 'Experience it — assign a task', href: `${APP}/tasks` } },

  { id: 'client-onboarding-week1', category: 'clients', emoji: '🚀',
    subject: 'The first week decides the client relationship',
    title: 'Onboard like you mean it',
    body: [
      'A new client\'s trust is set in week one. If the first experience is a checklist, a portal invite, and their compliance calendar mapped before they ask — you\'ve framed the entire relationship as organised.',
      'upFloat\'s client onboarding checklist plus compliance auto-setup means "we\'ve already scheduled your year" can be your day-two message. Few firms can say it.',
    ],
    cta: { label: 'Add a client the organised way', href: `${APP}/clients/new` } },

  // ── Cycle 4 ────────────────────────────────────────────────────────────────
  { id: 'feat-clone-subtasks', category: 'feature', emoji: '📑',
    subject: 'Duplicate a task — checklist and all',
    title: 'Clone once, keep the whole structure',
    body: [
      'Built the perfect audit task with nine subtasks? Cloning it now carries every subtask along — assignees, order, checklist flags — with statuses reset for the fresh round.',
      'Build the structure once, reuse it for every similar engagement. Templates without the template maintenance.',
    ],
    cta: { label: 'Clone your best task', href: `${APP}/tasks` } },

  { id: 'msme-udyam-basics', category: 'msme', emoji: '📜',
    subject: 'Udyam numbers: what to actually verify',
    title: 'Reading a Udyam registration like a pro',
    body: [
      'A Udyam number follows a strict shape — UDYAM-XX-00-0000000, where XX is the state code. The classification (Micro / Small / Medium) matters too: 43B(h) applies to Micro and Small suppliers, not Medium.',
      'upFloat validates the format on entry and stores the certificate alongside the declaration, so your client\'s file holds proof, not just claims.',
    ],
    cta: { label: 'Start verifying vendors', href: MSME } },

  { id: 'comp-quarter-close', category: 'compliance', emoji: '🧭',
    subject: 'Close the quarter before it closes on you',
    title: 'A quarter-end ritual worth stealing',
    body: [
      'Last fortnight of the quarter, run one filter: everything due within 30 days across all clients, sorted by owner. What has no owner gets one. What\'s stuck gets unstuck. Fifteen minutes, quarterly.',
      'Firms that do this simply don\'t have quarter-end fire drills — the fires get put out while they\'re still sparks.',
    ],
    cta: { label: 'Run the 30-day view', href: `${APP}/monitor` } },

  { id: 'prac-say-no-scope', category: 'practice', emoji: '🛡️',
    subject: 'The out-of-scope work eating your margin',
    title: 'Track it before you decide to bill it',
    body: [
      '"Can you also quickly…" is how engagements silently double. The problem usually isn\'t the client — it\'s that nobody in the firm can see how much extra has accumulated.',
      'Log every ad-hoc request as a task against the client, and by renewal time you\'re negotiating with a list instead of a feeling.',
    ],
    cta: { label: 'Start logging ad-hoc work', href: `${APP}/tasks` } },

  { id: 'trend-audit-trail-default', category: 'trends', emoji: '🔍',
    subject: 'Everything is becoming an audit trail',
    title: 'The "who did what, when" era',
    body: [
      'Regulators, clients and courts increasingly expect timestamped evidence — who approved, who filed, when the document arrived. Memory and goodwill are no longer records.',
      'Working inside a system that logs activity as a side effect means you\'re never reconstructing history under pressure. The trail exists because the work happened there.',
    ],
    cta: { label: 'See your activity log', href: `${APP}/activity` } },

  { id: 'client-bad-news-fast', category: 'clients', emoji: '⚠️',
    subject: 'Deliver bad news like a top firm',
    title: 'Speed beats spin, every time',
    body: [
      'A penalty notice, a missed credit, an error found — clients forgive problems far more easily than they forgive discovering them late. The firms with the strongest client loyalty are the fastest to say "here\'s what happened and here\'s the plan."',
      'That speed needs internal visibility: you can\'t report what you can\'t see. A live board of every client\'s status is what makes same-day honesty possible.',
    ],
    cta: { label: 'Know before they call', href: `${APP}/monitor` } },

  // ── Cycle 5 ────────────────────────────────────────────────────────────────
  { id: 'feat-portal-nologin', category: 'feature', emoji: '🔗',
    subject: 'Your clients never need another password',
    title: 'Portal links, not portal accounts',
    body: [
      'Every "create an account to continue" loses half your clients. upFloat portals work with a secure magic link — the client taps and they\'re in, on any device, no password, no app install.',
      'Links expire automatically for safety, and every upload lands filed under the right client and service on your side.',
    ],
    cta: { label: 'Share a portal link', href: `${APP}/clients` } },

  { id: 'msme-buyer-disclosure', category: 'msme', emoji: '🧾',
    subject: 'The MSME disclosure most buyers get wrong',
    title: 'It\'s not just payment — it\'s disclosure',
    body: [
      'Companies must disclose amounts owed to Micro and Small suppliers, including interest due, in their financial statements. Auditors ask for the vendor-wise breakup — and "we don\'t know who\'s an MSME" is not an answer that ages well.',
      'A clean, certificate-backed vendor register turns that disclosure from a scramble into an export.',
    ],
    cta: { label: 'Build the vendor register', href: MSME } },

  { id: 'comp-handover-proof', category: 'compliance', emoji: '🔁',
    subject: 'When staff leave, does the work leave too?',
    title: 'Departure-proof your compliance calendar',
    body: [
      'An article leaves and suddenly nobody knows which clients\' GST they handled, what was mid-way, or where the files are. Every firm has lived this at least once.',
      'When tasks, deadlines and documents live against the client — not in someone\'s inbox — a handover is a five-minute reassignment, not an archaeology project.',
    ],
    cta: { label: 'Reassign in one click', href: `${APP}/team` } },

  { id: 'prac-price-on-process', category: 'practice', emoji: '💰',
    subject: 'Charge for the system, not just the filing',
    title: 'Your process is a product. Price it.',
    body: [
      'Two firms file the same return. One emails "done." The other gives the client a live portal, deadline visibility, and instant document upload. Same filing — different product. The second firm defends higher fees without arguing.',
      'Clients rarely pay more for expertise they can\'t see. They happily pay for organisation they experience every week.',
    ],
    cta: { label: 'Give clients the experience', href: `${APP}/clients` } },

  { id: 'trend-whatsapp-formality', category: 'trends', emoji: '💼',
    subject: 'WhatsApp is where formality goes to die',
    title: 'Convenient channel, terrible system of record',
    body: [
      'WhatsApp wins on speed and loses on everything else: no structure, no status, no retrieval, screenshots as "records." Great for a nudge; catastrophic as the firm\'s memory.',
      'The pattern that works: converse on WhatsApp, transact in a system. Send the portal link in the chat — let the upload, timestamp and filing live where they can be found next year.',
    ],
    cta: { label: 'Move documents out of chat', href: `${APP}/clients` } },

  { id: 'client-yearly-review', category: 'clients', emoji: '🎯',
    subject: 'The 20-minute meeting clients remember all year',
    title: 'Show them their year, not your effort',
    body: [
      'Once a year, show each key client one page: everything filed, every deadline met, documents archived and retrievable. It\'s the rare meeting where the client sees the invisible work they\'ve been paying for.',
      'Firms that do this report easier renewals and better referrals — value made visible is value remembered.',
    ],
    cta: { label: 'Export a client\'s year', href: `${APP}/reports` } },

  // ── Cycle 6 ────────────────────────────────────────────────────────────────
  { id: 'feat-dark-mode', category: 'feature', emoji: '🌙',
    subject: 'For the 11 pm filing sessions',
    title: 'Dark mode, because deadlines don\'t keep office hours',
    body: [
      'Late-night portal sessions are part of the profession. Your tools shouldn\'t sear your eyes while you\'re at it — toggle dark mode from the header and the whole workspace follows.',
      'Small thing? Sure. But the tools you live in should feel considered everywhere.',
    ],
    cta: { label: 'Flip the switch', href: `${APP}/dashboard` } },

  { id: 'msme-partner-earn', category: 'msme', emoji: '🤝',
    subject: 'Your CA network is worth more than referrals-for-thanks',
    title: 'Recommend tools you trust — and be valued for it',
    body: [
      'You already tell fellow CAs what works. The upFloat partner program simply recognises that: share the MSME tracker with your network, and earn a commission when a referred firm buys a pack.',
      'Your referral link does the tracking; the dashboard shows sign-ups and earnings transparently.',
    ],
    cta: { label: 'Get your partner link', href: `${APP}/partners/join` } },

  { id: 'comp-attach-before-done', category: 'compliance', emoji: '📎',
    subject: 'The rule that ends "where\'s the acknowledgement?"',
    title: 'No attachment, no closure',
    body: [
      'The costliest words in compliance are "it\'s filed, I\'ll attach it later." Later has a way of never arriving — until an assessment notice asks for it.',
      'upFloat\'s compliance sub-steps physically can\'t be closed without their document attached (or a logged NIL). The discipline is enforced by the software, not by reminders.',
    ],
    cta: { label: 'See it in action', href: `${APP}/compliance` } },

  { id: 'prac-two-partner-view', category: 'practice', emoji: '👥',
    subject: 'Partner alignment without the Monday meeting',
    title: 'Two partners, one source of truth',
    body: [
      'Multi-partner friction usually isn\'t disagreement — it\'s divergence. Each partner carries a different mental picture of what\'s pending, and decisions collide.',
      'A shared live board dissolves most of it: both partners look at the same reality, so conversations start at "what do we do" instead of "wait, what\'s the status."',
    ],
    cta: { label: 'Share the same picture', href: `${APP}/monitor` } },

  { id: 'trend-niche-firms', category: 'trends', emoji: '🎯',
    subject: 'The riches are still in the niches',
    title: 'Specialist firms are pulling ahead',
    body: [
      'Startups-only. Exporters-only. Healthcare practices. The firms growing fastest have stopped being everything to everyone — a niche makes referrals obvious and marketing cheap.',
      'Operationally, a niche also means repeatable task structures. Build the checklist once for your client type, and every new client onboards on rails.',
    ],
    cta: { label: 'Template your niche', href: `${APP}/projects` } },

  { id: 'client-proactive-deadline', category: 'clients', emoji: '📅',
    subject: 'Tell them before they ask',
    title: 'The pre-deadline message that builds loyalty',
    body: [
      '"Your advance tax is due on the 15th, here\'s the estimate" — sent a week early — does more for retention than any discount. It says: someone is watching your account.',
      'The trick is having deadlines organised enough that being early is systematic, not heroic.',
    ],
    cta: { label: 'See what\'s coming up', href: `${APP}/calendar` } },

  // ── Cycle 7 ────────────────────────────────────────────────────────────────
  { id: 'feat-search-ctrlk', category: 'feature', emoji: '⌨️',
    subject: 'The keyboard shortcut that finds anything',
    title: 'Ctrl+K: your firm, one keystroke away',
    body: [
      'Any task, any client, any project — press Ctrl+K (Cmd+K on Mac), type three letters, and jump. No sidebar spelunking, no "which page was that on."',
      'Once it\'s muscle memory, watching someone navigate by clicking feels like watching someone type with one finger.',
    ],
    cta: { label: 'Try it now', href: `${APP}/dashboard` } },

  { id: 'msme-trader-nuance', category: 'msme', emoji: '🏪',
    subject: 'Traders and 43B(h): the nuance everyone misses',
    title: 'Registered ≠ covered, for traders',
    body: [
      'Wholesale and retail traders can hold Udyam registration (for priority-sector lending benefits) — but they\'re generally outside the Micro/Small supplier protections of 43B(h). Classification on the certificate matters.',
      'This is exactly why declarations should capture the nature of business, not just a yes/no — upFloat\'s vendor form records manufacturer / service provider / trader for every response.',
    ],
    cta: { label: 'Capture the full picture', href: MSME } },

  { id: 'comp-multi-entity-families', category: 'compliance', emoji: '👨‍👩‍👧',
    subject: 'One family, five entities, zero confusion',
    title: 'Client groups for business families',
    body: [
      'The patriarch\'s HUF, two private limiteds, a partnership and an LLP — Indian family businesses come as constellations, and tracking them as unrelated clients hides the whole picture.',
      'Group them in upFloat and see the family\'s combined compliance state at once — while each entity keeps its own tasks, documents and deadlines.',
    ],
    cta: { label: 'Create a client group', href: `${APP}/clients` } },

  { id: 'prac-fee-collection', category: 'practice', emoji: '🧾',
    subject: 'Bill while the value is fresh',
    title: 'Invoice at completion, not at quarter-end',
    body: [
      'The longer the gap between the work and the bill, the more the fee feels like a cost instead of a value. Invoicing weeks later invites scrutiny; invoicing at completion invites payment.',
      'Mark tasks billable as you work and the unbilled list is ready whenever you are — no reconstruction, no forgotten items quietly written off.',
    ],
    cta: { label: 'See unbilled work', href: `${APP}/invoices` } },

  { id: 'trend-data-hygiene', category: 'trends', emoji: '🔐',
    subject: 'Client data is now a liability and an asset',
    title: 'Data protection reached the CA office',
    body: [
      'India\'s data protection regime makes consent, purpose-limitation and erasure rights real obligations for anyone holding personal data — and a CA firm holds plenty. The firms treating this seriously early will wear it as a trust badge.',
      'Practical start: collect through consented, purpose-stated channels instead of open email, and know where every document lives.',
    ],
    cta: { label: 'Collect data the compliant way', href: `${APP}/clients` } },

  { id: 'client-response-sla', category: 'clients', emoji: '⏱️',
    subject: 'Answer in hours, deliver in days',
    title: 'Acknowledgement is a service',
    body: [
      'Clients can wait days for the answer if they get a same-hour "received, on it, expect it Thursday." Silence is what breeds anxiety and the dreaded "just following up" calls.',
      'When requests land as tasks with owners, that acknowledgement can be a habit — and the follow-up calls quietly stop.',
    ],
    cta: { label: 'Route requests into tasks', href: `${APP}/inbox` } },

  // ── Cycle 8 ────────────────────────────────────────────────────────────────
  { id: 'feat-monitor-live', category: 'feature', emoji: '📺',
    subject: 'Your firm, refreshing every 30 seconds',
    title: 'The Monitor is now live',
    body: [
      'Keep the Monitor open on a second screen and it refreshes itself — statuses change, new work appears, amber unassigned rows light up and clear as your team assigns them.',
      'It\'s the closest thing to a control room a CA firm can have. Some partners keep it on a wall screen during filing season.',
    ],
    cta: { label: 'Open the control room', href: `${APP}/monitor` } },

  { id: 'msme-year-round', category: 'msme', emoji: '🔁',
    subject: 'MSME compliance is not a March activity',
    title: 'Vendors change. Your register should too.',
    body: [
      'New vendors join mid-year, registrations lapse, categories change on renewal. A vendor register built once in March is stale by July — and a stale register is what turns 43B(h) into a year-end surprise.',
      'The sustainable pattern: every new vendor gets a declaration request at onboarding, automatically. The register maintains itself.',
    ],
    cta: { label: 'Make it continuous', href: MSME } },

  { id: 'comp-audit-trail-defence', category: 'compliance', emoji: '🛡️',
    subject: 'When the officer asks "prove it"',
    title: 'Your best defence is a boring timeline',
    body: [
      'Assessments increasingly turn on process evidence: when did the document arrive, who prepared, who reviewed, when was it filed. A dull, complete timeline ends conversations that arguments prolong.',
      'Work done inside a logging system generates that timeline for free. Work done over email generates a weekend of forensic inbox archaeology.',
    ],
    cta: { label: 'Let the trail build itself', href: `${APP}/activity` } },

  { id: 'prac-intern-ramp', category: 'practice', emoji: '🎓',
    subject: 'Make your next article productive in week one',
    title: 'Onboarding juniors without babysitting',
    body: [
      'New articles spend their first month asking "what do I do next?" — not from laziness, but because the work map lives in seniors\' heads.',
      'Give them a My Tasks queue with clear deadlines and document checklists, and the question answers itself. Seniors review outcomes instead of dictating steps.',
    ],
    cta: { label: 'Set up their queue', href: `${APP}/team` } },

  { id: 'trend-fixed-fee', category: 'trends', emoji: '📦',
    subject: 'Hourly billing is losing to packages',
    title: 'Clients buy outcomes, not hours',
    body: [
      '"₹X per month, everything handled" is winning against itemised hourly bills across professional services — clients prefer predictability, and firms with efficient systems keep the efficiency gains instead of billing fewer hours.',
      'Packages only work when your cost-to-serve is under control. That\'s a process question before it\'s a pricing one.',
    ],
    cta: { label: 'Control cost-to-serve', href: `${APP}/reports` } },

  { id: 'client-referral-moment', category: 'clients', emoji: '🌟',
    subject: 'Ask for the referral at the right moment',
    title: 'Referrals follow relief, not satisfaction',
    body: [
      'The best time to ask "know anyone else who needs this?" is the moment you\'ve just solved a scary problem — notice resolved, refund arrived, deadline saved. Gratitude converts; routine doesn\'t.',
      'Which means the real referral engine is simply knowing when those moments happen across your client base — visibility again.',
    ],
    cta: { label: 'Spot the moments', href: `${APP}/monitor` } },

  // ── Cycle 9 ────────────────────────────────────────────────────────────────
  { id: 'feat-time-tracking', category: 'feature', emoji: '⏲️',
    subject: 'Where did the week actually go?',
    title: 'Time tracking without the surveillance vibe',
    body: [
      'Time logs aren\'t about policing staff — they\'re about discovering that the "small" client consumes 30 hours a month while the premium one takes six. Fee conversations change instantly after that.',
      'Log time against tasks as you go, and the truth accumulates painlessly.',
    ],
    cta: { label: 'Start a timer', href: `${APP}/time` } },

  { id: 'msme-two-lists', category: 'msme', emoji: '📊',
    subject: 'Every business needs exactly two vendor lists',
    title: 'Registered, and everyone else',
    body: [
      'At the year-end, 43B(h) analysis reduces to two lists: vendors who are registered Micro/Small (payment clock applies), and vendors who declared they\'re not (clock doesn\'t). Businesses in trouble are the ones with a third list: "unknown."',
      'The whole point of a declaration campaign is emptying that third list before it matters.',
    ],
    cta: { label: 'Empty the unknown list', href: MSME } },

  { id: 'comp-portal-day-change', category: 'compliance', emoji: '🌪️',
    subject: 'When the government moves the deadline',
    title: 'Extensions are chaos multipliers — unless',
    body: [
      'A due-date extension sounds like relief and lands like chaos: half your team plans for the old date, half for the new, and clients quote whichever suits them.',
      'Change the date once on the master and push it to every affected client\'s task — with a confirmation showing exactly what moves. One source of truth survives the shuffle.',
    ],
    cta: { label: 'Manage master deadlines', href: `${APP}/compliance` } },

  { id: 'prac-friday-ship', category: 'practice', emoji: '📤',
    subject: 'End the week with a shipped list',
    title: 'Friday: count completions, not hours',
    body: [
      'Teams that end Friday reviewing what shipped — filings done, notices answered, clients updated — build a rhythm of finishing. Teams that end Friday exhausted but unsure what closed build a rhythm of churning.',
      'The completed-this-week view exists for exactly this two-minute ritual.',
    ],
    cta: { label: 'See what shipped', href: `${APP}/reports` } },

  { id: 'trend-clients-shop-around', category: 'trends', emoji: '🔎',
    subject: 'Your clients are being pitched right now',
    title: 'Loyalty is earned monthly now',
    body: [
      'Online-first accounting services pitch your clients constantly — cheaper, faster, app-based. What they can\'t replicate is your judgement plus visible organisation. What they beat easily is your judgement wrapped in silence and delays.',
      'The defensive moat isn\'t sentiment. It\'s being demonstrably on top of their affairs, every month.',
    ],
    cta: { label: 'Be visibly on top', href: `${APP}/clients` } },

  { id: 'client-document-dignity', category: 'clients', emoji: '🗄️',
    subject: 'Stop asking clients for the same document twice',
    title: 'The repeat-request tax on trust',
    body: [
      'Asking for a PAN copy the third time tells the client their documents go into a void. Each repeat request quietly erodes the "my CA has it handled" feeling you\'re selling.',
      'One client, one archive — evergreen documents stored once, visible to the whole team, never requested twice.',
    ],
    cta: { label: 'Build the client archive', href: `${APP}/clients` } },

  // ── Cycle 10 ───────────────────────────────────────────────────────────────
  { id: 'feat-calendar-view', category: 'feature', emoji: '🗓️',
    subject: 'See the month before it happens',
    title: 'The calendar view your deadlines deserve',
    body: [
      'Lists tell you what; calendars tell you when it collides. Seeing all deadlines on a month grid reveals crunch weeks while you can still do something about them.',
      'Every task and recurring occurrence lands on the upFloat calendar automatically — glance every Monday and staff the heavy weeks in advance.',
    ],
    cta: { label: 'Open the calendar', href: `${APP}/calendar` } },

  { id: 'msme-simple-pitch', category: 'msme', emoji: '🎤',
    subject: 'Explain 43B(h) to a client in 20 seconds',
    title: 'The elevator version that lands',
    body: [
      'Try this: "If you pay small suppliers late, the tax department delays your deduction and the law adds penal interest. We\'ll find out which of your vendors are covered, and keep you clean. It takes your team zero effort."',
      'Every clause earns its place: consequence, solution, effort. Clients say yes to that in one meeting.',
    ],
    cta: { label: 'Deliver on the pitch', href: MSME } },

  { id: 'comp-dsc-expiry', category: 'compliance', emoji: '🔑',
    subject: 'The DSC that expires mid-filing',
    title: 'Track signatures like deadlines',
    body: [
      'Nothing derails a filing day like a digital signature that expired last Tuesday. DSC renewals are trivially predictable and yet perpetually surprising.',
      'upFloat\'s DSC expiry tracker watches every client\'s certificates and warns you while renewal is still a calm errand instead of an emergency.',
    ],
    cta: { label: 'Check your DSC board', href: `${APP}/clients/dsc-expiry` } },

  { id: 'prac-single-inbox', category: 'practice', emoji: '📥',
    subject: 'Five inboxes is zero inboxes',
    title: 'Requests need one front door',
    body: [
      'When work arrives via email, WhatsApp, calls, and hallway conversations, the firm\'s real to-do list exists nowhere. Prioritisation becomes guesswork; things fall through the cracks between channels.',
      'The habit that fixes it: whatever the channel, the request becomes a task within the hour. Conversations can happen anywhere; commitments live in one place.',
    ],
    cta: { label: 'Open the one front door', href: `${APP}/inbox` } },

  { id: 'trend-msme-formalisation', category: 'trends', emoji: '🏭',
    subject: 'Crores of MSMEs are formalising — with paperwork',
    title: 'The formalisation wave is a services wave',
    body: [
      'Udyam registrations keep climbing as benefits get tied to registration — credit, subsidies, payment protection. Every newly-formalised enterprise is a new bundle of filings, declarations and compliance needs.',
      'For CA firms, this is the rare tide that lifts demand for exactly what you already do. Positioning yourself as the MSME-fluent firm in your market is timing, not luck.',
    ],
    cta: { label: 'Lead with MSME services', href: MSME } },

  { id: 'client-language-simple', category: 'clients', emoji: '🗣️',
    subject: 'Clients don\'t speak section numbers',
    title: 'Translate, don\'t recite',
    body: [
      '"You need to comply with 43B(h)" means nothing to a trader. "Pay these five vendors within 45 days or your tax bill goes up" changes behaviour the same afternoon.',
      'The translation habit — consequence first, section number never — is the cheapest client-satisfaction upgrade available to any firm.',
    ],
    cta: { label: 'Give clients clarity', href: `${APP}/clients` } },

  // ── Cycle 11 ───────────────────────────────────────────────────────────────
  { id: 'feat-permissions-fine', category: 'feature', emoji: '🎛️',
    subject: 'Give juniors exactly enough rope',
    title: 'Permissions tuned to your firm, not ours',
    body: [
      'Should articles assign tasks? Can managers delete clients? Every firm answers differently — so upFloat makes each permission a toggle instead of a philosophy.',
      'Five roles out of the box, plus fine-grained switches when you outgrow them. Changes apply instantly.',
    ],
    cta: { label: 'Tune your permissions', href: `${APP}/settings/permissions` } },

  { id: 'msme-followup-cadence', category: 'msme', emoji: '📮',
    subject: 'Vendors respond on the third ask',
    title: 'Persistence, automated politely',
    body: [
      'Declaration campaigns follow a curve: a burst of quick responders, then silence that only polite persistence breaks. Most responses that ever arrive do so by the third or fourth touch.',
      'Automated reminders at day 7, 14, 21 and 30 — skipping everyone who already answered — deliver that persistence without anyone maintaining a chase list.',
    ],
    cta: { label: 'Set and forget follow-ups', href: MSME } },

  { id: 'comp-approval-required-tasks', category: 'compliance', emoji: '👁️',
    subject: 'Four eyes before anything goes out',
    title: 'Review gates for the filings that matter',
    body: [
      'Some filings are routine; some can\'t afford a junior\'s solo judgement. The difference should be encoded in the workflow, not remembered under pressure.',
      'Flag sensitive compliance tasks as approval-required and they physically cannot close without a senior\'s sign-off — which arrives as a one-click email anyway.',
    ],
    cta: { label: 'Add review gates', href: `${APP}/compliance` } },

  { id: 'prac-own-numbers', category: 'practice', emoji: '📉',
    subject: 'The cobbler\'s children need shoes',
    title: 'Run your firm on the numbers you preach',
    body: [
      'CAs counsel clients on dashboards and MIS — then run their own practice on intuition. Completion rates, overdue counts, workload per person: your firm generates these numbers too.',
      'Ten minutes with your own reports each month is the advice you\'d bill a client for. Take it free.',
    ],
    cta: { label: 'Read your own MIS', href: `${APP}/reports` } },

  { id: 'trend-response-speed', category: 'trends', emoji: '🚀',
    subject: 'Speed is the new specialisation',
    title: 'Fast firms feel bigger than they are',
    body: [
      'In every professional service, response speed has become a proxy for competence. The two-partner firm that answers in an hour outranks the fifty-person firm that answers in a week — in the client\'s mind, where it counts.',
      'Speed at scale isn\'t heroism; it\'s routing. Requests → owners → visible deadlines. The system is the speed.',
    ],
    cta: { label: 'Build the routing', href: `${APP}/inbox` } },

  { id: 'client-festive-real', category: 'clients', emoji: '🪔',
    subject: 'Skip the 200th Diwali graphic',
    title: 'Festive wishes clients actually read',
    body: [
      'Every client receives two hundred identical festive graphics. The one they remember says: "Happy Diwali — and a heads-up, your GST for October is already prepared, filing right after the holidays. Enjoy the break properly."',
      'Warmth plus competence beats clip-art. Every single time.',
    ],
    cta: { label: 'Know their status first', href: `${APP}/monitor` } },

  // ── Cycle 12 ───────────────────────────────────────────────────────────────
  { id: 'feat-import-excel', category: 'feature', emoji: '📤',
    subject: 'Your Excel life, imported in minutes',
    title: 'Bring the whole practice over lunch',
    body: [
      'Years of client lists and task trackers in Excel aren\'t a moving obstacle — they\'re a head start. upFloat\'s importer takes your sheets and creates clients, tasks and recurring schedules in one pass, with a live progress bar.',
      'Most firms complete the entire migration in under an hour. The spreadsheet era ends quietly.',
    ],
    cta: { label: 'Import your sheets', href: `${APP}/import` } },

  { id: 'msme-cost-of-manual', category: 'msme', emoji: '⏳',
    subject: 'The real cost of a manual vendor campaign',
    title: '200 vendors × manual chasing = one lost month',
    body: [
      'Doing declarations by hand means drafting emails, tracking replies in a sheet, chasing silence, filing PDFs, and re-checking classifications — roughly 10–15 minutes per vendor across a campaign. At 200 vendors, that\'s a working month.',
      'Automation turns the same campaign into an afternoon: import, send, and watch the tracker fill itself.',
    ],
    cta: { label: 'Run it in an afternoon', href: MSME } },

  { id: 'comp-notices-tracker', category: 'compliance', emoji: '📨',
    subject: 'Notices deserve better than a drawer',
    title: 'Track notices like the deadlines they are',
    body: [
      'A departmental notice is a deadline with teeth — yet in many firms it lives as a PDF in email and a worry in someone\'s head until the response date looms.',
      'Log every notice with its response-due date and owner, and the scariest category of work becomes just another tracked task — visible, assigned, and never suddenly urgent.',
    ],
    cta: { label: 'Log your open notices', href: `${APP}/clients` } },

  { id: 'prac-vacation-test', category: 'practice', emoji: '🏖️',
    subject: 'Can you take two weeks off?',
    title: 'The vacation test of firm maturity',
    body: [
      'Honest question: if you disappeared for a fortnight, what breaks? Whatever the answer, that\'s your bottleneck list — the knowledge and decisions that live only in you.',
      'Every task with an owner, every deadline visible, approvals flowing without you touching everything: that\'s not just software hygiene. It\'s the difference between owning a practice and being owned by one.',
    ],
    cta: { label: 'Start the untangling', href: `${APP}/monitor` } },

  { id: 'trend-tools-consolidate', category: 'trends', emoji: '🧩',
    subject: 'Tool fatigue is real. Consolidation is the cure.',
    title: 'Fewer tools, fewer cracks',
    body: [
      'A tracker here, a drive there, a chat somewhere else — every boundary between tools is a crack work falls through, plus another subscription and another password.',
      'The consolidation wave in professional software is about closing cracks: when tasks, documents, deadlines and the client view share one system, handoffs stop being risky.',
    ],
    cta: { label: 'Close the cracks', href: `${APP}/dashboard` } },

  { id: 'client-expectations-reset', category: 'clients', emoji: '🤝',
    subject: 'The kickoff sentence that prevents 90% of friction',
    title: 'Set the rhythm on day one',
    body: [
      '"Here\'s how we work: documents through your portal link, updates when things complete, and a monthly summary." One sentence at kickoff, and the 11 pm WhatsApp expectations never form.',
      'Clients don\'t resist structure — they resist structure introduced after habits have set. Day one is free; month six costs goodwill.',
    ],
    cta: { label: 'Start clients right', href: `${APP}/clients/new` } },

  // ── Cycle 13 ───────────────────────────────────────────────────────────────
  { id: 'feat-subtask-dates', category: 'feature', emoji: '🧩',
    subject: 'Big tasks, broken down and dated',
    title: 'Subtasks that carry their own weight',
    body: [
      'An audit isn\'t one task — it\'s a sequence with different owners and dates. upFloat subtasks each carry their own assignee, due date, and now the date they were added, so long engagements stay legible for months.',
      'Parents can even auto-complete when the last subtask closes. Structure without ceremony.',
    ],
    cta: { label: 'Break down a big task', href: `${APP}/tasks` } },

  { id: 'msme-audit-question', category: 'msme', emoji: '❓',
    subject: 'The one MSME question every auditor now asks',
    title: '"Show me the vendor-wise ageing"',
    body: [
      'Audit teams increasingly open with it: which creditors are Micro/Small, what\'s outstanding to each, and for how long. Businesses without vendor classification spend days constructing an answer that should be an export.',
      'Certificate-backed declarations plus outstanding amounts, collected once and maintained — that\'s the export. Be the firm whose clients answer in minutes.',
    ],
    cta: { label: 'Prepare the answer', href: MSME } },

  { id: 'comp-annual-calendar', category: 'compliance', emoji: '🗓️',
    subject: 'The whole year on one screen',
    title: 'Annual calendar: plan seasons, not weeks',
    body: [
      'Filing season crunch is only a surprise if you look at the year one week at a time. The annual compliance calendar shows every statutory date across all clients at once — the crunch weeks announce themselves months out.',
      'Staffing, leave planning, client expectations: all easier with the year visible.',
    ],
    cta: { label: 'See your year', href: `${APP}/compliance/annual-calendar` } },

  { id: 'prac-charge-for-speed', category: 'practice', emoji: '⚡',
    subject: 'Some clients will pay double for tomorrow',
    title: 'Urgency is a product tier',
    body: [
      'Every firm has clients who need it yesterday and clients who need it eventually. Serving both at one price means the urgent subsidise nothing and the patient overpay for calm.',
      'Firms with reliable turnaround data can sell express lanes honestly — because they actually know their standard speed.',
    ],
    cta: { label: 'Know your turnaround', href: `${APP}/reports` } },

  { id: 'trend-remote-staff', category: 'trends', emoji: '🌍',
    subject: 'Your next hire might be 800 km away',
    title: 'Remote articles and staff are now viable',
    body: [
      'Talent in smaller cities is skilled, motivated, and no longer required to relocate. Firms hiring remotely report better retention and costs — with one prerequisite: work must be visible without walking to a desk.',
      'Assigned queues, live status, document checklists — the same system that organises your office is what makes remote staff feel local.',
    ],
    cta: { label: 'Make work location-proof', href: `${APP}/team` } },

  { id: 'client-price-rise-grace', category: 'clients', emoji: '📈',
    subject: 'Raising fees without losing sleep',
    title: 'The fee-increase letter that keeps clients',
    body: [
      'A fee rise justified by "costs went up" invites bargaining. One backed by the record — filings completed, deadlines met, notices handled, hours invested — invites a nod.',
      'Firms that track work all year don\'t write fee letters. They attach evidence.',
    ],
    cta: { label: 'Gather the evidence', href: `${APP}/reports` } },

  // ── Cycle 14 ───────────────────────────────────────────────────────────────
  { id: 'feat-trash-recovery', category: 'feature', emoji: '🗑️',
    subject: 'Deleted ≠ destroyed',
    title: 'The trash can that saves careers',
    body: [
      'Someone will eventually delete the wrong client at 6 pm before a deadline. In upFloat, deletion is soft — thirty days in Trash, restorable in one click, before anything is truly gone.',
      'Design for humans, and Friday evenings get calmer.',
    ],
    cta: { label: 'Peek at your trash', href: `${APP}/settings/trash` } },

  { id: 'msme-medium-vs-small', category: 'msme', emoji: '📏',
    subject: 'Micro, Small, Medium: only two of three matter here',
    title: 'The classification detail 43B(h) turns on',
    body: [
      'The 45-day payment rule protects Micro and Small enterprises — Medium ones are outside it. Two vendors can both wave "MSME registered" certificates and carry entirely different consequences for your client.',
      'This is why declarations must capture the certificate\'s category, not just registration status. Yes/No isn\'t enough; Micro/Small/Medium is the actual question.',
    ],
    cta: { label: 'Capture categories properly', href: MSME } },

  { id: 'comp-freq-variety', category: 'compliance', emoji: '🎚️',
    subject: 'Second Fridays and last working days',
    title: 'Real deadlines are weirder than "monthly"',
    body: [
      'Statutory calendars are full of odd rhythms — specific weekdays, month-ends, bespoke annual dates. Systems that only speak "monthly" force you to remember the exceptions, which is exactly what systems are for.',
      'upFloat\'s frequency engine speaks the weird dialects: specific weekdays, multiple days a month, last-day rules, custom annual dates. If the law can schedule it, you can automate it.',
    ],
    cta: { label: 'Automate an odd schedule', href: `${APP}/recurring` } },

  { id: 'prac-one-metric', category: 'practice', emoji: '🎯',
    subject: 'If you track one number, track this',
    title: 'Zero overdue is a culture, not a KPI',
    body: [
      'Revenue lags decisions by months; overdue count reflects them today. A firm that holds "nothing overdue without an explanation" as a norm has, by construction, working systems, honest capacity, and calm clients.',
      'It\'s also refreshingly binary. The dashboard shows a number; the number should be zero; everyone can see it.',
    ],
    cta: { label: 'Check the number', href: `${APP}/dashboard` } },

  { id: 'trend-proactive-advisory', category: 'trends', emoji: '🧭',
    subject: 'Compliance keeps the client. Advice grows them.',
    title: 'The advisory shift starts with freed hours',
    body: [
      'Every firm wants to move "up the value chain" to advisory. The honest obstacle isn\'t skill — it\'s that compliance execution consumes the hours advisory would need.',
      'Automation isn\'t about doing compliance cheaper; it\'s about buying back the partner hours that advisory work — and advisory fees — require.',
    ],
    cta: { label: 'Buy back your hours', href: `${APP}/recurring` } },

  { id: 'client-silence-is-risk', category: 'clients', emoji: '🔕',
    subject: 'Your quietest client is your biggest risk',
    title: 'Silence isn\'t satisfaction',
    body: [
      'The client who never calls is either delighted or already interviewing your replacement — and from the inside, both look identical. Churn surprises are almost always "quiet" accounts.',
      'A client-health view that flags fading engagement turns that blind spot into a call list. One warm check-in beats a dozen win-back attempts.',
    ],
    cta: { label: 'See client health', href: `${APP}/clients/health` } },

  // ── Cycle 15 ───────────────────────────────────────────────────────────────
  { id: 'feat-org-switcher', category: 'feature', emoji: '🏢',
    subject: 'Two practices, one login',
    title: 'Multi-firm life, handled',
    body: [
      'Partner in one firm, consultant to another, running a side practice — multi-org professionals are common and most software pretends they aren\'t.',
      'upFloat\'s org switcher keeps each workspace fully separate — team, clients, billing — one click apart under a single login.',
    ],
    cta: { label: 'Switch workspaces', href: `${APP}/dashboard` } },

  { id: 'msme-declaration-renewal', category: 'msme', emoji: '🔄',
    subject: 'Declarations age. Renew them annually.',
    title: 'Last year\'s declaration is this year\'s question mark',
    body: [
      'Udyam classifications change on turnover and investment; registrations lapse; vendors restructure. A declaration collected eighteen months ago is a historical document, not current compliance support.',
      'The clean pattern: an annual refresh campaign at the start of each financial year. With automation, "annual campaign" means clicking send once.',
    ],
    cta: { label: 'Schedule the refresh', href: MSME } },

  { id: 'comp-client-owner-model', category: 'compliance', emoji: '👤',
    subject: 'Every client needs exactly one throat to choke',
    title: 'The client-owner model',
    body: [
      'When five people serve a client and nobody owns them, questions bounce, threads die, and "I thought you replied" becomes a genre. Ownership isn\'t doing all the work — it\'s being the one who always knows the state.',
      'Assign a responsible team member to every client and route their compliance through that lens. Accountability sharpens instantly.',
    ],
    cta: { label: 'Assign client owners', href: `${APP}/clients` } },

  { id: 'prac-meeting-hygiene', category: 'practice', emoji: '📝',
    subject: 'The meeting that should have been a task',
    title: 'Decide in meetings. Track in systems.',
    body: [
      'Internal meetings bloat when they double as status updates — thirty minutes of reciting what a dashboard already shows. If status is visible beforehand, meetings shrink to actual decisions.',
      'Rule of thumb: if it ends without new tasks assigned, it was a broadcast, and broadcasts can be a link.',
    ],
    cta: { label: 'Replace status meetings', href: `${APP}/monitor` } },

  { id: 'trend-first-mover-network', category: 'trends', emoji: '🕸️',
    subject: 'Be the firm other CAs ask about',
    title: 'Early adopters become the reference point',
    body: [
      'In every CA circle there\'s one firm others quietly watch — first with new tooling, first with answers when rules change. That position compounds: referrals flow toward whoever seems ahead.',
      'Being six months early on the tools your peers will eventually adopt is one of the cheapest reputations available.',
    ],
    cta: { label: 'Stay ahead of the circle', href: APP } },

  { id: 'client-scope-of-magic', category: 'clients', emoji: '🎩',
    subject: 'Let clients see the machinery (a little)',
    title: 'Competence should be slightly visible',
    body: [
      'Total invisibility ("it just gets done") reads as easy — and easy invites fee pressure. A glimpse of machinery — the portal, the checklist, the timeline — lets clients sense the system working for them.',
      'You\'re not showing off. You\'re letting the value be witnessed instead of assumed.',
    ],
    cta: { label: 'Open the curtain', href: `${APP}/clients` } },

  // ── Cycle 16 ───────────────────────────────────────────────────────────────
  { id: 'feat-reports-export', category: 'feature', emoji: '📊',
    subject: 'From board to boardroom in one click',
    title: 'Exports that respect your filters',
    body: [
      'Filter the view to exactly what the meeting needs — one client, one quarter, one team member — and export precisely that to Excel. No dumping everything and pruning in spreadsheets.',
      'Partner reviews, client summaries, audit responses: cut the view, ship the file.',
    ],
    cta: { label: 'Export a filtered view', href: `${APP}/reports` } },

  { id: 'msme-email-that-converts', category: 'msme', emoji: '✉️',
    subject: 'Why vendors answer some emails and not others',
    title: 'Anatomy of a declaration email that works',
    body: [
      'Vendors respond when three things are true: the sender is recognisable (your client\'s name, not a platform), the ask is one question with buttons, and the benefit is theirs ("protect your payment rights"), not yours.',
      'upFloat\'s vendor emails are built on exactly that anatomy — which is why campaigns convert where forwarded PDFs died.',
    ],
    cta: { label: 'Send emails that convert', href: MSME } },

  { id: 'comp-two-firm-merge', category: 'compliance', emoji: '🤝',
    subject: 'Merging practices? Merge the systems first.',
    title: 'The unglamorous secret of smooth mergers',
    body: [
      'Practice mergers stumble on operations, not valuations — two ways of tracking work, two filing conventions, clients feeling the seams. The merged firm that decides its one system early looks integrated by month two.',
      'A neutral, shared platform where both legacy teams see the same board beats either firm\'s old spreadsheet religion.',
    ],
    cta: { label: 'Give the merged firm one board', href: `${APP}/team` } },

  { id: 'prac-protect-maker-time', category: 'practice', emoji: '🎧',
    subject: 'Deep work needs a bodyguard',
    title: 'Protect the hours that produce',
    body: [
      'Complex assessments and audit judgement need unbroken hours — the exact thing an interrupt-driven office never provides. The fix isn\'t heroic focus; it\'s a system that absorbs interruptions.',
      'When "can you check…" becomes a task instead of a shoulder tap, the checker finishes their thought and the request still gets its answer — just not at concentration\'s expense.',
    ],
    cta: { label: 'Absorb the interruptions', href: `${APP}/inbox` } },

  { id: 'trend-generational-handover', category: 'trends', emoji: '🌱',
    subject: 'The next generation won\'t inherit your filing cabinet',
    title: 'Succession is a systems question',
    body: [
      'Practices pass to the next generation — children, junior partners, buyers. What transfers value isn\'t the furniture; it\'s clients plus the machine that serves them. A practice that runs on one person\'s memory is worth exactly one person\'s memory.',
      'Documented, systematised operations are what make a practice sellable, inheritable, and durable.',
    ],
    cta: { label: 'Build the transferable machine', href: APP } },

  { id: 'client-anniversary-numbers', category: 'clients', emoji: '🎂',
    subject: 'Celebrate clients with their own numbers',
    title: 'The anniversary note with substance',
    body: [
      '"Three years together: 41 filings, zero missed deadlines, 96 documents archived and retrievable." That\'s an anniversary message that doubles as a retention argument.',
      'Sentiment plus statistics — only possible if the statistics exist somewhere.',
    ],
    cta: { label: 'Find your numbers', href: `${APP}/reports` } },

  // ── Cycle 17 ───────────────────────────────────────────────────────────────
  { id: 'feat-billable-flag', category: 'feature', emoji: '💵',
    subject: 'Flag it billable the moment you do it',
    title: 'Revenue leaks close at the source',
    body: [
      'Unbilled work rarely dies dramatically — it evaporates, one forgotten "small favour" at a time. The only reliable capture point is the moment of doing.',
      'A billable toggle on every task, an amount if you know it, and month-end invoicing becomes reading a list instead of reconstructing a month.',
    ],
    cta: { label: 'Stop the evaporation', href: `${APP}/invoices` } },

  { id: 'msme-start-free', category: 'msme', emoji: '🆓',
    subject: 'Test the MSME tracker on five vendors. Free.',
    title: 'Prove it before you propose it',
    body: [
      'The free tier exists so you can run a real mini-campaign — five vendors, real emails, real declarations — before recommending it to a single client.',
      'Most partners run the pilot on their own firm\'s vendors first. Twenty minutes later they know exactly how the client conversation goes.',
    ],
    cta: { label: 'Run the five-vendor pilot', href: MSME } },

  { id: 'comp-history-per-client', category: 'compliance', emoji: '📚',
    subject: '"What did we file for them last year?"',
    title: 'Client history at conversation speed',
    body: [
      'The question comes mid-call and the answer should not be "let me dig." Every client\'s full task and filing history in one view means precedent, dates and documents surface while the client is still on the line.',
      'Institutional memory, minus the institution-sized effort.',
    ],
    cta: { label: 'Open a client history', href: `${APP}/clients` } },

  { id: 'prac-error-postmortem', category: 'practice', emoji: '🔬',
    subject: 'When something slips, blame the system',
    title: 'Post-mortems without finger-pointing',
    body: [
      'A missed deadline has two possible responses: find who to scold, or find what to fix. The first teaches people to hide problems; the second teaches the system not to repeat them.',
      'With a task trail, the "what" is usually visible in minutes — no owner assigned, buffer too thin, approval bottleneck. Fix the pattern, thank the messenger.',
    ],
    cta: { label: 'Review with the trail', href: `${APP}/activity` } },

  { id: 'trend-trust-infrastructure', category: 'trends', emoji: '🏛️',
    subject: 'Trust is becoming infrastructure',
    title: 'The profession\'s core asset, systematised',
    body: [
      'A CA\'s product has always been trust. What\'s changing is how trust is evidenced — less "take my word," more timestamps, trails and client-visible status. The signature still matters; the system behind it increasingly co-signs.',
      'Firms building that evidence layer now are compounding an asset competitors will struggle to retrofit.',
    ],
    cta: { label: 'Build the evidence layer', href: APP } },

  { id: 'client-teach-once', category: 'clients', emoji: '🎓',
    subject: 'Teach clients your system exactly once',
    title: 'One orientation, years of smoothness',
    body: [
      'Ten minutes at onboarding — "here\'s your portal, here\'s where documents go, here\'s what our updates look like" — prevents a hundred micro-confusions later. Clients follow systems they\'ve been shown; they fight systems they discover by accident.',
      'Make the orientation part of your kickoff checklist and it never gets skipped.',
    ],
    cta: { label: 'Add it to onboarding', href: `${APP}/clients/new` } },
]

/** Stable ordered list of template ids (send order = catalogue order). */
export const ENGAGEMENT_ORDER = ENGAGEMENT_ITEMS.map(i => i.id)

export function getEngagementItem(id: string): EngagementItem | undefined {
  return ENGAGEMENT_ITEMS.find(i => i.id === id)
}
