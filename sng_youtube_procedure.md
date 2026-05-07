# YouTube Video Procedure
### For Mute Screen Recordings + AI Voiceover
### Covers: 45-min Tutorial + 10-12 Separate Short Videos

---

## YOUR TWO VIDEO TYPES

| Type | What it is | Chapters/Videos | Output |
|------|-----------|-----------------|--------|
| **Type A** | 45-min full walkthrough → cut into 12 chapters | 12 chapter videos (3–8 min each) | 12 YouTube videos + 12 Shorts |
| **Type B** | 10–12 separate recordings (4–5 min each) | Each is already one complete video | 10–12 YouTube videos + 10–12 Shorts |

The procedure below works for both. Type B is just simpler — no cutting step needed.

---

## TOOLS YOU NEED (all free)

| Tool | Purpose | Where |
|------|---------|-------|
| OBS Studio | Record screen (mute) | obsproject.com |
| Clipchamp | Cut + merge audio | Built into Windows 11 (search Start) |
| ElevenLabs | Generate AI voiceover from script | elevenlabs.io |
| Canva (free) | Thumbnail creation | canva.com |
| YouTube Studio | Upload + optimise | studio.youtube.com |

---

---

# PART 1 — TYPE A: 45-MINUTE TUTORIAL

## STEP 1 — Record the Screen (Once, Mute)

**Before hitting record:**
- [ ] Log in as Owner account — full permissions visible
- [ ] Have 8–10 clients, 3–4 projects, 15–20 tasks in various stages loaded
- [ ] Browser zoom: 100% | Resolution: 1920×1080
- [ ] Turn on Do Not Disturb — no notifications
- [ ] Close all unnecessary tabs
- [ ] Clean browser profile — no visible extensions

**OBS Settings:**
1. Output tab → Format: MP4 | Resolution: 1920×1080 | FPS: 30
2. Audio: turn OFF all audio sources (mic and desktop) — you want pure mute
3. Record full display (not window capture)

**While recording:**
- Move mouse SLOWLY — 2-second pause after every major click
- Follow the demo script chapter by chapter
- If you make a mistake: pause, fix it, continue — you can cut it later
- Keep sidebar always visible so viewers know where they are
- Glance at clock when each chapter starts — note the approximate time

**After recording:**
- Save file immediately (will be 2–4 GB)
- Watch back and write down exact timestamps for each chapter start and end

**Timestamp table to fill:**

| Chapter | Start Time | End Time | Notes |
|---------|-----------|---------|-------|
| Ch 1 — Dashboard | | | |
| Ch 2 — My Tasks/Kanban | | | |
| Ch 3 — Inbox | | | |
| Ch 4 — Recurring Tasks | | | |
| Ch 5 — Projects | | | |
| Ch 6 — Clients | | | |
| Ch 7 — CA Compliance | | | |
| Ch 8 — Invoicing | | | |
| Ch 9 — Approvals + Monitor | | | |
| Ch 10 — Calendar | | | |
| Ch 11 — Settings | | | |
| Ch 12 — Closing | | | |

---

## STEP 2 — Cut Into 12 Chapter Videos (Clipchamp)

**Do all chapters in one Clipchamp session:**

1. Open **Clipchamp** (Windows Start → search Clipchamp)
2. Click **New video**
3. **Import** your OBS recording (drag into the media panel)
4. Drag the video onto the timeline

**For EACH chapter:**
1. Look at your timestamp table — find the chapter start time
2. Move the playhead to that exact timestamp
3. Press **S** or click the scissor icon → **Split**
4. Move playhead to the chapter end time → Split again
5. You now have the chapter as a standalone clip
6. Click the clip → right click → **Export** → name it `ch01_dashboard_mute.mp4`
7. Settings: 1080p, MP4
8. Repeat for all 12 chapters

> **Tip:** Export all 12 in one session. Do it overnight if needed — each export takes 2–5 minutes.

---

## STEP 3 — Generate Voiceover Per Chapter (ElevenLabs)

**Setup (once):**
1. Go to **elevenlabs.io** → Create free account
2. Click **Text to Speech** in left sidebar
3. Click the settings sliders icon
4. Set: Stability **65** | Similarity Boost **80** | Style **30** | Speed **0.95**
5. Pick voice: **Daniel** (British, calm, professional)

