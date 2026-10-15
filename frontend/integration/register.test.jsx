import { expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AppRoutes from '../src/AppRoutes'
import { api, USE_MOCK } from '../src/api'

const mount = (path) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>)
async function fill(user, username) {
  await user.type(screen.getByLabelText('ชื่อผู้ใช้'), username)
  await user.type(screen.getByLabelText('รหัสผ่าน'), 'Secret123')
  await user.type(screen.getByLabelText('ยืนยันรหัสผ่าน'), 'Secret123')
}

it('registers via PostgreSQL as an unlinked employee without extra permissions, and logs in after remount', async () => {
  expect(USE_MOCK).toBe(false)
  localStorage.clear()
  const user = userEvent.setup()
  const view = mount('/register')
  await fill(user, 'ui.registration')
  await user.click(screen.getByRole('button', { name: 'สมัครบัญชี' }))
  await screen.findByRole('heading', { name: 'สมัครบัญชีสำเร็จ' }, { timeout: 5000 })
  expect(screen.getByText('พนักงาน', { selector: 'strong' })).toBeInTheDocument()
  expect(screen.queryByText('โหมดสาธิต')).not.toBeInTheDocument()
  view.unmount()
  const nextView = mount('/login')
  await user.type(screen.getByLabelText('ชื่อผู้ใช้'), 'ui.registration')
  await user.type(screen.getByLabelText('รหัสผ่าน'), 'Secret123')
  await user.click(screen.getByRole('button', { name: /เข้าสู่ระบบ/ }))
  await screen.findByRole('heading', { name: 'หน้าหลัก' }, { timeout: 5000 })
  expect(await screen.findByText('บัญชีนี้ยังไม่ได้เชื่อมกับข้อมูลพนักงาน')).toBeInTheDocument()
  const me = (await api('/auth/me')).user
  expect(me.role).toBe('employee')
  expect(me.employeeId).toBeNull()
  expect(me.permissions).not.toContain('salary:manage')
  await expect(api('/salaries')).rejects.toMatchObject({ status: 403 })
  nextView.unmount()
  mount('/dashboard')
  expect(await screen.findByText('บัญชีนี้ยังไม่ได้เชื่อมกับข้อมูลพนักงาน')).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('link', { name: 'จัดการเงินเดือน' })).not.toBeInTheDocument())
})

it('displays a field-specific Thai duplicate error from the real backend', async () => {
  localStorage.clear()
  const user = userEvent.setup()
  mount('/register')
  await fill(user, 'Manager1')
  await user.click(screen.getByRole('button', { name: 'สมัครบัญชี' }))
  expect(await screen.findByText(/ชื่อผู้ใช้นี้ถูกใช้แล้ว/)).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'สมัครบัญชีสำเร็จ' })).not.toBeInTheDocument()
})
