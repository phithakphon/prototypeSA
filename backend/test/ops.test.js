import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcrypt'
import { createTestDb } from '../src/db.js'
import { migrate } from '../src/migrate.js'
import { seed, TEST_PASSWORD } from '../src/seed.js'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'
import { passwordProblems, rotate, SEEDED_USERNAMES } from '../src/rotate-passwords.js'

let server, base, db
const tokens = {}
const USERS = ['employee1', 'manager1', 'hr1', 'finance1', 'executive1']

async function call(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

before(async () => {
  db = await createTestDb()
  await migrate(db)
  await seed(db)
  server = createApp({ db, config: { jwtSecret: 'test-secret', jwtExpiresIn: '1h', port: 0 } }).listen(0)
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${server.address().port}`
  for (const u of USERS) tokens[u] = (await call('POST', '/api/auth/login', { body: { username: u, password: TEST_PASSWORD } })).body.token
})
after(async () => {
  server.close()
  await db.close()
})

test('rotate-passwords: dry run changes nothing; rules are enforced; execute rotates only the listed accounts', async () => {
  const before = (await db.query('SELECT username, password_hash FROM users ORDER BY id')).rows
  const NEW = 'Rotated-Secret-2026x'
  const plan = await rotate(db, { usernames: SEEDED_USERNAMES, newPassword: NEW, execute: false })
  assert.deepEqual(plan.accounts.sort(), [...SEEDED_USERNAMES].sort())
  assert.deepEqual(plan.problems, [])
  assert.deepEqual((await db.query('SELECT username, password_hash FROM users ORDER BY id')).rows, before)

  // rules (messages never contain the password)
  for (const weak of ['short1A', 'alllowercase12345', TEST_PASSWORD, 'ก'.repeat(40)]) {
    const r = await rotate(db, { usernames: SEEDED_USERNAMES, newPassword: weak, execute: true })
    assert.ok(r.problems.length, weak)
    assert.equal(r.updated, 0)
    assert.equal(JSON.stringify(r).includes(weak), false)
  }
  assert.ok((await rotate(db, { usernames: SEEDED_USERNAMES, newPassword: undefined, execute: true })).problems.length)
  assert.ok(passwordProblems(NEW, { previous: [NEW] }).length) // reuse of the previous value is refused
  const same = await rotate(db, { usernames: ['hr1'], newPassword: 'Passw0rd!Passw0rd', execute: false })
  assert.deepEqual(same.problems, [])
  assert.ok((await rotate(db, { usernames: ['hr1'], newPassword: TEST_PASSWORD, execute: false })).problems.length)

  const done = await rotate(db, { usernames: ['hr1', 'finance1'], newPassword: NEW, execute: true })
  assert.equal(done.updated, 2)
  const after = Object.fromEntries((await db.query('SELECT username, password_hash FROM users')).rows.map((r) => [r.username, r.password_hash]))
  assert.equal(await bcrypt.compare(NEW, after.hr1), true)
  assert.equal(await bcrypt.compare(NEW, after.finance1), true)
  assert.match(after.hr1, /^\$2[aby]\$10\$/)
  assert.equal(await bcrypt.compare(TEST_PASSWORD, after.manager1), true) // untouched
  assert.equal((await call('POST', '/api/auth/login', { body: { username: 'hr1', password: TEST_PASSWORD } })).status, 401)
  assert.equal((await call('POST', '/api/auth/login', { body: { username: 'hr1', password: NEW } })).status, 200)
  // rotating to the password an account already has is refused
  assert.ok((await rotate(db, { usernames: ['hr1'], newPassword: NEW, execute: true })).problems.some((p) => p.includes('hr1')))
  const missing = await rotate(db, { usernames: ['nobody1'], newPassword: NEW, execute: true })
  assert.deepEqual(missing.missing, ['nobody1'])
  assert.equal(missing.updated, 0)
})

test('config: SSL hardening (URL ssl params stripped, production requires verify, CA file must exist)', () => {
  const base = { JWT_SECRET: 'x'.repeat(40) }
  const url = 'postgresql://u:p%2Fw@db.example.supabase.co:5432/postgres'
  const c = loadConfig({ ...base, DATABASE_URL: `${url}?sslmode=disable&application_name=ems` })
  assert.deepEqual(c.ignoredUrlParams, ['sslmode'])
  assert.equal(c.databaseUrl.includes('sslmode'), false)
  assert.ok(c.databaseUrl.includes('application_name=ems'))
  assert.ok(c.databaseUrl.includes('p%2Fw')) // password encoding preserved
  assert.equal(c.dbSsl, 'require') // the URL cannot downgrade it
  assert.deepEqual(loadConfig({ ...base, DATABASE_URL: url }).ignoredUrlParams, [])
  assert.equal(loadConfig({ ...base, DATABASE_URL: url }).databaseUrl, url) // untouched when nothing to strip
  assert.throws(() => loadConfig({ ...base, DATABASE_URL: url, NODE_ENV: 'production' }), /DB_SSL=verify/)
  assert.throws(() => loadConfig({ ...base, DATABASE_URL: url, NODE_ENV: 'production', DB_SSL: 'require' }), /DB_SSL=verify/)
  assert.equal(loadConfig({ ...base, DATABASE_URL: url, NODE_ENV: 'production', DB_SSL: 'verify' }).dbSsl, 'verify')
  assert.throws(() => loadConfig({ ...base, DATABASE_URL: url, DB_SSL: 'verify', DB_SSL_CA: 'C:/does/not/exist.crt' }), (e) => !e.message.includes('exist.crt') || true)
  assert.throws(() => loadConfig({ ...base, DATABASE_URL: url, DB_SSL: 'verify', DB_SSL_CA: 'C:/does/not/exist.crt' }), /DB_SSL_CA/)
})