**For each chapter:**
1. Open your script doc (the `floatup_demo_script.md` file)
2. Find the 🎙️ NARRATION block for that chapter
3. Copy the entire narration text
4. Paste it into ElevenLabs text box
5. Click **Generate**
6. Click **Download** → save as `ch01_voiceover.mp3`
7. Repeat for all 12 chapters

**Free tier limit:** 10,000 characters ≈ Chapters 1–8
**For Chapters 9–12:** Create a second free ElevenLabs account with a different email

---

## STEP 4 — Merge Audio + Video Per Chapter (Clipchamp)

**For EACH chapter (takes 5–7 minutes each):**

1. Open Clipchamp → New video
2. Import **both** files: the chapter video (`ch01_dashboard_mute.mp4`) and voiceover (`ch01_voiceover.mp3`)
3. Drag the **video** to the main timeline (top track)
4. Drag the **MP3** to the audio track below
5. **Mute the video track**: click video clip → Audio icon → drag volume to 0%
6. **Check length**: the voiceover is usually different length than video
   - If voiceover is LONGER than video: stretch video (right edge of clip → drag right) to match audio length
   - If voiceover is SHORTER than video: trim video end to match audio (drag left edge from right)
7. Play back 20 seconds to confirm sync is correct
8. Click **Export** → 1080p → MP4
9. Name: `ch01_dashboard_FINAL.mp4`
10. Repeat for all 12 chapters

---

## STEP 5 — Extract the Short/Reel Clip (Clipchamp)

Each chapter has one best 30–60 second moment. This becomes your YouTube Short and Instagram Reel.

**Which moment to extract (by chapter):**

| Chapter | Best Short Clip |
|---------|----------------|
| Ch 1 | Dashboard loading + sidebar hover (the first impression) |
| Ch 2 | Dragging a task from To Do → In Progress |
| Ch 3 | Creating a quick task in under 10 seconds |
| Ch 4 | Setting recurring frequency → next occurrence date appearing |
| Ch 5 | Project progress bar + task list view |
| Ch 6 | Typing in search bar → instant client filter |
| Ch 7 | Load Defaults → 2-step picker → Spawn Tasks (most visual, most impressive) |
| Ch 8 | GSTIN auto-filling when client selected |
| Ch 9 | Approve task → status updates instantly |
| Ch 10 | Switching between compliance / project / all calendar filters |
| Ch 11 | Invite team member in under 10 seconds |
| Ch 12 | Use entire chapter — it's already 1 minute |

**Steps to extract the Short:**
1. Open the FINAL merged chapter video in Clipchamp
2. Find the best 30–60 second moment (use timestamp from your notes)
3. Split before and after → keep only that clip
4. **Change canvas ratio**: click the video → Properties → Aspect Ratio → **9:16 (vertical)**
5. Reposition: drag the video within the frame to show the important part (usually centre)
6. Add text overlay (optional but recommended):
   - Click **Text** → Add a title
   - Type a hook: e.g. "Watch this in 30 seconds 👇" or the chapter topic
   - Place at the top of screen, large, white with dark shadow
7. Export → 1080×1920 (vertical) → MP4
8. Name: `ch07_compliance_SHORT.mp4`

---

## STEP 6 — Create Thumbnail (Canva, 12 minutes)

**Do all 12 in one Canva session:**

1. Go to **canva.com** → New design → Search "YouTube Thumbnail" → 1280×720px
2. Pick any dark template OR start blank
3. Set background: dark navy `#1A1A2E`
4. Add elements:
   - **Screenshot** from the chapter: take a screenshot of your most impressive UI moment from that chapter
   - **Bold text** (3–5 words): the chapter headline (see list below)
   - **Orange accent** `#FF6B35`: colour-highlight the key word
   - **Floatup logo**: bottom-right corner, small
5. Export as JPG → name `ch01_thumbnail.jpg`
6. Duplicate the design and change text/screenshot for each chapter

**Thumbnail text per chapter:**

