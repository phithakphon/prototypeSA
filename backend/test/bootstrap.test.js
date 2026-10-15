import { test } from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcrypt'
import { createTestDb } from '../src/db.js'
import { migrate } from '../src/migrate.js'
import { createApp } from '../src/app.js'
import { bootstrapUser, parseArgs } from '../src/bootstrap-user.js'

const PW = 'First-Admin-2026x'
const args = (extra = {}) => ({
  username: 'hr.admin', role: 'hr', 'employee-code': 'e201', 'create-employee': true,
  'first-name': 'ทดสอบ', 'last-name': 'ผู้ดูแล', position: 'เจ้าหน้าที่ฝ่ายบุคคล', 'start-date': '2024-01-15', ...extra,
})
const fresh = async () => {
  const db = await createTestDb()
  await migrate(db) // a brand-new production database: schema only, no seed, no users
  return db
}
const count = async (db, t) => (await db.query(`SELECT COUNT(*)::int n FROM ${t}`)).rows[0].n

test('bootstrap: parseArgs reads flags and values', () => {
  assert.deepEqual(parseArgs(['--username', 'a.b', '--create-employee', '--execute', '--position', 'x y']), { username: 'a.b', 'create-employee': true, execute: true, position: 'x y' })
})

test('bootstrap: dry run validates and writes nothing', async () => {
  const db = await fresh()
  try {
    const r = await bootstrapUser(db, { args: args(), password: PW, execute: false })
    assert.deepEqual(r.problems, [])
    assert.equal(r.done, false)
    assert.deepEqual(r.plan, { username: 'hr.admin', role: 'hr', employeeCode: 'E201', createEmployee: true, department: 'ตรวจสอบบัญชี' })
    assert.equal(JSON.stringify(r).includes(PW), false) // never echoes the password
    assert.equal(await count(db, 'users'), 0)
    assert.equal(await count(db, 'employees'), 0)
  } finally {
    await db.close()
  }
})

test('bootstrap: rules are enforced (weak password, bad role/username, missing fields, public default)', async () => {
  const db = await fresh()
  try {
    const bad = async (a, pw = PW) => (await bootstrapUser(db, { args: a, password: pw, execute: true })).problems
    assert.ok((await bad(args(), 'short1A')).length)
    assert.ok((await bad(args(), 'Passw0rd!')).length)
    assert.ok((await bad(args(), null)).length)
    assert.ok((await bad(args({ role: 'employee' }))).length) // employees register themselves; only privileged roles are bootstrapped
    assert.ok((await bad(args({ role: 'admin' }))).length)
    assert.ok((await bad(args({ username: 'x' }))).length)
    assert.ok((await bad(args({ 'employee-code': undefined }))).length)
    assert.ok((await bad(args({ 'start-date': 'tomorrow' }))).length)
    assert.ok((await bad(args({ 'first-name': undefined }))).length)
    assert.equal(await count(db, 'users'), 0)
  } finally {
    await db.close()
  }
})

test('bootstrap: creates the first account + employee, hashed with bcrypt, in the supported department, and it can log in', async () => {
  const db = await fresh()
  const server = createApp({ db, config: { jwtSecret: 'test-secret', jwtExpiresIn: '1h' } }).listen(0)
  await new Promise((r) => server.once('listening', r))
  try {
    const r = await bootstrapUser(db, { args: args({ department: 'ฝ่ายการเงิน' }), password: PW, execute: true })
    assert.deepEqual(r.problems, [])
    assert.equal(r.done, true)
    const u = (await db.query('SELECT username, role, employee_id, password_hash FROM users')).rows[0]
    assert.equal(u.role, 'hr')
    assert.match(u.password_hash, /^\$2[aby]\$10\$/)
    assert.equal(await bcrypt.compare(PW, u.password_hash), true)
    const e = (await db.query('SELECT employee_code, department, status FROM employees WHERE id = $1', [u.employee_id])).rows[0]
    assert.deepEqual(e, { employee_code: 'E201', department: 'ตรวจสอบบัญชี', status: 'active' })
    assert.equal(await count(db, 'employee_history'), 1)

    const base = `http://127.0.0.1:${server.address().port}`
    const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'hr.admin', password: PW }) })
    assert.equal(login.status, 200)
    assert.deepEqual((await login.json()).user.permissions.includes('account:link'), true)

    // re-running changes nothing and never overwrites
    const again = await bootstrapUser(db, { args: args(), password: PW, execute: true })
    assert.ok(again.problems.length)
    assert.equal(again.done, false)
    assert.equal(await count(db, 'users'), 1)
    assert.equal(await count(db, 'employees'), 1)
  } finally {
    server.close()
    await db.close()
  }
})

test('bootstrap: links to an existing employee only when active and unclaimed', async () => {
  const db = await fresh()
  try {
    await db.query("INSERT INTO employees (employee_code, first_name, last_name, department, position, start_date) VALUES ('E100','ก','ข','ตรวจสอบบัญชี','ผู้จัดการ','2020-01-01'), ('E101','ค','ง','ตรวจสอบบัญชี','ผู้ช่วย','2021-01-01')")
    await db.query("UPDATE employees SET status = 'resigned', resignation_date = '2025-01-01' WHERE employee_code = 'E101'")
    const link = (a) => bootstrapUser(db, { args: { username: 'boss.one', role: 'manager', 'employee-code': 'E100', ...a }, password: PW, execute: true })
    assert.ok((await link({ 'employee-code': 'E999' })).problems.length) // unknown
    assert.ok((await link({ 'employee-code': 'E101' })).problems.length) // resigned
    const ok = await link({})
    assert.equal(ok.done, true)
    assert.equal(await count(db, 'employees'), 2) // nothing created
    const second = await bootstrapUser(db, { args: { username: 'boss.two', role: 'manager', 'employee-code': 'E100' }, password: PW, execute: true })
    assert.ok(second.problems.some((p) => p.includes('มีบัญชีผู้ใช้อยู่แล้ว'))) // already has an account
    const dup = await bootstrapUser(db, { args: { username: 'BOSS.ONE', role: 'hr', 'employee-code': 'E100' }, password: PW, execute: true })
    assert.ok(dup.problems.length) // username (case-insensitive)
    assert.equal(await count(db, 'users'), 1)
  } finally {
    await db.close()
  }
})
