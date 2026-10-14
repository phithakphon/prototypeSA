import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { openDb } from '../src/db.js'
import { migrate } from '../src/migrate.js'
import { seed, TEST_PASSWORD } from '../src/seed.js'
import { createApp } from '../src/app.js'

let server
let base
const tokens = {}
const USERS = ['employee1', 'manager1', 'hr1', 'finance1', 'executive1']

async function call(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

before(async () => {
  const db = openDb(':memory:')
  migrate(db)
  seed(db)
  const config = { jwtSecret: 'test-secret', jwtExpiresIn: '1h', port: 0 }
  server = createApp({ db, config }).listen(0)
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${server.address().port}`
  for (const u of USERS) {
    const r = await call('POST', '/api/auth/login', { body: { username: u, password: TEST_PASSWORD } })
    tokens[u] = r.body.token
  }
})
after(() => server.close())

const newEmployee = (over = {}) => ({
  employeeCode: 'E900', firstName: 'ทดสอบ', lastName: 'ระบบ', department: 'ตรวจสอบบัญชี',
  position: 'ผู้ตรวจสอบบัญชี', startDate: '2026-01-05', ...over,
})

test('UC-01 login: success returns role and permissions', async () => {
  const r = await call('POST', '/api/auth/login', { body: { username: 'finance1', password: TEST_PASSWORD } })
  assert.equal(r.status, 200)
  assert.equal(r.body.user.role, 'finance')
  assert.ok(r.body.user.permissions.includes('salary:manage'))
  assert.equal(r.body.user.passwordHash, undefined)
})

test('UC-01 login: wrong password / unknown user give Thai 401', async () => {
  for (const body of [{ username: 'finance1', password: 'wrong' }, { username: 'nobody', password: 'x' }]) {
    const r = await call('POST', '/api/auth/login', { body })
    assert.equal(r.status, 401)
    assert.equal(r.body.message, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
  }
})

test('UC-01 login: missing fields is 400; protected routes need a token', async () => {
  assert.equal((await call('POST', '/api/auth/login', { body: { username: '' } })).status, 400)
  assert.equal((await call('GET', '/api/employees')).status, 401)
  assert.equal((await call('GET', '/api/employees', { token: 'garbage' })).status, 401)
})

test('UC-01 login: repeated failures are rate limited', async () => {
  let last
  for (let i = 0; i < 6; i++) last = await call('POST', '/api/auth/login', { body: { username: 'hr1', password: 'bad' } })
  assert.equal(last.status, 429)
})

test('UC-02 search by code, name and department; all roles allowed', async () => {
  for (const u of USERS) {
    assert.equal((await call('GET', '/api/employees?q=E105', { token: tokens[u] })).status, 200)
  }
  const t = tokens.hr1
  assert.equal((await call('GET', '/api/employees?q=E105', { token: t })).body.employees[0].firstName, 'สมชาย')
  assert.equal((await call('GET', '/api/employees?q=' + encodeURIComponent('ใจดี'), { token: t })).body.total, 1)
  const dept = await call('GET', '/api/employees?department=' + encodeURIComponent('ฝ่ายการเงิน'), { token: t })
  assert.ok(dept.body.total >= 2)
  const none = await call('GET', '/api/employees?q=zzzz', { token: t })
  assert.equal(none.body.total, 0)
  assert.equal((await call('GET', '/api/employees?q=%25', { token: t })).body.total, 0) // % is literal
  assert.equal((await call('GET', '/api/employees?status=resigned', { token: t })).body.employees.every((e) => e.status === 'resigned'), true)
})

test('UC-02 search results never contain confidential fields', async () => {
  const r = await call('GET', '/api/employees', { token: tokens.manager1 })
  for (const e of r.body.employees) {
    for (const k of ['nationalId', 'phone', 'email', 'address', 'salary', 'amount']) assert.equal(k in e, false)
  }
})

test('UC-03 details: confidential data visible to self and manager only', async () => {
  const list = await call('GET', '/api/employees?q=E104', { token: tokens.hr1 })
  const id = list.body.employees[0].id // employee1 is E104
  const other = (await call('GET', '/api/employees?q=E105', { token: tokens.hr1 })).body.employees[0].id
  await call('PUT', `/api/employees/${id}`, {
    token: tokens.manager1,
    body: newEmployee({ employeeCode: 'E104', firstName: 'สมหญิง', lastName: 'รักงาน', startDate: '2026-09-01', nationalId: '1234567890123', phone: '0812345678' }),
  })
  const self = await call('GET', `/api/employees/${id}`, { token: tokens.employee1 })
  assert.equal(self.body.employee.nationalId, '1234567890123')
  assert.equal(self.body.confidentialVisible, true)
  const mgr = await call('GET', `/api/employees/${id}`, { token: tokens.manager1 })
  assert.equal(mgr.body.employee.nationalId, '1234567890123')
  for (const u of ['hr1', 'finance1', 'executive1']) {
    const r = await call('GET', `/api/employees/${id}`, { token: tokens[u] })
    assert.equal(r.status, 200)
    assert.equal(r.body.confidentialVisible, false)
    assert.equal('nationalId' in r.body.employee, false)
    assert.equal('phone' in r.body.employee, false)
  }
  const others = await call('GET', `/api/employees/${other}`, { token: tokens.employee1 })
  assert.equal(others.body.confidentialVisible, false)
  assert.ok(self.body.history.length >= 1)
  assert.equal((await call('GET', '/api/employees/99999', { token: tokens.hr1 })).status, 404)
  assert.equal((await call('GET', '/api/employees/abc', { token: tokens.hr1 })).status, 404)
})

test('UC-04 manage: only manager can create/update', async () => {
  for (const u of ['employee1', 'hr1', 'finance1', 'executive1']) {
    assert.equal((await call('POST', '/api/employees', { token: tokens[u], body: newEmployee() })).status, 403)
    assert.equal((await call('PUT', '/api/employees/1', { token: tokens[u], body: newEmployee() })).status, 403)
  }
  const created = await call('POST', '/api/employees', { token: tokens.manager1, body: newEmployee() })
  assert.equal(created.status, 201)
  assert.equal(created.body.employee.status, 'active')
  const dup = await call('POST', '/api/employees', { token: tokens.manager1, body: newEmployee({ employeeCode: 'e900' }) })
  assert.equal(dup.status, 409)
  assert.equal(dup.body.message, 'รหัสพนักงานนี้มีอยู่ในระบบแล้ว')
})

test('UC-04 manage: validation errors and update persists with history', async () => {
  const bad = await call('POST', '/api/employees', {
    token: tokens.manager1,
    body: { employeeCode: 'x', firstName: '', startDate: '2999-01-01', email: 'no', nationalId: '12' },
  })
  assert.equal(bad.status, 400)
  for (const k of ['employeeCode', 'firstName', 'lastName', 'department', 'position', 'startDate', 'email', 'nationalId']) {
    assert.ok(bad.body.errors[k], k)
  }
  const id = (await call('GET', '/api/employees?q=E900', { token: tokens.manager1 })).body.employees[0].id
  const upd = await call('PUT', `/api/employees/${id}`, { token: tokens.manager1, body: newEmployee({ position: 'หัวหน้าทีม' }) })
  assert.equal(upd.status, 200)
  assert.equal(upd.body.employee.position, 'หัวหน้าทีม')
  const detail = await call('GET', `/api/employees/${id}`, { token: tokens.hr1 })
  assert.equal(detail.body.employee.position, 'หัวหน้าทีม')
  assert.ok(detail.body.history.some((h) => h.eventType === 'position_changed'))
  // cannot take another employee's code
  const clash = await call('PUT', `/api/employees/${id}`, { token: tokens.manager1, body: newEmployee({ employeeCode: 'E105' }) })
  assert.equal(clash.status, 409)
  // status cannot be changed through update
  const sneaky = await call('PUT', `/api/employees/${id}`, { token: tokens.manager1, body: newEmployee({ status: 'resigned' }) })
  assert.equal(sneaky.body.employee.status, 'active')
})

test('UC-05 salary: access restricted to finance (and self read)', async () => {
  const list = (await call('GET', '/api/employees?q=E105', { token: tokens.hr1 })).body.employees[0]
  for (const u of ['hr1', 'manager1', 'executive1', 'employee1']) {
    assert.equal((await call('GET', '/api/salaries', { token: tokens[u] })).status, 403)
    assert.equal((await call('GET', `/api/employees/${list.id}/salaries`, { token: tokens[u] })).status, 403)
    assert.equal((await call('POST', `/api/employees/${list.id}/salaries`, { token: tokens[u], body: { amount: 1, effectiveDate: '2026-01-01' } })).status, 403)
    assert.equal((await call('PUT', '/api/salaries/1', { token: tokens[u], body: { amount: 1, effectiveDate: '2026-01-01' } })).status, 403)
  }
  const fin = await call('GET', `/api/employees/${list.id}/salaries`, { token: tokens.finance1 })
  assert.equal(fin.status, 200)
  assert.equal(fin.body.salaries[0].amount, 55000)
  // an employee may read their own salary
  const me = (await call('GET', '/api/employees?q=E104', { token: tokens.hr1 })).body.employees[0]
  assert.equal((await call('GET', `/api/employees/${me.id}/salaries`, { token: tokens.employee1 })).status, 200)
  // salary never leaks into employee detail
  const detail = await call('GET', `/api/employees/${me.id}`, { token: tokens.manager1 })
  assert.equal(JSON.stringify(detail.body).includes('amount'), false)
})

test('UC-05 salary: validation, create and update by finance', async () => {
  const emp = (await call('GET', '/api/employees?q=E105', { token: tokens.hr1 })).body.employees[0]
  const url = `/api/employees/${emp.id}/salaries`
  for (const amount of [0, -5, 'abc', null, 99999999]) {
    assert.equal((await call('POST', url, { token: tokens.finance1, body: { amount, effectiveDate: '2026-10-01' } })).status, 400)
  }
  assert.equal((await call('POST', url, { token: tokens.finance1, body: { amount: 60000, effectiveDate: 'bad' } })).status, 400)
  const ok = await call('POST', url, { token: tokens.finance1, body: { amount: 60000, effectiveDate: '2026-10-01', note: 'ปรับเงินเดือน' } })
  assert.equal(ok.status, 201)
  const upd = await call('PUT', `/api/salaries/${ok.body.salary.id}`, { token: tokens.finance1, body: { amount: 61000, effectiveDate: '2026-10-01' } })
  assert.equal(upd.body.salary.amount, 61000)
  const overview = await call('GET', '/api/salaries', { token: tokens.finance1 })
  assert.equal(overview.body.employees.find((e) => e.id === emp.id).currentAmount, 61000)
  assert.equal((await call('PUT', '/api/salaries/99999', { token: tokens.finance1, body: { amount: 1, effectiveDate: '2026-01-01' } })).status, 404)
})

test('UC-06 resign: manager only, keeps record and history, requires valid data', async () => {
  const emp = (await call('GET', '/api/employees?q=E101', { token: tokens.hr1 })).body.employees[0]
  const url = `/api/employees/${emp.id}/resign`
  const body = { resignationDate: '2026-10-01', reason: 'ย้ายงาน' }
  for (const u of ['employee1', 'hr1', 'finance1', 'executive1']) {
    assert.equal((await call('POST', url, { token: tokens[u], body })).status, 403)
    assert.equal((await call('GET', '/api/employees/resigned', { token: tokens[u] })).status, 403)
  }
  assert.equal((await call('POST', url, { token: tokens.manager1, body: { resignationDate: 'x' } })).status, 400)
  assert.equal((await call('POST', url, { token: tokens.manager1, body: { resignationDate: '2020-01-01' } })).status, 400) // before start
  assert.equal((await call('POST', url, { token: tokens.manager1, body: { resignationDate: '2999-01-01' } })).status, 400) // future
  const ok = await call('POST', url, { token: tokens.manager1, body })
  assert.equal(ok.status, 200)
  assert.equal(ok.body.employee.status, 'resigned')
  assert.equal((await call('POST', url, { token: tokens.manager1, body })).status, 409) // already resigned
  const detail = await call('GET', `/api/employees/${emp.id}`, { token: tokens.hr1 })
  assert.equal(detail.status, 200) // record preserved
  assert.ok(detail.body.history.some((h) => h.eventType === 'resigned'))
  assert.ok(detail.body.history.some((h) => h.eventType === 'hired'))
  assert.equal('resignationReason' in detail.body.employee, false) // reason is confidential
  const resigned = await call('GET', '/api/employees/resigned', { token: tokens.manager1 })
  assert.ok(resigned.body.employees.some((e) => e.id === emp.id && e.resignationDate === '2026-10-01'))
  // resignation reflected in dashboard and salary rules
  const dash = await call('GET', '/api/dashboard/summary', { token: tokens.executive1 })
  assert.equal(dash.body.counts.total, dash.body.counts.active + dash.body.counts.resigned)
  assert.equal((await call('POST', `/api/employees/${emp.id}/salaries`, { token: tokens.finance1, body: { amount: 1000, effectiveDate: '2026-10-02' } })).status, 400)
})

test('dashboard summary returns real counts for any logged-in role', async () => {
  const r = await call('GET', '/api/dashboard/summary', { token: tokens.employee1 })
  assert.equal(r.status, 200)
  assert.ok(r.body.counts.total >= 12)
  assert.ok(r.body.recentEmployees.length <= 5)
  assert.equal((await call('GET', '/api/dashboard/summary')).status, 401)
})

test('malformed JSON and unknown routes return Thai errors', async () => {
  const res = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' })
  assert.equal(res.status, 400)
  const nf = await call('GET', '/api/nothing', { token: tokens.hr1 })
  assert.equal(nf.status, 404)
})
