#!/usr/bin/env node
/**
 * Reads the checkboxes in PLAN.md and rewrites the progress block in WORKLOG.md
 * between the <!-- PROGRESS:START --> and <!-- PROGRESS:END --> markers.
 *
 *   node scripts/progress.mjs          rewrite WORKLOG.md
 *   node scripts/progress.mjs --check  print only, exit 1 if WORKLOG is stale
 *
 * Never hand-edit between the markers.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const PLAN = join(root, 'PLAN.md')
const LOG = join(root, 'WORKLOG.md')
const WIDTH = 30

const PHASE_NAMES = {
  0: 'Human setup',
  1: 'Foundation',
  2: 'Auth & shell',
  3: 'Catalog',
  4: 'Companies & research',
  5: 'AI research pack',
  6: 'Decision-makers',
  7: 'Drafting & review',
  8: 'Gmail connector',
  9: 'Replies & triage',
  10: 'Meetings & pipeline',
  11: 'Control surfaces',
  12: 'Tests, docs, deploy',
}

const plan = readFileSync(PLAN, 'utf8')
const tasks = [...plan.matchAll(/^- \[([ xX])\]\s+T(\d+)\.(\d+)\b/gm)].map((m) => ({
  done: m[1].toLowerCase() === 'x',
  phase: Number(m[2]),
  n: Number(m[3]),
}))

if (tasks.length === 0) {
  console.error('progress: no tasks found in PLAN.md — is the checkbox format intact?')
  process.exit(1)
}

const done = tasks.filter((t) => t.done).length
const total = tasks.length
const pct = Math.round((done / total) * 100)
const filled = Math.round((done / total) * WIDTH)
const bar = '█'.repeat(filled) + '░'.repeat(WIDTH - filled)

const phases = new Map()
for (const t of tasks) {
  const p = phases.get(t.phase) ?? { done: 0, total: 0 }
  p.total += 1
  if (t.done) p.done += 1
  phases.set(t.phase, p)
}

const rows = [...phases.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([id, p]) => {
    const flag = p.done === p.total ? ' ✓' : ''
    return `| ${id} · ${PHASE_NAMES[id] ?? 'Phase ' + id} | ${p.done} | ${p.total}${flag} |`
  })

const block = [
  '<!-- PROGRESS:START -->',
  `\`${bar}\` **${pct}%** — ${done} of ${total} tasks complete`,
  '',
  '| Phase | Done | Total |',
  '|---|---|---|',
  ...rows,
  '<!-- PROGRESS:END -->',
].join('\n')

const log = readFileSync(LOG, 'utf8')
const re = /<!-- PROGRESS:START -->[\s\S]*?<!-- PROGRESS:END -->/
if (!re.test(log)) {
  console.error('progress: markers missing from WORKLOG.md — restore them and rerun')
  process.exit(1)
}

const next = log.replace(re, block)

if (process.argv.includes('--check')) {
  console.log(`${bar} ${pct}%  (${done}/${total})`)
  if (next !== log) {
    console.error('progress: WORKLOG.md is stale — run `npm run progress`')
    process.exit(1)
  }
  process.exit(0)
}

writeFileSync(LOG, next)
console.log(`progress: ${bar} ${pct}%  (${done}/${total}) — WORKLOG.md updated`)

const nextTask = tasks.find((t) => !t.done)
if (nextTask) console.log(`next: T${nextTask.phase}.${nextTask.n}`)
else console.log('all tasks complete')
