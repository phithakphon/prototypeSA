import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AppRoutes from '../AppRoutes'
import { resetDb } from '../mock/db'
import { mockRequest } from '../mock/handlers'

// mock-token-N is the session token of the Nth demo user (see mock/seed.js)
const TOKENS = { manager1: 1, employee1: 2, hr1: 3, finance1: 4, executive1: 5 }
const PASSWORD = 'Str0ngPassw0rd'

const open = (username, path) => {
  localStorage.setItem('ems_token', `mock-token-${TOKENS[username]}`)
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}
const nav = () => within(screen.getByRole('navigation', { name: 'เมนูนำทาง' }))
const register = (username) =>
  mockRequest('/auth/register', { method: 'POST', body: { username, password: PASSWORD, confirmPassword: PASSWORD } })

beforeEach(() => {
  resetDb()
  localStorage.clear()
})

describe('account linking (HR only)', () => {
  it('HR sees the menu item', async () => {
    open('hr1', '/dashboard')
    await screen.findByRole('heading', { name: 'หน้าหลัก' })
    expect(nav().getByRole('link', { name: 'ผูกบัญชีผู้ใช้' })).toBeInTheDocument()
  })

  it.each(['manager1', 'finance1', 'executive1', 'employee1'])('%s has no menu item and is denied the page', async (u) => {
    open(u, '/accounts')
    await screen.findByRole('heading', { name: 'ไม่มีสิทธิ์เข้าถึง' })
    expect(nav().queryByRole('link', { name: 'ผูกบัญชีผู้ใช้' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'ผูกบัญชีผู้ใช้กับพนักงาน' })).not.toBeInTheDocument()
  })

  it('links a pending account after the employee code is re-typed', async () => {
    await register('newhire01')
    const user = userEvent.setup()
    open('hr1', '/accounts')
    await screen.findByRole('heading', { name: 'ผูกบัญชีผู้ใช้กับพนักงาน' })
    expect(await screen.findByText('newhire01')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /ผูกกับพนักงาน/ }))
    const dialog = await screen.findByRole('dialog')
    // already-linked employees (E100, E104) are not offered
    await within(dialog).findByText(/E105/)
    expect(within(dialog).queryByText(/E104/)).not.toBeInTheDocument()
    expect(within(dialog).queryByText(/E100/)).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('radio', { name: /E105/ }))
    await user.type(within(dialog).getByLabelText(/พิมพ์รหัสพนักงาน/), 'E101')
    await user.click(within(dialog).getByRole('button', { name: 'ยืนยันการผูกบัญชี' }))
    expect(await within(dialog).findByText('รหัสพนักงานไม่ตรงกับพนักงานที่เลือก')).toBeInTheDocument()

    const field = within(dialog).getByLabelText(/พิมพ์รหัสพนักงาน/)
    await user.clear(field)
    await user.type(field, 'e105')
    await user.click(within(dialog).getByRole('button', { name: 'ยืนยันการผูกบัญชี' }))
    expect(await screen.findByText('ไม่มีบัญชีที่รอตรวจสอบ')).toBeInTheDocument()

  })
})

