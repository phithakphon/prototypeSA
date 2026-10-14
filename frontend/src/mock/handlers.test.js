import { beforeEach, describe, expect, it } from 'vitest'
import { mockRequest } from './handlers'
import { resetDb } from './db'
import { DEMO_PASSWORD } from './seed'

const tokens = {}
const call = (path, opts = {}) => mockRequest(path, opts)
const as = (user) => ({ token: tokens[user] })

beforeEach(async () => {
  resetDb()
  for (const u of ['employee1', 'manager1', 'hr1', 'finance1', 'executive1']) {
    tokens[u] = (await call('/auth/login', { method: 'POST', body: { username: u, password: DEMO_PASSWORD } })).token
  }
})

const newEmployee = (over = {}) => ({
  employeeCode: 'E900', firstName: 'ทดสอบ', lastName: 'ระบบ', department: 'ตรวจสอบบัญชี',
  position: 'ผู้ตรวจสอบบัญชี', startDate: '2026-01-05', ...over,
})

describe('mock API: auth', () => {
  it('rejects bad credentials with a Thai message', async () => {
    await expect(call('/auth/login', { method: 'POST', body: { username: 'manager1', password: 'x' } }))
      .rejects.toMatchObject({ status: 401, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' })
  })
  it('requires a token for protected routes', async () => {
    await expect(call('/employees')).rejects.toMatchObject({ status: 401 })
  })
  it('seeds 39 employees: 35 active and 4 resigned', async () => {
    const r = await call('/dashboard/summary', as('hr1'))
    expect(r.counts).toEqual({ total: 39, active: 35, resigned: 4 })
    expect(r.recentEmployees).toHaveLength(5)
  })
})

describe('mock API: search and details', () => {
  it('searches by code, name and department', async () => {
    expect((await call('/employees?q=E105', as('hr1'))).employees[0].firstName).toBe('สมชาย')
    expect((await call(`/employees?q=${encodeURIComponent('ใจดี')}`, as('hr1'))).total).toBeGreaterThanOrEqual(1)
    const dept = await call(`/employees?department=${encodeURIComponent('ฝ่ายการเงิน')}`, as('hr1'))
    expect(dept.employees.every((e) => e.department === 'ฝ่ายการเงิน')).toBe(true)
    expect((await call('/employees?q=zzzz', as('hr1'))).total).toBe(0)
  })
  it('hides confidential fields from other roles but not from self/manager', async () => {
    const id = (await call('/employees?q=E104', as('hr1'))).employees[0].id
    expect('nationalId' in (await call(`/employees/${id}`, as('hr1'))).employee).toBe(false)
    expect((await call(`/employees/${id}`, as('employee1'))).employee.nationalId).toBeTruthy()
    expect((await call(`/employees/${id}`, as('manager1'))).employee.nationalId).toBeTruthy()
  })
})

describe('mock API: manage employees', () => {
  it('only the manager can create; duplicates and invalid data are rejected', async () => {
    await expect(call('/employees', { method: 'POST', body: newEmployee(), ...as('hr1') })).rejects.toMatchObject({ status: 403 })
    const ok = await call('/employees', { method: 'POST', body: newEmployee(), ...as('manager1') })
    expect(ok.employee.employeeCode).toBe('E900')
    await expect(call('/employees', { method: 'POST', body: newEmployee({ employeeCode: 'e900' }), ...as('manager1') }))
      .rejects.toMatchObject({ status: 409 })
    const bad = call('/employees', { method: 'POST', body: { employeeCode: 'x' }, ...as('manager1') })
    await expect(bad).rejects.toMatchObject({ status: 400 })
    await bad.catch((e) => expect(Object.keys(e.errors)).toEqual(expect.arrayContaining(['firstName', 'startDate'])))
  })
  it('edits persist and add history', async () => {
    const id = (await call('/employees?q=E105', as('manager1'))).employees[0].id
    await call(`/employees/${id}`, { method: 'PUT', body: newEmployee({ employeeCode: 'E105', position: 'หัวหน้าทีม' }), ...as('manager1') })
    const d = await call(`/employees/${id}`, as('hr1'))
    expect(d.employee.position).toBe('หัวหน้าทีม')
    expect(d.history.some((h) => h.eventType === 'position_changed')).toBe(true)
  })
})

describe('mock API: salary', () => {
  it('is limited to finance (and own record read)', async () => {
    const e105 = (await call('/employees?q=E105', as('hr1'))).employees[0].id
    for (const u of ['hr1', 'manager1', 'executive1', 'employee1']) {
      await expect(call('/salaries', as(u))).rejects.toMatchObject({ status: 403 })
      await expect(call(`/employees/${e105}/salaries`, as(u))).rejects.toMatchObject({ status: 403 })
    }
    const own = (await call('/employees?q=E104', as('hr1'))).employees[0].id
    expect((await call(`/employees/${own}/salaries`, as('employee1'))).salaries.length).toBeGreaterThan(0)
  })
  it('validates and saves salary changes', async () => {
    const id = (await call('/employees?q=E105', as('hr1'))).employees[0].id
    await expect(call(`/employees/${id}/salaries`, { method: 'POST', body: { amount: -1, effectiveDate: '2026-10-01' }, ...as('finance1') }))
      .rejects.toMatchObject({ status: 400 })
    const ok = await call(`/employees/${id}/salaries`, { method: 'POST', body: { amount: 60000, effectiveDate: '2026-10-01' }, ...as('finance1') })
    await call(`/salaries/${ok.salary.id}`, { method: 'PUT', body: { amount: 61000, effectiveDate: '2026-10-01' }, ...as('finance1') })
    const list = await call('/salaries', as('finance1'))
    expect(list.employees.find((e) => e.id === id).currentAmount).toBe(61000)
  })
})

describe('mock API: resignation', () => {
  it('resign keeps the record + history, then can be reinstated', async () => {
    const id = (await call('/employees?q=E101', as('manager1'))).employees[0].id
    await expect(call(`/employees/${id}/resign`, { method: 'POST', body: { resignationDate: '2026-10-01' }, ...as('hr1') }))
      .rejects.toMatchObject({ status: 403 })
    await expect(call(`/employees/${id}/resign`, { method: 'POST', body: { resignationDate: '2020-01-01' }, ...as('manager1') }))
      .rejects.toMatchObject({ status: 400 })
    await call(`/employees/${id}/resign`, { method: 'POST', body: { resignationDate: '2026-10-01', reason: 'ย้ายงาน' }, ...as('manager1') })
    expect((await call('/dashboard/summary', as('hr1'))).counts.resigned).toBe(5)
    const list = await call('/employees/resigned', as('manager1'))
    expect(list.employees.find((e) => e.id === id).resignationReason).toBe('ย้ายงาน')
    await expect(call(`/employees/${id}/resign`, { method: 'POST', body: { resignationDate: '2026-10-02' }, ...as('manager1') }))
      .rejects.toMatchObject({ status: 409 })
    await call(`/employees/${id}/reinstate`, { method: 'POST', ...as('manager1') })
    expect((await call('/dashboard/summary', as('hr1'))).counts.resigned).toBe(4)
    const d = await call(`/employees/${id}`, as('hr1'))
    expect(d.history.map((h) => h.eventType)).toEqual(expect.arrayContaining(['hired', 'resigned', 'reinstated']))
  })
})
