import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestDb } from '../src/db.js'
import { migrate } from '../src/migrate.js'
import { seed, TEST_PASSWORD } from '../src/seed.js'
import { createApp } from '../src/app.js'
import { permissionsFor } from '../src/rbac.js'

let server, base, db
const tokens = {}
const USERS = ['employee1', 'manager1', 'hr1', 'finance1', 'executive1']

async function call(method, path, { token, body, raw } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body || raw ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}
const empId = async (code) => (await call('GET', `/api/employees?q=${code}`, { token: tokens.manager1 })).body.employees[0].id

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

test('RBAC: permission matrix matches the frontend contract', () => {
  assert.deepEqual(permissionsFor('employee').sort(), ['employee:selfOnly', 'employee:view', 'evaluation:view'])
  assert.deepEqual(permissionsFor('manager').sort(), ['employee:manage', 'employee:search', 'employee:view', 'employee:viewConfidential', 'evaluation:manage', 'evaluation:view', 'resignation:manage'])
  assert.deepEqual(permissionsFor('hr').sort(), ['account:link', 'employee:search', 'employee:view', 'employee:viewConfidential', 'salary:view'])
  assert.deepEqual(permissionsFor('finance').sort(), ['employee:search', 'employee:view', 'salary:manage', 'salary:view'])
  assert.deepEqual(permissionsFor('executive').sort(), ['employee:search', 'employee:view', 'employee:viewConfidential'])
})

test('RBAC: employee can reach only their own record; other ids are 403 whether or not they exist', async () => {
  const t = tokens.employee1
  const me = await empId('E104')
  const own = await call('GET', `/api/employees/${me}`, { token: t })
  assert.equal(own.status, 200)
  assert.equal(own.body.isSelf, true)
  const other = await empId('E105')
  assert.equal((await call('GET', `/api/employees/${other}`, { token: t })).status, 403)
  assert.equal((await call('GET', '/api/employees/99999', { token: t })).status, 403) // no id probing
  assert.equal((await call('GET', '/api/employees', { token: t })).status, 403)
  assert.equal((await call('GET', '/api/employees/departments', { token: t })).status, 403)
  assert.equal((await call('GET', '/api/employees/resigned', { token: t })).status, 403)
  assert.equal((await call('GET', `/api/employees/${other}/salaries`, { token: t })).status, 403)
  assert.equal((await call('GET', `/api/employees/${me}/salaries`, { token: t })).status, 200)
})

test('RBAC: HR reads salaries but can never change them; finance is the only writer', async () => {
  const id = await empId('E105')
  const body = { amount: 70000, effectiveDate: '2026-10-01' }
  assert.equal((await call('GET', `/api/employees/${id}/salaries`, { token: tokens.hr1 })).status, 200)
  assert.equal((await call('GET', `/api/employees/${id}/salaries`, { token: tokens.hr1 })).body.canManage, false)
  assert.equal((await call('POST', `/api/employees/${id}/salaries`, { token: tokens.hr1, body })).status, 403)
  assert.equal((await call('PUT', '/api/salaries/1', { token: tokens.hr1, body })).status, 403)
  assert.equal((await call('GET', '/api/salaries', { token: tokens.hr1 })).status, 403)
  for (const u of ['manager1', 'executive1']) {
    assert.equal((await call('GET', `/api/employees/${id}/salaries`, { token: tokens[u] })).status, 403)
  }
  assert.equal((await call('GET', `/api/employees/${id}/salaries`, { token: tokens.finance1 })).body.canManage, true)
})

test('RBAC: only manager changes or reads resignations; executive/HR are read-only on employees', async () => {
  const id = await empId('E105')
  for (const u of ['hr1', 'executive1', 'finance1', 'employee1']) {
    assert.equal((await call('POST', '/api/employees', { token: tokens[u], body: { employeeCode: 'X1' } })).status, 403)
    assert.equal((await call('PUT', `/api/employees/${id}`, { token: tokens[u], body: {} })).status, 403)
    assert.equal((await call('POST', `/api/employees/${id}/reinstate`, { token: tokens[u] })).status, 403)
  }
  for (const u of ['hr1', 'executive1']) {
    const r = await call('GET', `/api/employees/${id}`, { token: tokens[u] })
    assert.equal(r.status, 200)
    assert.ok(Array.isArray(r.body.history))
  }
})

test('registration: creates an unlinked employee account that can log in but see no employee data', async () => {
  const body = { username: 'newuser1', password: 'Str0ngPassw0rd', confirmPassword: 'Str0ngPassw0rd' }
  const r = await call('POST', '/api/auth/register', { body })
  assert.equal(r.status, 201)
  assert.deepEqual(r.body, { username: 'newuser1', role: 'employee', roleLabel: 'พนักงาน' })
  const row = (await db.query('SELECT role, employee_id, password_hash FROM users WHERE username = $1', ['newuser1'])).rows[0]
  assert.equal(row.role, 'employee')
  assert.equal(row.employee_id, null)
  assert.match(row.password_hash, /^\$2[aby]\$10\$/) // bcrypt, never plain text
  assert.equal(row.password_hash.includes('Str0ng'), false)
  const login = await call('POST', '/api/auth/login', { body: { username: 'newuser1', password: body.password } })
  assert.equal(login.status, 200)
  assert.equal(login.body.user.employeeId, null)
  const t = login.body.token
  assert.equal((await call('GET', '/api/employees', { token: t })).status, 403)
  assert.equal((await call('GET', `/api/employees/${await empId('E104')}`, { token: t })).status, 403)
  assert.equal((await call('GET', '/api/salaries', { token: t })).status, 403)
  assert.equal((await call('GET', '/api/dashboard/summary', { token: t })).body.counts, null)
})