describe('unlinking an account (HR)', () => {
  const linkedTable = () => screen.getByRole('region', { name: 'บัญชีที่ผูกกับพนักงานแล้ว' })

  it('shows linked employee-role accounts only, never privileged ones', async () => {
    open('hr1', '/accounts')
    const table = await screen.findByRole('region', { name: 'บัญชีที่ผูกกับพนักงานแล้ว' })
    expect(within(table).getByText('employee1')).toBeInTheDocument()
    expect(within(table).queryByText('manager1')).not.toBeInTheDocument()
    expect(within(table).queryByText('hr1')).not.toBeInTheDocument()
  })

  it('asks for confirmation, can be cancelled without any change, then unlinks', async () => {
    const user = userEvent.setup()
    open('hr1', '/accounts')
    await screen.findByRole('region', { name: 'บัญชีที่ผูกกับพนักงานแล้ว' })

    await user.click(within(linkedTable()).getByRole('button', { name: 'ยกเลิกการผูกบัญชี employee1' }))
    let dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/ผู้ใช้จะมองไม่เห็นข้อมูล/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'ยกเลิก' }))
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(within(linkedTable()).getByText('employee1')).toBeInTheDocument() // nothing changed

    await user.click(within(linkedTable()).getByRole('button', { name: 'ยกเลิกการผูกบัญชี employee1' }))
    dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'ยกเลิกการผูก' }))
    // the account moves to the pending list and the linked list no longer contains it
    expect(await screen.findByRole('region', { name: 'บัญชีที่รอผูกกับพนักงาน' })).toBeInTheDocument()
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(within(screen.getByRole('region', { name: 'บัญชีที่รอผูกกับพนักงาน' })).getByText('employee1')).toBeInTheDocument()
  })

  it('shows the server error inside the dialog and keeps it open when unlinking fails', async () => {
    const user = userEvent.setup()
    open('hr1', '/accounts')
    await screen.findByRole('region', { name: 'บัญชีที่ผูกกับพนักงานแล้ว' })
    await user.click(within(linkedTable()).getByRole('button', { name: 'ยกเลิกการผูกบัญชี employee1' }))
    const dialog = await screen.findByRole('dialog')
    // someone else unlinks it first, so this request is a conflict
    await mockRequest('/accounts/2/unlink', { method: 'POST', token: 'mock-token-3' })
    await user.click(within(dialog).getByRole('button', { name: 'ยกเลิกการผูก' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('บัญชีนี้ยังไม่ได้ผูกกับพนักงาน')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'ยกเลิกการผูก' })).toBeEnabled() // not stuck in the loading state
  })

  it('mock refuses non-HR roles and privileged accounts', async () => {
    const status = (p) => p.then(() => 200, (e) => e.status)
    for (const t of ['mock-token-1', 'mock-token-2', 'mock-token-4', 'mock-token-5']) {
      expect(await status(mockRequest('/accounts/linked', { token: t }))).toBe(403)
      expect(await status(mockRequest('/accounts/2/unlink', { method: 'POST', token: t }))).toBe(403)
    }
    expect(await status(mockRequest('/accounts/1/unlink', { method: 'POST', token: 'mock-token-3' }))).toBe(403) // manager
    expect(await status(mockRequest('/accounts/99/unlink', { method: 'POST', token: 'mock-token-3' }))).toBe(404)
  })
})

describe('account linking API contract (mock mirrors the backend)', () => {
  const hr = { token: 'mock-token-3' }
  const link = (id, body, token = hr.token) => mockRequest(`/accounts/${id}/link`, { method: 'POST', body, token })
  const status = async (p) => p.then(() => 200, (e) => e.status)

  it('refuses everyone but HR, privileged accounts, claimed/other-department employees and wrong codes', async () => {
    await register('victim001')
    const { accounts } = await mockRequest('/accounts/pending', hr)
    const id = accounts[0].id
    const { employees } = await mockRequest('/accounts/linkable-employees', hr)
    const e105 = employees.find((e) => e.employeeCode === 'E105')

    for (const t of ['mock-token-1', 'mock-token-2', 'mock-token-4', 'mock-token-5']) {
      expect(await status(mockRequest('/accounts/pending', { token: t }))).toBe(403)
      expect(await status(link(id, { employeeId: e105.id, employeeCode: 'E105' }, t))).toBe(403)
    }
    expect(await status(link(id, { employeeId: e105.id, employeeCode: 'E101' }))).toBe(400)
    expect(await status(link(1, { employeeId: e105.id, employeeCode: 'E105' }))).toBe(403) // manager account
    expect(await status(link(id, { employeeId: 1, employeeCode: 'E100' }))).toBe(409) // already has an account
    expect(await status(link(id, { employeeId: 7, employeeCode: 'E201' }))).toBe(404) // other department
    expect(await status(link(id, { employeeId: 'x', employeeCode: 'E105' }))).toBe(400)
    expect(await status(link(3, { employeeId: e105.id, employeeCode: 'E105' }))).toBe(403) // HR cannot link itself
    // role in the body is ignored
    expect(await status(link(id, { employeeId: e105.id, employeeCode: 'E105', role: 'manager' }))).toBe(200)
    const me = (await mockRequest('/accounts/pending', hr)).accounts
    expect(me.find((a) => a.id === id)).toBeUndefined()
    expect(await status(link(id, { employeeId: e105.id, employeeCode: 'E105' }))).toBe(409)
  })
})
