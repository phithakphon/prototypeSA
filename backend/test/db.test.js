import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { createDb, createTestDb, isDbUnavailable } from '../src/db.js'
import { loadConfig } from '../src/config.js'
import { migrate, pendingMigrations } from '../src/migrate.js'
import { importData } from '../src/migrate-data.js'
import { createApp } from '../src/app.js'

const ENV = { JWT_SECRET: 'x'.repeat(40), DATABASE_URL: 'postgresql://u:p%40ss@db.example.supabase.co:5432/postgres' }

test('config: DATABASE_URL required, never echoed, SSL defaults', () => {
  assert.throws(() => loadConfig({ JWT_SECRET: ENV.JWT_SECRET }), /DATABASE_URL/)
  assert.throws(() => loadConfig({ ...ENV, DATABASE_URL: 'not a url' }), (e) => !e.message.includes('not a url'))
  assert.throws(() => loadConfig({ ...ENV, DB_SSL: 'bogus' }), /DB_SSL/)
  assert.equal(loadConfig(ENV).dbSsl, 'require')
  assert.equal(loadConfig({ ...ENV, DATABASE_URL: 'postgresql://u:p@localhost:5432/db' }).dbSsl, 'disable')
  assert.equal(loadConfig(ENV).dbIsLocal, false)
})

test('migrations: idempotent, RLS enabled on every table', async () => {
  const db = await createTestDb()
  try {
    assert.deepEqual(await migrate(db), ['001_init.sql', '002_reinstated_and_username_ci.sql', '003_account_links.sql', '005_performance_evaluations.sql'])
    assert.deepEqual(await migrate(db), [])
    assert.deepEqual(await pendingMigrations(db), [])
    const { rows } = await db.query(
      "SELECT relname FROM pg_class WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace AND NOT relrowsecurity AND relname <> 'schema_migrations'",
    )
    assert.deepEqual(rows, [])
  } finally {
    await db.close()
  }
})

// Legacy SQLite database with fake data only.
function legacySqlite() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync(new URL('../src/legacy-sqlite/001_init.sqlite.sql', import.meta.url), 'utf8'))
  sqlite.exec(`
    INSERT INTO employees (id, employee_code, first_name, last_name, department, position, start_date, phone)
      VALUES (7, 'T7', 'ทดสอบ', 'หนึ่ง', 'A', 'P', '2024-01-02', '0800000000'), (9, 'T9', 'ทดสอบ', 'สอง', 'B', 'Q', '2025-02-03', NULL);
    INSERT INTO users (id, username, password_hash, role, employee_id) VALUES (3, 'u3', 'hash', 'manager', 7);
    INSERT INTO salaries (id, employee_id, amount, effective_date, created_by) VALUES (4, 7, 12345.5, '2024-01-02', 3);
    INSERT INTO employee_history (id, employee_id, event_type, description, event_date) VALUES (5, 7, 'hired', 'x', '2024-01-02');
    INSERT INTO announcements (id, title, published_at) VALUES (2, 'news', '2025-01-01');
  `)
  return sqlite
}

test('migrate-data: dry run writes nothing; execute preserves ids; re-run adds nothing', async () => {
  const db = await createTestDb()
  const sqlite = legacySqlite()
  try {
    await migrate(db)
    const dry = await importData({ sqlite, db, execute: false })
    assert.equal(dry.find((r) => r.table === 'employees').source, 2)
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM employees')).rows[0].n, 0)

    const first = await importData({ sqlite, db, execute: true })
    assert.deepEqual(first.map((r) => r.inserted), [2, 1, 1, 1, 1])
    const emp = (await db.query('SELECT id, start_date, phone FROM employees ORDER BY id')).rows
    assert.deepEqual(emp.map((e) => e.id), [7, 9])
    assert.equal(emp[0].start_date, '2024-01-02')
    assert.equal((await db.query('SELECT amount, employee_id, created_by FROM salaries')).rows[0].amount, 12345.5)
    assert.equal((await db.query('SELECT employee_id FROM users')).rows[0].employee_id, 7)

    const again = await importData({ sqlite, db, execute: true })
    assert.deepEqual(again.map((r) => r.inserted), [0, 0, 0, 0, 0])
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM employees')).rows[0].n, 2)

    // sequences continue after the imported ids
    const { rows } = await db.query(
      "INSERT INTO employees (employee_code, first_name, last_name, department, position, start_date) VALUES ('N1','a','b','c','d','2026-01-01') RETURNING id",
    )
    assert.ok(rows[0].id > 9)
  } finally {
    sqlite.close()
    await db.close()
  }
})

test('migrate-data: a conflicting unique key rolls back everything and overwrites nothing', async () => {
  const db = await createTestDb()
  const sqlite = legacySqlite()
  try {
    await migrate(db)
    await db.query(
      "INSERT INTO employees (id, employee_code, first_name, last_name, department, position, start_date) VALUES (1, 'T9', 'เดิม', 'เดิม', 'X', 'Y', '2020-01-01')",
    )
    await assert.rejects(importData({ sqlite, db, execute: true }))
    const rows = (await db.query('SELECT id, first_name FROM employees')).rows
    assert.deepEqual(rows, [{ id: 1, first_name: 'เดิม' }])
  } finally {
    sqlite.close()
    await db.close()
  }
})

test('unreachable database: pg pool error is classified and API answers 503 in Thai', async () => {
  const config = loadConfig({ ...ENV, DATABASE_URL: 'postgresql://u:p@127.0.0.1:1/postgres' })
  const db = createDb(config)
  try {
    await assert.rejects(db.query('SELECT 1'), (err) => isDbUnavailable(err))
    const app = createApp({ db, config })
    const server = app.listen(0)
    await new Promise((r) => server.once('listening', r))
    // a valid-looking token forces the authenticate middleware to hit the database
    const jwt = (await import('jsonwebtoken')).default
    const token = jwt.sign({ sub: '1' }, config.jwtSecret, { algorithm: 'HS256' })
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/employees`, { headers: { Authorization: `Bearer ${token}` } })
    assert.equal(res.status, 503)
    const body = await res.json()
    assert.match(body.message, /ฐานข้อมูล/)
    assert.equal(JSON.stringify(body).includes('127.0.0.1'), false)
    server.close()
  } finally {
    await db.close()
  }
})