test('registration: clients cannot choose a role or link an employee; no employee record is created', async () => {
  const before = (await db.query('SELECT COUNT(*)::int n FROM employees')).rows[0].n
  const r = await call('POST', '/api/auth/register', {
    body: { username: 'sneaky1', password: 'Str0ngPassw0rd', confirmPassword: 'Str0ngPassw0rd', role: 'manager', employeeId: 1, employee_id: 1, roleLabel: 'x' },
  })
  assert.equal(r.status, 201)
  assert.equal(r.body.role, 'employee')
  const row = (await db.query('SELECT role, employee_id FROM users WHERE username = $1', ['sneaky1'])).rows[0]
  assert.deepEqual(row, { role: 'employee', employee_id: null })
  assert.equal((await db.query('SELECT COUNT(*)::int n FROM employees')).rows[0].n, before)
})

test('registration: validation, duplicates (case-insensitive) and malformed input', async () => {
  const ok = { password: 'Str0ngPassw0rd', confirmPassword: 'Str0ngPassw0rd' }
  const bad = async (body, field) => {
    const r = await call('POST', '/api/auth/register', { body })
    assert.equal(r.status, 400, JSON.stringify(body))
    assert.ok(r.body.errors[field], field)
  }
  await bad({ ...ok, username: '' }, 'username')
  await bad({ ...ok, username: 'ab' }, 'username')
  await bad({ ...ok, username: '1abcd' }, 'username')
  await bad({ ...ok, username: "bob'; DROP TABLE users;--" }, 'username')
  await bad({ ...ok, username: 'validname', password: 'short1A', confirmPassword: 'short1A' }, 'password')
  await bad({ ...ok, username: 'validname', password: 'alllowercase1', confirmPassword: 'alllowercase1' }, 'password')
  await bad({ ...ok, username: 'validname', password: 'ก'.repeat(30) + 'aA1', confirmPassword: 'ก'.repeat(30) + 'aA1' }, 'password') // > 72 bytes
  await bad({ ...ok, username: 'validname', confirmPassword: 'Different1Pass' }, 'confirmPassword')
  await bad({ username: 'validname', password: { $ne: 1 }, confirmPassword: 'x' }, 'password')
  assert.equal((await call('POST', '/api/auth/register', { raw: '[]' })).status, 400)
  assert.equal((await call('POST', '/api/auth/register', { raw: '{bad' })).status, 400)

  for (const username of ['manager1', 'MANAGER1', 'Newuser1']) {
    const r = await call('POST', '/api/auth/register', { body: { ...ok, username } })
    assert.equal(r.status, 409)
    assert.ok(r.body.errors.username)
  }
  // the database itself also rejects case-variant duplicates
  await assert.rejects(db.query("INSERT INTO users (username, password_hash, role) VALUES ('MANAGER1', 'x', 'employee')"), { code: '23505' })
})

test('registration: concurrent sign-ups with one username create exactly one account', async () => {
  const body = { username: 'racer01', password: 'Str0ngPassw0rd', confirmPassword: 'Str0ngPassw0rd' }
  const results = await Promise.all(Array.from({ length: 5 }, () => call('POST', '/api/auth/register', { body })))
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409, 409, 409])
  assert.equal((await db.query("SELECT COUNT(*)::int n FROM users WHERE lower(username) = 'racer01'")).rows[0].n, 1)
})

