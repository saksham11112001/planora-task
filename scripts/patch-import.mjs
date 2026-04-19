import fs from 'fs'

let src = fs.readFileSync('app/api/import/route.ts', 'utf8')

// Fix batch insert error messages (raw DB errors pushed into results arrays)
src = src.replace(
  /results\.(\w+)\.errors\.push\(`Batch insert error: \$\{error\.message\}`\)/g,
  "results.$1.errors.push('Some rows could not be saved. Please check the data format and try again.')"
)
src = src.replace(
  /results\.clients\.errors\.push\(`Batch error: \$\{error\.message\}`\)/g,
  "results.clients.errors.push('Some clients could not be imported. Please check for duplicates or invalid data.')"
)
src = src.replace(
  /results\.projects\.errors\.push\(`"\$\{name\}": \$\{error\.message\}`\)/g,
  "results.projects.errors.push(`\"${name}\": Could not save this project. Check for duplicates and try again.`)"
)
// Member invitation failure — don't expose Supabase auth error
src = src.replace(
  /results\.members\.errors\.push\(`\$\{email\}: \$\{invErr\.message\}`\)/g,
  "results.members.errors.push(`${email}: Invitation failed. Check the email address and try again.`)"
)
// Compliance flush failures
src = src.replace(
  /results\.onetasks\.errors\.push\(`Failed to save compliance assignments to database: \$\{oneTimeFlushErr\}`\)/g,
  "results.onetasks.errors.push('Some compliance assignments could not be saved. Please try again.')"
)
src = src.replace(
  /results\.compliance\.errors\.push\(`Failed to save compliance assignments to database: \$\{caFlushErr\}`\)/g,
  "results.compliance.errors.push('Some compliance assignments could not be saved. Please try again.')"
)
// Top-level catch
src = src.replace(
  /error\s*:\s*e\?\.message \|\| 'Import failed unexpectedly'/g,
  "error: 'Import failed unexpectedly. Please try again or contact support if the problem persists.'"
)
// File parse error
src = src.replace(
  `{ error: 'Could not parse file: ' + (e?.message ?? 'unknown') }`,
  `{ error: 'Could not read the file. Please make sure it is a valid Excel (.xlsx) file.' }`
)
// flushCaLinks internal return — replace raw message return with friendly string
src = src.replace(
  /console\.error\('\[import\] flushCaLinks upsert failed:', error\.message\)\s*\n\s*return error\.message/,
  "console.error('[import] flushCaLinks upsert failed:', error.message)\n        return 'Failed to save compliance links'"
)

fs.writeFileSync('app/api/import/route.ts', src)
console.log('import route patched')
