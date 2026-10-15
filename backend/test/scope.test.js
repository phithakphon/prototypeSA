import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestDb } from '../src/db.js'
import { migrate } from '../src/migrate.js'
import { seed, TEST_PASSWORD } from '../src/seed.js'
import { createApp } from '../src/app.js'

const DEPT = 'ตรวจสอบบัญชี'
const OTHER = 'ฝ่ายการเงิน'
let server, base, db
const tokens = {}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}
const idOf = async (code) => (await db.query('SELECT id FROM employees WHERE employee_code = $1', [code])).rows[0].id

before(async () => {
  db = await createTestDb()
  await migrate(db)
  await seed(db)
  server = createApp({ db, config: { jwtSecret: 'test-secret', jwtExpiresIn: '1h', port: 0 } }).listen(0)
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${server.address().port}`
  for (const u of ['employee1', 'manager1', 'hr1', 'finance1', 'executive1']) {
    tokens[u] = (await call('POST', '/api/auth/login', { body: { username: u, password: TEST_PASSWORD } })).body.token
  }
})
after(async () => {
  server.close()
  await db.close()
})

test('scope: listings and search only ever contain the supported department', async () => {
  const all = (await call('GET', '/api/employees', { token: tokens.manager1 })).body
  assert.equal(all.total, 6) // E100-E105; the 6 seeded employees of other departments are hidden
  assert.ok(all.employees.every((e) => e.department === DEPT))
  assert.deepEqual((await call('GET', '/api/employees/departments', { token: tokens.hr1 })).body.departments, [DEPT])
  assert.equal((await call('GET', `/api/employees?department=${encodeURIComponent(OTHER)}`, { token: tokens.manager1 })).body.total, 0)
  assert.equal((await call('GET', `/api/employees?q=${encodeURIComponent(OTHER)}`, { token: tokens.manager1 })).body.total, 0)
  assert.equal((await call('GET', `/api/employees?q=E202`, { token: tokens.manager1 })).body.total, 0)
})

test('scope: out-of-scope records are 404 for every read and write route', async () => {
  const out = await idOf('E202') // HR department, not anyone's own record
  for (const u of ['manager1', 'hr1', 'executive1']) {
    assert.equal((await call('GET', `/api/employees/${out}`, { token: tokens[u] })).status, 404)
  }
  assert.equal((await call('GET', `/api/employees/${out}/salaries`, { token: tokens.finance1 })).status, 404)
  assert.equal((await call('POST', `/api/employees/${out}/salaries`, { token: tokens.finance1, body: { amount: 1000, effectiveDate: '2026-10-01' } })).status, 404)
  assert.equal((await call('PUT', `/api/employees/${out}`, { token: tokens.manager1, body: { employeeCode: 'E202' } })).status, 404)
  assert.equal((await call('POST', `/api/employees/${out}/resign`, { token: tokens.manager1, body: { resignationDate: '2026-10-01' } })).status, 404)
  assert.equal((await call('POST', `/api/employees/${out}/reinstate`, { token: tokens.manager1 })).status, 404)
  const sal = (await call('GET', '/api/salaries', { token: tokens.finance1 })).body.employees
  assert.equal(sal.length, 6)
  assert.ok(sal.every((e) => e.department === DEPT))
  const resigned = (await call('GET', '/api/employees/resigned', { token: tokens.manager1 })).body.employees
  assert.ok(resigned.every((e) => e.department === DEPT))
  assert.equal(resigned.some((e) => e.employeeCode === 'E303'), false) // resigned, but in another department
})

test('scope: dashboard statistics count only the supported department', async () => {
  const d = (await call('GET', '/api/dashboard/summary', { token: tokens.executive1 })).body
  assert.deepEqual(d.counts, { total: 6, active: 5, resigned: 1 })
  assert.ok(d.recentEmployees.every((e) => e.employeeCode.startsWith('E10')))
  assert.equal((await call('GET', '/api/dashboard/summary', { token: tokens.employee1 })).body.counts, null)
})

test("scope: a user's own record stays reachable even outside the supported department", async () => {
  for (const u of ['hr1', 'finance1', 'executive1']) {
    const self = (await call('GET', '/api/auth/me', { token: tokens[u] })).body.user.employeeId
    const own = await call('GET', `/api/employees/${self}`, { token: tokens[u] })
    assert.equal(own.status, 200)
    assert.equal(own.body.isSelf, true)
    assert.equal(own.body.confidentialVisible, true)
    assert.equal((await call('GET', `/api/employees/${self}/salaries`, { token: tokens[u] })).status, 200)
  }
  // but being in scope of oneself grants nothing else: HR still cannot edit its own record
  const hrSelf = (await call('GET', '/api/auth/me', { token: tokens.hr1 })).body.user.employeeId
  assert.equal((await call('PUT', `/api/employees/${hrSelf}`, { token: tokens.hr1, body: { employeeCode: 'E201' } })).status, 403)
})

test('scope: employees are always saved in the supported department, whatever the client sends', async () => {
  const body = { employeeCode: 'E950', firstName: 'ก', lastName: 'ข', department: OTHER, position: 'ผู้ตรวจสอบบัญชี', startDate: '2026-01-05' }
  const created = await call('POST', '/api/employees', { token: tokens.manager1, body })
  assert.equal(created.status, 201)
  assert.equal(created.body.employee.department, DEPT)
  const upd = await call('PUT', `/api/employees/${created.body.employee.id}`, { token: tokens.manager1, body: { ...body, department: OTHER, position: 'หัวหน้าทีม' } })
  assert.equal(upd.status, 200)
  assert.equal(upd.body.employee.department, DEPT)
})
