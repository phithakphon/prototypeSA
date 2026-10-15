import { expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AppRoutes from '../src/AppRoutes'
import { api, USE_MOCK, setToken } from '../src/api'

const mount = (path) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>)

it('logs in, displays PostgreSQL dashboard, creates/edits via UI and restores data after remount', async () => {
  expect(USE_MOCK).toBe(false)
  localStorage.clear()
  const user = userEvent.setup()
  const view = mount('/login')
  await user.type(screen.getByLabelText('ชื่อผู้ใช้'), 'manager1')
  await user.type(screen.getByLabelText('รหัสผ่าน'), 'Passw0rd!')
  await user.click(screen.getByRole('button', { name: /เข้าสู่ระบบ/ }))
  await screen.findByRole('heading', { name: 'หน้าหลัก' }, { timeout: 5000 })
  expect(await screen.findByLabelText('6 คน')).toBeInTheDocument()
  expect(screen.getByText('ประกาศวันหยุดประจำเดือนตุลาคม')).toBeInTheDocument()
  await user.click(within(screen.getByRole('navigation', { name: 'เมนูนำทาง' })).getByRole('link', { name: 'จัดการข้อมูลพนักงาน' }))
  await user.click(await screen.findByRole('button', { name: /เพิ่มพนักงาน/ }))
  const form = within(screen.getByRole('dialog'))
  for (const [label, value] of [
    [/รหัสพนักงาน/, 'PG900'], [/^ชื่อ \*/, 'Postgres'], [/นามสกุล/, 'Saved'],
    [/ตำแหน่ง/, 'Auditor'], [/วันที่เริ่มงาน/, '2020-01-01'],
  ]) await user.type(form.getByLabelText(label), value)
  await user.click(form.getByRole('button', { name: 'บันทึก' }))
  await screen.findByText('เพิ่มพนักงานใหม่เรียบร้อยแล้ว')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await user.type(screen.getByLabelText('ค้นหาพนักงาน'), 'PG900')
  await screen.findByText('Postgres Saved')
  await user.click(await screen.findByRole('button', { name: 'แก้ไข' }))
  const position = await screen.findByLabelText(/ตำแหน่ง/)
  const edit = within(screen.getByRole('dialog'))
  await user.clear(position)
  await user.type(position, 'Senior Auditor')
  await user.click(edit.getByRole('button', { name: 'บันทึก' }))
  await screen.findByText('บันทึกการแก้ไขข้อมูลพนักงานแล้ว')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  const saved = await api('/employees?q=PG900')
  expect(saved.employees[0].position).toBe('Senior Auditor')
  view.unmount()
  mount(`/employees/${saved.employees[0].id}`)
  await screen.findByRole('heading', { name: 'Postgres Saved' })
  expect(screen.getByText('Senior Auditor')).toBeInTheDocument()
  expect(screen.getByText(/เปลี่ยนตำแหน่งจาก Auditor เป็น Senior Auditor/)).toBeInTheDocument()
})


it('reports backend connection failure without returning mock records', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network unavailable'))
  try {
    await expect(api('/employees')).rejects.toMatchObject({ status: 0, message: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' })
  } finally { fetchSpy.mockRestore() }
})

it('shows session restoration errors and retains the token during an outage', async () => {
  const originalToken = localStorage.getItem('ems_token')
  expect(originalToken).toBeTruthy()
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network unavailable'))
  try {
    mount('/dashboard')
    expect(await screen.findByText('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')).toBeInTheDocument()
    expect(localStorage.getItem('ems_token')).toBe(originalToken)
    // retry succeeds once the backend is reachable again, without logging in again
    fetchSpy.mockRestore()
    await userEvent.setup().click(screen.getByRole('button', { name: 'ลองอีกครั้ง' }))
    await screen.findByRole('heading', { name: 'หน้าหลัก' }, { timeout: 5000 })
  } finally { fetchSpy.mockRestore() }
})

it('a confirmed 401 signs the user out and clears the token', async () => {
  localStorage.setItem('ems_token', 'not-a-valid-token')
  mount('/dashboard')
  await screen.findByLabelText('ชื่อผู้ใช้')
  expect(localStorage.getItem('ems_token')).toBeNull()
})


it('employee and HR navigation uses real backend permissions and scoped data', async () => {
  const signIn = async (username) => {
    const result = await api('/auth/login', { method: 'POST', body: { username, password: 'Passw0rd!' } })
    setToken(result.token)
    return result.user
  }
  const employee = await signIn('employee1')
  expect(employee.permissions).toContain('employee:selfOnly')
  const ownView = mount('/dashboard')
  expect(await screen.findByText('สมหญิง รักงาน')).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'สรุปจำนวนพนักงาน' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'ค้นหาข้อมูลพนักงาน' })).not.toBeInTheDocument()
  // 'การแจ้งเตือนสำคัญ' needs an `important` announcement flag that only the mock seed has (not the PostgreSQL schema)
  await expect(api('/employees')).rejects.toMatchObject({ status: 403 })
  ownView.unmount()
  const hr = await signIn('hr1')
  expect(hr.permissions).toContain('salary:view')
  expect(hr.permissions).not.toContain('salary:manage')
  const result = await api('/employees?q=E105')
  mount(`/employees/${result.employees[0].id}`)
  await screen.findByRole('heading', { name: 'สมชาย ใจดี' })
  expect(await screen.findByText(/55,000/)).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'จัดการเงินเดือน' })).not.toBeInTheDocument()
})

it('evaluations: manager reads and saves via PostgreSQL; employee is limited to their own record', async () => {
  const signIn = async (username) => {
    const result = await api('/auth/login', { method: 'POST', body: { username, password: 'Passw0rd!' } })
    setToken(result.token)
    return result.user
  }
  const manager = await signIn('manager1')
  expect(manager.permissions).toContain('evaluation:manage')
  const before = await api('/evaluations?employeeCode=E101')
  const saved = await api('/evaluations', {
    method: 'POST',
    body: { employeeCode: 'E101', evaluationPeriod: 'integration', evaluationDate: '2026-10-10', evaluatorName: 'Test', scores: [3, 3, 3, 3, 3, 3] },
  })
  expect(saved.evaluation.totalScore).toBe(18)
  expect((await api('/evaluations?employeeCode=E101')).evaluations).toHaveLength(before.evaluations.length + 1)
  await signIn('employee1')
  await expect(api('/evaluations?employeeCode=E101')).rejects.toMatchObject({ status: 403 })
  expect((await api('/evaluations?employeeCode=E104')).evaluations).toEqual([expect.objectContaining({ evaluationPeriod: expect.stringContaining('ข้อมูลตัวอย่าง') })])
  await expect(api('/evaluations', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 403 })
  await signIn('hr1')
  await expect(api('/evaluations?employeeCode=E104')).rejects.toMatchObject({ status: 403 })
})
