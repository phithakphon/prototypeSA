import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { openDb } from './db.js'

const dir = join(dirname(fileURLToPath(import.meta.url)), 'migrations')

export function migrate(db) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))",
  )
  const done = new Set(db.prepare('SELECT name FROM schema_migrations').all().map((r) => r.name))
  const applied = []
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue
    db.exec('BEGIN')
    try {
      db.exec(readFileSync(join(dir, file), 'utf8'))
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
    applied.push(file)
  }
  return applied
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = openDb(process.env.DB_PATH || './data/app.db')
  const applied = migrate(db)
  console.log(applied.length ? `migrate แล้ว: ${applied.join(', ')}` : 'ฐานข้อมูลเป็นปัจจุบันแล้ว')
}