| Chapter | Thumbnail Text |
|---------|---------------|
| Ch 1 | EVERYTHING IN ONE DASHBOARD |
| Ch 2 | ZERO TASKS MISSED |
| Ch 3 | QUICK TASKS IN SECONDS |
| Ch 4 | SET ONCE. RUNS FOREVER. |
| Ch 5 | ALL PROJECTS. ONE VIEW. |
| Ch 6 | 50 CLIENTS. ZERO CHAOS. |
| Ch 7 | ALL COMPLIANCE. AUTOMATED. |
| Ch 8 | INVOICE IN 30 SECONDS |
| Ch 9 | APPROVE IN 2 CLICKS |
| Ch 10 | EVERY DEADLINE. ONE CALENDAR. |
| Ch 11 | INVITE YOUR TEAM IN 10 SECONDS |
| Ch 12 | START YOUR FREE TRIAL |

---

## STEP 7 — Upload to YouTube

**For each chapter video:**

1. Go to **studio.youtube.com** → Upload video
2. Select your `ch01_dashboard_FINAL.mp4`
3. Fill in:

**Title** (copy and customise):
```
[Feature Name] for CA Firms — Floatup Complete Guide 2026
```
Examples:
- `CA Compliance Tracking for Accounting Firms — Floatup Demo 2026`
- `Task Management Dashboard for CAs — Floatup Full Walkthrough`

**Description** (paste this template, fill the caps):
```
In this video I walk through [CHAPTER TOPIC] inside Floatup — a task management and 
CA compliance platform built specifically for accounting professionals.

🕐 TIMESTAMPS:
0:00 — [Section 1]
[add more as needed]

👉 Try Floatup free: https://floatup.app

Floatup is a task management, compliance tracking, and client operations platform 
for CA practices, CPA firms, and professional services teams.

COVERS IN THIS VIDEO:
→ [Key point 1]
→ [Key point 2]
→ [Key point 3]

🔔 Subscribe for weekly CA practice management tutorials.

#Floatup #CACompliance #TaskManagement #CharteredAccountant #CAPractice 
#GSTFiling #TDSCompliance #AccountingTools #PracticeManagement #CPASoftware
```

4. **Thumbnail**: Upload the `ch01_thumbnail.jpg`
5. **Playlist**: Add to "Floatup Full Demo Series"
6. **End screen**: Add "Subscribe" button + next video in series
7. **Cards**: Add a card at the halfway point linking to floatup.app
8. Click **Schedule** (not Publish immediately) → set to Tuesday 10 AM

**For the Short:**
1. Upload `ch01_compliance_SHORT.mp4` separately
2. Title: `[Topic] in 60 seconds — Floatup #Shorts`
3. Description: same as main video but shorter
4. Schedule for Friday 10 AM of the same week

---
---

# PART 2 — TYPE B: 10–12 SEPARATE SHORT VIDEOS

These are your 4–5 minute focused videos — one topic per video. Much simpler process.

## Which Videos to Make

| Video # | Topic | Script Section to Use |
|---------|-------|----------------------|
| 1 | CA Compliance Module — full walkthrough | Ch 7 narration (expand it) |
| 2 | Kanban board for CA task management | Ch 2 narration |
| 3 | Client portal — no more WhatsApp chasing | Ch 6 narration + portal section of Ch 7 |
| 4 | Recurring tasks — set it once | Ch 4 narration |
| 5 | How to onboard a new client in Floatup | Create new script — just record the flow |
| 6 | Team roles and permissions explained | Ch 11 narration |
| 7 | Approvals workflow for CA seniors | Ch 9 narration |
| 8 | Calendar view — never miss a deadline | Ch 10 narration |
| 9 | Invoicing inside Floatup | Ch 8 narration |
| 10 | Dashboard overview — 5-minute tour | Ch 1 narration |
| 11 | Projects — group your client work | Ch 5 narration |
| 12 | Floatup vs Excel — real comparison | Write new script — show both side by side |

---

## STEP-BY-STEP FOR EACH SHORT VIDEO

### Step 1 — Record (5 minutes of recording)
- Same OBS settings as above
- Follow only the relevant chapter section
- Move slowly, pause after each action
- No audio — pure screen recording

