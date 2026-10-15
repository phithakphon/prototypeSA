import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcrypt'
import { createTestDb } from '../src/db.js'
import { migrate } from '../src/migrate.js'
import { seed, TEST_PASSWORD } from '../src/seed.js'
import { createApp } from '../src/app.js'

let server, base, db
const tokens = {}
const USERS = ['employee1', 'manager1', 'hr1', 'finance1', 'executive1']
const PW = 'Str0ngPassw0rd'

async function call(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}
const empId = async (code) => (await db.query('SELECT id FROM employees WHERE employee_code = $1', [code])).rows[0].id
const register = async (username) => {
  assert.equal((await call('POST', '/api/auth/register', { body: { username, password: PW, confirmPassword: PW } })).status, 201)
  const id = (await db.query('SELECT id FROM users WHERE username = $1', [username])).rows[0].id
  const login = await call('POST', '/api/auth/login', { body: { username, password: PW } })
  return { id, token: login.body.token }
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

test('account linking: only HR can reach the workflow', async () => {
  for (const u of ['employee1', 'manager1', 'finance1', 'executive1']) {
    assert.equal((await call('GET', '/api/accounts/pending', { token: tokens[u] })).status, 403)
    assert.equal((await call('GET', '/api/accounts/linkable-employees', { token: tokens[u] })).status, 403)
    assert.equal((await call('POST', '/api/accounts/1/link', { token: tokens[u], body: {} })).status, 403)
    assert.equal((await call('POST', '/api/accounts/1/unlink', { token: tokens[u] })).status, 403)
  }
  assert.equal((await call('GET', '/api/accounts/pending')).status, 401)
  assert.equal((await call('GET', '/api/accounts/pending', { token: tokens.hr1 })).status, 200)
})

test('account linking: pending list shows only unlinked employee-role accounts, no secrets', async () => {
  const a = await register('pendinguser1')
  const r = await call('GET', '/api/accounts/pending', { token: tokens.hr1 })
  assert.deepEqual(r.body.accounts.map((x) => x.username), ['pendinguser1'])
  assert.deepEqual(Object.keys(r.body.accounts[0]).sort(), ['createdAt', 'id', 'username'])
  assert.ok(a.id)
})

test('account linking: candidate list excludes linked, resigned and other-department employees; no confidential data', async () => {
  const r = await call('GET', '/api/accounts/linkable-employees', { token: tokens.hr1 })
  const codes = r.body.employees.map((e) => e.employeeCode)
  assert.deepEqual(codes, ['E101', 'E103', 'E105']) // E100/E104 have accounts, E102 resigned, others in other departments
  for (const e of r.body.employees) for (const k of ['nationalId', 'phone', 'email', 'address', 'amount']) assert.equal(k in e, false)
  assert.deepEqual((await call('GET', '/api/accounts/linkable-employees?q=E105', { token: tokens.hr1 })).body.employees.map((e) => e.employeeCode), ['E105'])
  assert.equal((await call('GET', `/api/accounts/linkable-employees?q=${encodeURIComponent("' OR 1=1 --")}`, { token: tokens.hr1 })).body.employees.length, 0)
})

test('account linking: HR links an account after verification; access starts immediately, role is unchanged; audited', async () => {
  const { id, token } = await register('linkme01')
  const e105 = await empId('E105')
  // before linking: sees nothing
  assert.equal((await call('GET', `/api/employees/${e105}`, { token })).status, 403)

  // wrong verification code is rejected and nothing changes
  const bad = await call('POST', `/api/accounts/${id}/link`, { token: tokens.hr1, body: { employeeId: e105, employeeCode: 'E101' } })
  assert.equal(bad.status, 400)
  assert.ok(bad.body.errors.employeeCode)
  assert.equal((await db.query('SELECT employee_id FROM users WHERE id = $1', [id])).rows[0].employee_id, null)

  const ok = await call('POST', `/api/accounts/${id}/link`, { token: tokens.hr1, body: { employeeId: e105, employeeCode: ' e105 ' } })
  assert.equal(ok.status, 200)
  assert.deepEqual(ok.body.account, { id, username: 'linkme01', role: 'employee', employeeId: e105, employeeCode: 'E105' })
  assert.equal((await db.query('SELECT role FROM users WHERE id = $1', [id])).rows[0].role, 'employee')

  // the existing session now sees exactly its own record, and nothing else
  const own = await call('GET', `/api/employees/${e105}`, { token })
  assert.equal(own.status, 200)
  assert.equal(own.body.isSelf, true)
  assert.equal((await call('GET', `/api/employees/${await empId('E104')}`, { token })).status, 403)
  assert.equal((await call('GET', '/api/employees', { token })).status, 403)
  assert.equal((await call('GET', '/api/salaries', { token })).status, 403)
  assert.equal((await call('POST', `/api/accounts/${id}/link`, { token, body: { employeeId: e105, employeeCode: 'E105' } })).status, 403)

  const audit = (await db.query("SELECT action, user_id, employee_id, performed_by FROM account_link_audit WHERE user_id = $1", [id])).rows
  const hr = (await db.query("SELECT id FROM users WHERE username = 'hr1'")).rows[0].id
  assert.deepEqual(audit, [{ action: 'link', user_id: id, employee_id: e105, performed_by: hr }])

  // it no longer shows up as pending / linkable
  assert.equal((await call('GET', '/api/accounts/pending', { token: tokens.hr1 })).body.accounts.some((a) => a.id === id), false)
  assert.equal((await call('GET', '/api/accounts/linkable-employees?q=E105', { token: tokens.hr1 })).body.employees.length, 0)
})

test('account linking: privilege escalation and bad targets are refused', async () => {
  const { id } = await register('victim001')
  const id2 = (await register('victim002')).id
  const link = (userId, body, token = tokens.hr1) => call('POST', `/api/accounts/${userId}/link`, { token, body })
  const get = async (code) => ({ employeeId: await empId(code), employeeCode: code })

  // an employee who already has an account (e.g. the manager E100) can never be claimed
  assert.equal((await link(id, await get('E100'))).status, 409)
  assert.equal((await link(id, await get('E104'))).status, 409) // owned by employee1
  // resigned employee, other department, unknown employee
  assert.equal((await link(id, await get('E102'))).status, 409)
  assert.equal((await link(id, await get('E202'))).status, 404)
  assert.equal((await link(id, { employeeId: 99999, employeeCode: 'X' })).status, 404)
  for (const bad of [{}, { employeeId: 'abc' }, { employeeId: -1 }, { employeeId: 1.5 }, { employeeId: 99999999999 }]) {
    assert.equal((await link(id, { ...bad, employeeCode: 'E101' })).status, 400, JSON.stringify(bad))
  }
  // privileged / unknown accounts are not linkable, and HR cannot link itself
  const manager = (await db.query("SELECT id FROM users WHERE username = 'manager1'")).rows[0].id
  assert.equal((await link(manager, await get('E101'))).status, 403)
  const hr = (await db.query("SELECT id FROM users WHERE username = 'hr1'")).rows[0].id
  assert.equal((await link(hr, await get('E101'))).status, 403)
  assert.equal((await link(99999, await get('E101'))).status, 404)
  assert.equal((await link('abc', await get('E101'))).status, 404)
  // role / extra fields in the body are ignored: role stays 'employee'
  assert.equal((await link(id2, { ...(await get('E101')), role: 'manager', employee_id: 1 })).status, 200)
  assert.equal((await db.query('SELECT role FROM users WHERE id = $1', [id2])).rows[0].role, 'employee')
  // an employee can only have one account (database-level guarantee too)
  await assert.rejects(db.query('UPDATE users SET employee_id = $1 WHERE id = $2', [await empId('E101'), id]), { code: '23505' })
  assert.equal((await db.query('SELECT employee_id FROM users WHERE id = $1', [id])).rows[0].employee_id, null)
})

test('account linking: concurrent links to one employee succeed exactly once', async () => {
  const a = await register('racelink1')
  const b = await register('racelink2')
  const body = { employeeId: await empId('E103'), employeeCode: 'E103' }
  const rs = await Promise.all([a.id, b.id].map((id) => call('POST', `/api/accounts/${id}/link`, { token: tokens.hr1, body })))
  assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409])
  assert.equal((await db.query('SELECT COUNT(*)::int n FROM users WHERE employee_id = $1', [body.employeeId])).rows[0].n, 1)
})

