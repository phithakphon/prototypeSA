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
  it('counts only the Accounting Audit Department: 20 staff, 17 active, 3 resigned', async () => {
    const r = await call('/dashboard/summary', as('hr1'))
    expect(r.counts).toEqual({ total: 20, active: 17, resigned: 3 })
    expect(r.recentEmployees).toHaveLength(5)
  })
})

describe('mock API: search and details', () => {
  it('searches by code and name', async () => {
    expect((await call('/employees?q=E105', as('hr1'))).employees[0].firstName).toBe('สมชาย')
    expect((await call(`/employees?q=${encodeURIComponent('ใจดี')}`, as('hr1'))).total).toBeGreaterThanOrEqual(1)
    expect((await call('/employees?q=zzzz', as('hr1'))).total).toBe(0)
  })
  it('only ever returns the Accounting Audit Department and ignores a department filter', async () => {
    for (const u of ['manager1', 'hr1', 'finance1', 'executive1']) {
      const all = await call('/employees', as(u))
      expect(all.total).toBe(20)
      expect(all.employees.every((e) => e.department === 'ตรวจสอบบัญชี')).toBe(true)
    }
    const forced = await call(`/employees?department=${encodeURIComponent('ฝ่ายการเงิน')}`, as('hr1'))
    expect(forced.employees.every((e) => e.department === 'ตรวจสอบบัญชี')).toBe(true)
    // employees of other departments (e.g. E301 finance) are not searchable or openable
    expect((await call('/employees?q=E301', as('hr1'))).total).toBe(0)
    expect((await call('/employees/departments', as('hr1'))).departments).toEqual(['ตรวจสอบบัญชี'])
  })
  it('HR and executive see full personal information (read-only); finance does not', async () => {
    const id = (await call('/employees?q=E105', as('hr1'))).employees[0].id
    for (const u of ['hr1', 'executive1', 'manager1']) {
      const r = await call(`/employees/${id}`, as(u))
      expect(r.confidentialVisible).toBe(true)
      expect(r.employee.nationalId).toBeTruthy()
      expect(r.employee.phone).toBeTruthy()
      expect(r.history.length).toBeGreaterThan(0)
    }
    expect('nationalId' in (await call(`/employees/${id}`, as('finance1'))).employee).toBe(false)
  })
  it('lets the owner read their own confidential data', async () => {
    const id = (await call('/employees?q=E104', as('hr1'))).employees[0].id
    expect((await call(`/employees/${id}`, as('employee1'))).employee.nationalId).toBeTruthy()
  })
  it('HR and executive cannot create or edit employees', async () => {
    const id = (await call('/employees?q=E105', as('hr1'))).employees[0].id
    for (const u of ['hr1', 'executive1']) {
      await expect(call('/employees', { method: 'POST', body: newEmployee(), ...as(u) })).rejects.toMatchObject({ status: 403 })
      await expect(call(`/employees/${id}`, { method: 'PUT', body: newEmployee({ employeeCode: 'E105' }), ...as(u) })).rejects.toMatchObject({ status: 403 })
      await expect(call(`/employees/${id}/resign`, { method: 'POST', body: { resignationDate: '2026-10-01' }, ...as(u) })).rejects.toMatchObject({ status: 403 })
    }
  })
  it('the department is fixed on create and edit, whatever the client sends', async () => {
    const ok = await call('/employees', { method: 'POST', body: newEmployee({ department: 'ฝ่ายการเงิน' }), ...as('manager1') })
    expect(ok.employee.department).toBe('ตรวจสอบบัญชี')
    const upd = await call(`/employees/${ok.employee.id}`, { method: 'PUT', body: newEmployee({ department: 'ฝ่ายบริหาร' }), ...as('manager1') })
    expect(upd.employee.department).toBe('ตรวจสอบบัญชี')
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
  it('HR can read salaries (read-only); manager, executive and others cannot', async () => {
    const e105 = (await call('/employees?q=E105', as('hr1'))).employees[0].id
    const hr = await call(`/employees/${e105}/salaries`, as('hr1'))
    expect(hr.salaries[0].amount).toBe(55000)
    expect(hr.canManage).toBe(false)
    for (const u of ['manager1', 'executive1', 'employee1']) {
      await expect(call(`/employees/${e105}/salaries`, as(u))).rejects.toMatchObject({ status: 403 })
    }
    expect((await call(`/employees/${e105}/salaries`, as('finance1'))).canManage).toBe(true)
    const own = (await call('/employees?q=E104', as('hr1'))).employees[0].id
    expect((await call(`/employees/${own}/salaries`, as('employee1'))).salaries.length).toBeGreaterThan(0)
  })
  it('only finance can use the salary overview or change salary records (HR cannot)', async () => {
    const e105 = (await call('/employees?q=E105', as('hr1'))).employees[0].id
    const body = { amount: 1, effectiveDate: '2026-01-01' }
    for (const u of ['hr1', 'manager1', 'executive1', 'employee1']) {
      await expect(call('/salaries', as(u))).rejects.toMatchObject({ status: 403 })
      await expect(call(`/employees/${e105}/salaries`, { method: 'POST', body, ...as(u) })).rejects.toMatchObject({ status: 403 })
      await expect(call('/salaries/1', { method: 'PUT', body, ...as(u) })).rejects.toMatchObject({ status: 403 })
    }
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
    expect((await call('/dashboard/summary', as('hr1'))).counts.resigned).toBe(4)
    const list = await call('/employees/resigned', as('manager1'))
    expect(list.employees.find((e) => e.id === id).resignationReason).toBe('ย้ายงาน')
    await expect(call(`/employees/${id}/resign`, { method: 'POST', body: { resignationDate: '2026-10-02' }, ...as('manager1') }))
      .rejects.toMatchObject({ status: 409 })
    await call(`/employees/${id}/reinstate`, { method: 'POST', ...as('manager1') })
    expect((await call('/dashboard/summary', as('hr1'))).counts.resigned).toBe(3)
    const d = await call(`/employees/${id}`, as('hr1'))
    expect(d.history.map((h) => h.eventType)).toEqual(expect.arrayContaining(['hired', 'resigned', 'reinstated']))
  })
})

describe('mock API: employee role is limited to its own record', () => {
  it('cannot search or list employees', async () => {
    await expect(call('/employees', as('employee1'))).rejects.toMatchObject({ status: 403 })
    await expect(call('/employees?q=E105', as('employee1'))).rejects.toMatchObject({ status: 403 })
    await expect(call('/employees/departments', as('employee1'))).rejects.toMatchObject({ status: 403 })
  })
  it('can read only its own details and history', async () => {
    const own = (await call('/employees?q=E104', as('hr1'))).employees[0].id
    const other = (await call('/employees?q=E105', as('hr1'))).employees[0].id
    const mine = await call(`/employees/${own}`, as('employee1'))
    expect(mine.employee.employeeCode).toBe('E104')
    expect(mine.history.length).toBeGreaterThan(0)
    await expect(call(`/employees/${other}`, as('employee1'))).rejects.toMatchObject({ status: 403, message: 'คุณดูได้เฉพาะข้อมูลของตนเองเท่านั้น' })
    await expect(call(`/employees/${other}/salaries`, as('employee1'))).rejects.toMatchObject({ status: 403 })
  })
  it('gets no organisation-wide statistics and no list of other employees on the dashboard', async () => {
    const d = await call('/dashboard/summary', as('employee1'))
    expect(d.counts).toBeNull()
    expect(d.recentEmployees).toEqual([])
  })
  it('other roles keep their access', async () => {
    const staff = ['manager1', 'hr1', 'finance1', 'executive1']
    const other = (await call('/employees?q=E105', as('hr1'))).employees[0].id
    for (const u of staff) {
      expect((await call('/employees?q=E105', as(u))).total).toBe(1)
      expect((await call('/dashboard/summary', as(u))).recentEmployees).toHaveLength(5)
      expect((await call(`/employees/${other}`, as(u))).employee.employeeCode).toBe('E105')
    }
  })
})
