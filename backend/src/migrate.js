import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { loadConfig } from './config.js'
import { createDb } from './db.js'

const dir = join(dirname(fileURLToPath(import.meta.url)), 'migrations')
const files = () => readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()

const ENSURE_TABLE =
  'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())'

export async function pendingMigrations(db) {
  await db.exec(ENSURE_TABLE)
  const done = new Set((await db.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name))
  return files().filter((f) => !done.has(f))
}

// Applies pending migrations one by one, each in its own transaction (plain CREATE TABLE, so an
// already-existing table makes the migration fail and roll back instead of being overwritten).
export async function migrate(db) {
  const applied = []
  for (const file of await pendingMigrations(db)) {
    await db.transaction(async (tx) => {
      await tx.exec(readFileSync(join(dir, file), 'utf8'))
      await tx.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
    })
    applied.push(file)
  }
  return applied
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = createDb(loadConfig())
  try {
    const applied = await migrate(db)
    console.log(applied.length ? `migrate แล้ว: ${applied.join(', ')}` : 'ฐานข้อมูลเป็นปัจจุบันแล้ว')
  } catch (err) {
    console.error('migrate ไม่สำเร็จ:', err.message)
    process.exitCode = 1
  } finally {
    await db.close()
  }
}