test('account linking: unlink works only for employee-role accounts and is audited', async () => {
  const { id } = await register('unlinkme1')
  assert.equal((await call('POST', `/api/accounts/${id}/unlink`, { token: tokens.hr1 })).status, 409) // not linked yet
  const linked = (await db.query("SELECT id FROM users WHERE username = 'linkme01'")).rows[0].id // linked to E105 earlier
  const r = await call('POST', `/api/accounts/${linked}/unlink`, { token: tokens.hr1 })
  assert.equal(r.status, 200)
  assert.equal(r.body.account.employeeId, null)
  assert.deepEqual((await db.query('SELECT action FROM account_link_audit WHERE user_id = $1 ORDER BY id', [linked])).rows.map((x) => x.action), ['link', 'unlink'])
  assert.equal((await call('POST', `/api/accounts/${linked}/unlink`, { token: tokens.hr1 })).status, 409) // repeat is safe
  const manager = (await db.query("SELECT id FROM users WHERE username = 'manager1'")).rows[0].id
  assert.equal((await call('POST', `/api/accounts/${manager}/unlink`, { token: tokens.hr1 })).status, 403)
  assert.notEqual((await db.query('SELECT employee_id FROM users WHERE id = $1', [manager])).rows[0].employee_id, null)
})

test('account linking: linked list shows employee-role accounts with their employee, nothing confidential', async () => {
  assert.equal((await call('GET', '/api/accounts/linked', { token: tokens.manager1 })).status, 403)
  const r = await call('GET', '/api/accounts/linked', { token: tokens.hr1 })
  assert.equal(r.status, 200)
  const names = r.body.accounts.map((a) => a.username)
  assert.ok(names.includes('employee1'))
  assert.equal(names.includes('manager1'), false) // privileged accounts are never offered for unlinking
  assert.equal(names.includes('hr1'), false)
  for (const a of r.body.accounts) {
    assert.deepEqual(Object.keys(a).sort(), ['employeeCode', 'employeeId', 'firstName', 'id', 'lastName', 'username'])
  }
})

test('dashboard: recent employees are ordered by employment start date (newest first)', async () => {
  const d = (await call('GET', '/api/dashboard/summary', { token: tokens.executive1 })).body
  assert.deepEqual(d.recentEmployees.map((e) => e.employeeCode).slice(0, 4), ['E105', 'E104', 'E103', 'E101'])
  const dates = d.recentEmployees.map((e) => e.startDate)
  assert.deepEqual(dates, [...dates].sort().reverse())
})
