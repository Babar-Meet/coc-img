import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

console.log('Scanning repository git log for image dates...')

const rawLog = execSync(
  'git log --name-status --format="COMMIT:%cI"',
  { cwd: repoRoot, encoding: 'utf-8', maxBuffer: 30 * 1024 * 1024 }
)

const fileDates = {}
let currentDate = null

for (const rawLine of rawLog.split('\n')) {
  const line = rawLine.trim()
  if (line.startsWith('COMMIT:')) {
    currentDate = line.replace('COMMIT:', '').trim()
  } else if (line && currentDate) {
    const parts = line.split('\t')
    const filePath = parts[parts.length - 1]?.trim().replace(/^"|"$/g, '')
    if (filePath && /\.(webp|png|jpg|jpeg|gif)$/i.test(filePath)) {
      if (!fileDates[filePath]) {
        fileDates[filePath] = currentDate
      }
    }
  }
}

const metadataFile = path.join(repoRoot, 'assets-metadata.json')
let existing = { notes: {}, categories: [], updatedAt: new Date().toISOString() }
if (fs.existsSync(metadataFile)) {
  try {
    existing = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'))
  } catch (e) {
    console.error('Error reading existing metadata:', e)
  }
}

const notes = existing.notes || {}
const items = {}

// Find all current git tracked images
const tracked = execSync('git ls-files "*.webp" "*.png" "*.jpg"', {
  cwd: repoRoot,
  encoding: 'utf-8',
})
  .split('\n')
  .map(s => s.trim())
  .filter(Boolean)

for (const p of tracked) {
  // skip studio/ internal assets
  if (p.startsWith('studio/')) continue

  const date = fileDates[p] || new Date().toISOString()
  const existingNote = notes[p] || {}
  items[p] = {
    path: p,
    addedAt: existingNote.addedAt || date,
    updatedAt: existingNote.updatedAt || date,
    note: existingNote.note || '',
    tags: existingNote.tags || [],
  }
}

const finalMetadata = {
  version: 1,
  updatedAt: new Date().toISOString(),
  categories: existing.categories || [],
  items,
}

fs.writeFileSync(metadataFile, JSON.stringify(finalMetadata, null, 2), 'utf-8')
console.log(`Generated assets-metadata.json with ${Object.keys(items).length} images.`)