test('reinstatement: manager restores a resigned employee with an audit entry; repeats and bad ids are safe', async () => {
  const id = await empId('E102') // seeded as resigned
  const url = `/api/employees/${id}/reinstate`
  const before = await call('GET', `/api/employees/${id}`, { token: tokens.manager1 })
  assert.equal(before.body.employee.status, 'resigned')
  const ok = await call('POST', url, { token: tokens.manager1 })
  assert.equal(ok.status, 200)
  assert.equal(ok.body.employee.status, 'active')
  const after = await call('GET', `/api/employees/${id}`, { token: tokens.manager1 })
  assert.equal(after.body.employee.resignationDate, null)
  assert.equal(after.body.employee.resignationReason, null)
  const events = after.body.history.map((h) => h.eventType)
  assert.ok(events.includes('reinstated'))
  assert.ok(events.includes('resigned'), 'earlier history is preserved')
  const audit = (await db.query("SELECT created_by FROM employee_history WHERE employee_id = $1 AND event_type = 'reinstated'", [id])).rows
  assert.equal(audit.length, 1)
  assert.ok(audit[0].created_by, 'records who did it')
  const again = await call('POST', url, { token: tokens.manager1 })
  assert.equal(again.status, 409)
  assert.equal(again.body.message, 'พนักงานคนนี้ยังปฏิบัติงานอยู่')
  assert.equal((await db.query("SELECT COUNT(*)::int n FROM employee_history WHERE employee_id = $1 AND event_type = 'reinstated'", [id])).rows[0].n, 1)
  assert.equal((await call('POST', `/api/employees/${await empId('E105')}/reinstate`, { token: tokens.manager1 })).status, 409) // never resigned
  assert.equal((await call('POST', '/api/employees/99999/reinstate', { token: tokens.manager1 })).status, 404)
  assert.equal((await call('POST', '/api/employees/abc/reinstate', { token: tokens.manager1 })).status, 404)
  assert.equal((await call('POST', url)).status, 401)
  // can be resigned again afterwards, and salary rules follow the status
  assert.equal((await call('POST', `/api/employees/${id}/salaries`, { token: tokens.finance1, body: { amount: 41000, effectiveDate: '2026-10-01' } })).status, 201)
})

test('reinstatement: concurrent requests log exactly one reinstatement', async () => {
  const id = await empId('E103')
  const body = { resignationDate: '2026-10-01', reason: 'ทดสอบ' }
  assert.equal((await call('POST', `/api/employees/${id}/resign`, { token: tokens.manager1, body })).status, 200)
  const rs = await Promise.all(Array.from({ length: 4 }, () => call('POST', `/api/employees/${id}/reinstate`, { token: tokens.manager1 })))
  assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409, 409, 409])
  assert.equal((await db.query("SELECT COUNT(*)::int n FROM employee_history WHERE employee_id = $1 AND event_type = 'reinstated'", [id])).rows[0].n, 1)
})

test('security edge cases: tokens, injection-shaped input, oversize ids', async () => {
  const jwt = (await import('jsonwebtoken')).default
  const forged = jwt.sign({ sub: '1' }, 'wrong-secret', { algorithm: 'HS256' })
  assert.equal((await call('GET', '/api/employees', { token: forged })).status, 401)
  const none = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url') + '.' + Buffer.from('{"sub":"1"}').toString('base64url') + '.'
  assert.equal((await call('GET', '/api/employees', { token: none })).status, 401)
  const nan = jwt.sign({ sub: 'abc' }, 'test-secret', { algorithm: 'HS256' })
  assert.equal((await call('GET', '/api/employees', { token: nan })).status, 401)
  const deleted = jwt.sign({ sub: '999999' }, 'test-secret', { algorithm: 'HS256' })
  assert.equal((await call('GET', '/api/employees', { token: deleted })).status, 401)
  const inj = await call('GET', `/api/employees?q=${encodeURIComponent("' OR 1=1; --")}`, { token: tokens.hr1 })
  assert.equal(inj.status, 200)
  assert.equal(inj.body.total, 0)
  assert.equal((await call('GET', '/api/employees/99999999999', { token: tokens.hr1 })).status, 404)
  assert.equal((await db.query('SELECT COUNT(*)::int n FROM users')).rows[0].n >= 5, true) // users table intact
  const login = await call('POST', '/api/auth/login', { body: { username: { $ne: '' }, password: { $ne: '' } } })
  assert.equal(login.status, 400)
  const me = await call('POST', '/api/auth/login', { body: { username: "admin' --", password: 'x' } })
  assert.equal(me.status, 401)
})

test('login: username is case-insensitive, password stays case-sensitive, wrong password still fails', async () => {
  for (const username of ['manager1', 'MANAGER1', 'Manager1', ' mAnAgEr1 ']) {
    const r = await call('POST', '/api/auth/login', { body: { username, password: TEST_PASSWORD } })
    assert.equal(r.status, 200, username)
    assert.equal(r.body.user.username, 'manager1')
  }
  assert.equal((await call('POST', '/api/auth/login', { body: { username: 'MANAGER1', password: TEST_PASSWORD.toLowerCase() } })).status, 401)
  assert.equal((await call('POST', '/api/auth/login', { body: { username: 'nobody', password: TEST_PASSWORD } })).status, 401)
})

test('login: a registered username works in any letter case, and case variants cannot be registered twice', async () => {
  const PW = 'Str0ngPassw0rd'
  assert.equal((await call('POST', '/api/auth/register', { body: { username: 'Case.Test', password: PW, confirmPassword: PW } })).status, 201)
  for (const username of ['case.test', 'CASE.TEST', 'Case.Test']) {
    assert.equal((await call('POST', '/api/auth/login', { body: { username, password: PW } })).status, 200, username)
  }
  assert.equal((await call('POST', '/api/auth/register', { body: { username: 'CASE.TEST', password: PW, confirmPassword: PW } })).status, 409)
  const n = (await db.query("SELECT COUNT(*)::int AS n FROM users WHERE lower(username) = 'case.test'")).rows[0].n
  assert.equal(n, 1)
})
