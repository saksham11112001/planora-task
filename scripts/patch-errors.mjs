import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API_DIR = path.join(__dirname, '..', 'app', 'api')

function walkDir(dir) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walkDir(full))
    else if (entry.name === 'route.ts') files.push(full)
  }
  return files
}

const IMPORT_LINE = "import { dbError } from '@/lib/api-error'"

const routes = walkDir(API_DIR)
let patched = 0

for (const file of routes) {
  let src = fs.readFileSync(file, 'utf8')
  const orig = src

  // Derive a short context tag from the file path
  const rel = file.replace(/\\/g, '/').split('app/api/')[1].replace('/route.ts', '')

  // Replace: NextResponse.json({ error: ANYVAR.message }, { status: 500 })
  // This covers error, err, e, dbErr, updateErr, insertErr, etc.
  src = src.replace(
    /NextResponse\.json\(\s*\{\s*error\s*:\s*([\w.]+?)\.message\s*\}\s*,\s*\{\s*status\s*:\s*500\s*\}\s*\)/g,
    (_, v) => `NextResponse.json(dbError(${v}, '${rel}'), { status: 500 })`
  )

  // Replace string concatenation with .message:
  // { error: 'Some prefix: ' + errVar.message }
  src = src.replace(
    /NextResponse\.json\(\s*\{\s*error\s*:\s*`[^`]*\$\{([\w.]+?)\.message\}[^`]*`\s*\}\s*,\s*\{\s*status\s*:\s*500\s*\}\s*\)/g,
    (_, v) => `NextResponse.json(dbError(${v}, '${rel}'), { status: 500 })`
  )
  src = src.replace(
    /NextResponse\.json\(\s*\{\s*error\s*:\s*'[^']*'\s*\+\s*([\w.]+?)\.message\s*\}\s*,\s*\{\s*status\s*:\s*500\s*\}\s*\)/g,
    (_, v) => `NextResponse.json(dbError(${v}, '${rel}'), { status: 500 })`
  )
  src = src.replace(
    /NextResponse\.json\(\s*\{\s*error\s*:\s*"[^"]*"\s*\+\s*([\w.]+?)\.message\s*\}\s*,\s*\{\s*status\s*:\s*500\s*\}\s*\)/g,
    (_, v) => `NextResponse.json(dbError(${v}, '${rel}'), { status: 500 })`
  )

  // Also replace ?? 'Unknown error' / ?? 'Unexpected error' patterns that still expose err.message:
  // { error: err?.message ?? 'Unknown error' }
  src = src.replace(
    /NextResponse\.json\(\s*\{\s*error\s*:\s*([\w.]+?)\?\.message\s*\?\?\s*['"][^'"]*['"]\s*\}\s*,\s*\{\s*status\s*:\s*500\s*\}\s*\)/g,
    (_, v) => `NextResponse.json(dbError(${v}, '${rel}'), { status: 500 })`
  )

  if (src !== orig) {
    // Add import if not already there
    if (!src.includes("from '@/lib/api-error'")) {
      // Insert after the last contiguous import block at the top
      src = src.replace(/^((?:import [^\n]+\n)+)/, (block) => block + IMPORT_LINE + '\n')
      if (!src.includes("from '@/lib/api-error'")) {
        src = IMPORT_LINE + '\n' + src
      }
    }
    fs.writeFileSync(file, src)
    patched++
    console.log('PATCHED:', rel)
  }
}

console.log(`\nDone — patched ${patched} of ${routes.length} route files.`)