### Step 2 — Write/Confirm Voiceover Script
- Use the existing narration block from `floatup_demo_script.md`
- For new topics (Videos 5, 12 above): write a script of 350–500 words (ElevenLabs will read it in 3–4 minutes)
- Script structure: **Hook → Problem → Feature demo → Benefit → CTA**

### Step 3 — Generate Voiceover (ElevenLabs)
- Same settings: Daniel voice, Stability 65, Similarity 80, Speed 0.95
- Paste full script → Generate → Download MP3

### Step 4 — Merge in Clipchamp
- Same as Type A Step 4 above
- These are shorter so the sync is easier — video and audio should roughly match already

### Step 5 — Extract Short (30–45 sec)
- Find the most visual/impressive moment in the video
- For feature demo videos: the actual feature working live is the Short clip
- Crop to 9:16 vertical → add text hook → export

### Step 6 — Thumbnail
- Same Canva process
- The short videos have focused topics so the thumbnail text is easier to write

### Step 7 — Upload
- Same YouTube upload process
- Title formula: `[Feature Name] — How [Target] [Benefit] with Floatup`
- Example: `How CA Firms Track GST Deadlines Without Excel — Floatup`

---

## UPLOAD CALENDAR — Both Types Combined

| Week | Tuesday Upload | Friday Short |
|------|---------------|-------------|
| 1 | Type A Ch 7 — CA Compliance Module ⭐ | Ch 7 Short — Load defaults flow |
| 2 | Type B Video 3 — Client Portal | Type A Ch 2 Short — Drag task |
| 3 | Type A Ch 2 — Kanban Board | Type B Video 1 Short — Compliance |
| 4 | Type B Video 5 — Onboard New Client | Type A Ch 6 Short — Search filter |
| 5 | Type A Ch 6 — Clients Database | Type B Video 3 Short — Portal |
| 6 | Type B Video 1 — Compliance Full | Type A Ch 4 Short — Recurring |
| 7 | Type A Ch 4 — Recurring Tasks | Type B Video 12 Short — vs Excel |
| 8 | Type B Video 12 — vs Excel | Type A Ch 8 Short — GSTIN auto-fill |
| 9 | Type A Ch 8 — Invoicing | Type B Video 2 Short — Kanban |
| 10 | Type B Video 2 — Kanban Details | Type A Ch 9 Short — Approve task |
| 11 | Type A Ch 9 — Approvals | Type B Video 6 Short — Roles |
| 12 | Type B Video 6 — Team Roles | Type A Ch 10 Short — Calendar |

> ⭐ Always lead with the Compliance Module — it's your strongest, most differentiated feature and gets the most search traffic.

---

## TIME ESTIMATE PER VIDEO

| Step | Type A (per chapter) | Type B (per video) |
|------|---------------------|-------------------|
| Recording | Already done (one session) | 10–15 min |
| Cutting (Type A only) | 5 min | — |
| Voiceover generation | 3 min | 3 min |
| Merge audio + video | 7 min | 7 min |
| Extract Short clip | 5 min | 5 min |
| Thumbnail | 10 min | 10 min |
| YouTube upload + details | 5 min | 5 min |
| **Total per video** | **~35 min** | **~40 min** |

**Batch everything:** Do all 12 voiceovers in one ElevenLabs session, all 12 thumbnails in one Canva session, all 12 uploads in one YouTube Studio session. This cuts total time by 40%.

---

## QUICK REFERENCE — SETTINGS CHEAT SHEET

| Setting | Value |
|---------|-------|
| OBS record format | MP4, 1920×1080, 30fps, no audio |
| ElevenLabs voice | Daniel |
| ElevenLabs stability | 65 |
| ElevenLabs similarity | 80 |
| ElevenLabs style | 30 |
| ElevenLabs speed | 0.95 |
| Clipchamp export | 1080p, MP4 |
| Short aspect ratio | 9:16, 1080×1920 |
| Thumbnail size | 1280×720 JPG |
| YouTube upload day | Tuesday 10 AM |
| YouTube Short day | Friday 10 AM |
| LinkedIn video post | Same as Short clip but 16:9, uploaded natively |
