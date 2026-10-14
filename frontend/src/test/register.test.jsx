import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AppRoutes from '../AppRoutes'
import { db, resetDb } from '../mock/db'
import { mockRequest } from '../mock/handlers'

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )

const GOOD = { username: 'somchai.j', password: 'Secret123' }

async function fillForm(user, values = {}) {
  const v = { ...GOOD, confirmPassword: values.password ?? GOOD.password, ...values }
  await user.type(screen.getByLabelText('ชื่อผู้ใช้'), v.username)
  await user.type(screen.getByLabelText('รหัสผ่าน'), v.password)
  await user.type(screen.getByLabelText('ยืนยันรหัสผ่าน'), v.confirmPassword)
}
const submit = (user) => user.click(screen.getByRole('button', { name: 'สมัครบัญชี' }))

beforeEach(() => {
  resetDb()
  localStorage.clear()
})

describe('registration page', () => {
  it('renders the branding and only the username and password fields, without any role selection', async () => {
    renderAt('/register')
    expect(screen.getByRole('heading', { level: 1, name: 'เริ่มต้นใช้งานระบบ' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'สมัครบัญชีใหม่' })).toBeInTheDocument()
    expect(screen.getByText('บริษัท ศุภชัยสอบบัญชี')).toBeInTheDocument()
    expect(screen.getByText('SUPACHAI AUDITING CO., LTD.')).toBeInTheDocument()
    for (const label of ['ชื่อผู้ใช้', 'รหัสผ่าน', 'ยืนยันรหัสผ่าน']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
    // employee ID and email were removed from the form on request
    expect(screen.queryByLabelText('รหัสพนักงาน')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('อีเมล')).not.toBeInTheDocument()
    // security: the user can never choose a role
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/บทบาท|สิทธิ์|role/i)).not.toBeInTheDocument()
    expect(screen.getByText(/ได้รับสิทธิ์เป็น "พนักงาน" เท่านั้น/)).toBeInTheDocument()
    expect(screen.getByText(/การสมัครนี้เป็นการจำลอง/)).toBeInTheDocument() // mock mode is clearly labelled
  })

  it('shows a Thai message under every empty required field and focuses the first one', async () => {
    const user = userEvent.setup()
    renderAt('/register')
    await submit(user)
    for (const msg of ['กรุณากรอกชื่อผู้ใช้', 'กรุณากรอกรหัสผ่าน', 'กรุณายืนยันรหัสผ่าน']) {
      expect(await screen.findByText(msg)).toBeInTheDocument()
    }
    expect(screen.getByLabelText('ชื่อผู้ใช้')).toHaveFocus()
    expect(screen.getByLabelText('ชื่อผู้ใช้')).toHaveAttribute('aria-invalid', 'true')
  })

  it('validates the username length and characters, and the password strength rules', async () => {
    const user = userEvent.setup()
    renderAt('/register')
    await user.type(screen.getByLabelText('ชื่อผู้ใช้'), 'ab')
    await user.type(screen.getByLabelText('รหัสผ่าน'), 'abc')
    await user.tab()
    expect(screen.getByText('ชื่อผู้ใช้ต้องมีอย่างน้อย 4 ตัวอักษร')).toBeInTheDocument()
    expect(screen.getByText(/รหัสผ่านยังไม่ครบเงื่อนไข/)).toBeInTheDocument()
    await user.clear(screen.getByLabelText('ชื่อผู้ใช้'))
    await user.type(screen.getByLabelText('ชื่อผู้ใช้'), '1abc def')
    await user.tab()
    expect(await screen.findByText(/ชื่อผู้ใช้ต้องขึ้นต้นด้วยตัวอักษร/)).toBeInTheDocument()
  })

  it('requires the password confirmation to match', async () => {
    const user = userEvent.setup()
    renderAt('/register')
    await user.type(screen.getByLabelText('รหัสผ่าน'), 'Secret123')
    await user.type(screen.getByLabelText('ยืนยันรหัสผ่าน'), 'Secret124')
    await user.tab()
    expect(await screen.findByText('รหัสผ่านที่ยืนยันไม่ตรงกัน')).toBeInTheDocument()
    await user.clear(screen.getByLabelText('ยืนยันรหัสผ่าน'))
    await user.type(screen.getByLabelText('ยืนยันรหัสผ่าน'), 'Secret123')
    await waitFor(() => expect(screen.queryByText('รหัสผ่านที่ยืนยันไม่ตรงกัน')).not.toBeInTheDocument())
  })

  it('toggles the visibility of both password fields independently', async () => {
    const user = userEvent.setup()
    renderAt('/register')
    const pw = screen.getByLabelText('รหัสผ่าน')
    const confirm = screen.getByLabelText('ยืนยันรหัสผ่าน')
    expect(pw).toHaveAttribute('type', 'password')
    const [pwToggle, confirmToggle] = screen.getAllByRole('button', { name: 'แสดงรหัสผ่าน' })
    await user.click(pwToggle)
    expect(pw).toHaveAttribute('type', 'text')
    expect(confirm).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'ซ่อนรหัสผ่าน' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(confirmToggle)
    expect(confirm).toHaveAttribute('type', 'text')
  })

  it('shows password requirements and a strength indicator that updates', async () => {
    const user = userEvent.setup()
    renderAt('/register')
    const pw = screen.getByLabelText('รหัสผ่าน')
    expect(screen.getByText('ยาวอย่างน้อย 8 ตัวอักษร')).toBeInTheDocument()
    await user.type(pw, 'abc')
    expect(screen.getByText('อ่อน')).toBeInTheDocument()
    await user.clear(pw)
    await user.type(pw, 'Secret123')
    expect(screen.getByText('พอใช้')).toBeInTheDocument()
    await user.clear(pw)
    await user.type(pw, 'Secret123!Xyz')
    expect(screen.getByText('แข็งแรงมาก')).toBeInTheDocument()
  })

  it('gives positive feedback (text + icon) for a valid field', async () => {
    const user = userEvent.setup()
    renderAt('/register')
    await user.type(screen.getByLabelText('ชื่อผู้ใช้'), 'good.user')
    await user.tab()
    expect(await screen.findByText('กรอกถูกต้อง')).toBeInTheDocument()
  })
})

describe('navigation between login and registration', () => {
  it('login -> register -> login', async () => {
    const user = userEvent.setup()
    renderAt('/login')
    expect(screen.getByText(/ยังไม่มีบัญชี\?/)).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'สมัครบัญชีใหม่' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'สมัครบัญชีใหม่' })).toBeInTheDocument()
    expect(screen.getByText(/มีบัญชีอยู่แล้ว\?/)).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'เข้าสู่ระบบ' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'เข้าสู่ระบบ' })).toBeInTheDocument()
  })

  it('the back button returns to the login page', async () => {
    const user = userEvent.setup()
    renderAt('/register')
    await user.click(screen.getByRole('link', { name: 'ย้อนกลับ' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'เข้าสู่ระบบ' })).toBeInTheDocument()
  })

  it('keeps the existing login page working (demo accounts)', async () => {
    renderAt('/login')
    expect(screen.getByRole('button', { name: 'ผู้จัดการแผนกตรวจสอบบัญชี' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /เข้าสู่ระบบ/ })).toBeInTheDocument()
  })

  it('signed-in users are redirected away from /register', async () => {
    localStorage.setItem('ems_token', 'mock-token-1')
    renderAt('/register')
    expect(await screen.findByRole('heading', { name: 'หน้าหลัก' })).toBeInTheDocument()
  })
})

describe('registration outcomes (mock adapter)', () => {
  it('creates an employee-role account, then that account can sign in and sees no employee data', async () => {
    const user = userEvent.setup()
    renderAt('/register')
    await fillForm(user)
    await submit(user)
    expect(await screen.findByRole('heading', { name: 'สมัครบัญชีสำเร็จ' })).toBeInTheDocument()
    expect(screen.getByText('พนักงาน', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText(/ไม่ได้สร้างบัญชีถาวรในระบบจริง/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ไปหน้าเข้าสู่ระบบ' }))
    expect(await screen.findByText(/สมัครบัญชี somchai.j เรียบร้อยแล้ว/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('ชื่อผู้ใช้'), 'somchai.j')
    await user.type(screen.getByLabelText('รหัสผ่าน'), 'Secret123')
    await user.click(screen.getByRole('button', { name: /เข้าสู่ระบบ/ }))
    expect(await screen.findByText('พนักงาน', { selector: '.profile-text span' }, { timeout: 4000 })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'หน้าหลัก' })).toBeInTheDocument()
    // not linked to an employee record: no personal data, no organisation statistics, no employee list
    expect(await screen.findByText('บัญชีนี้ยังไม่ได้เชื่อมกับข้อมูลพนักงาน')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'พนักงานล่าสุดที่เพิ่มในระบบ' })).not.toBeInTheDocument()
    expect(screen.queryByText('สมชาย ใจดี')).not.toBeInTheDocument()
  })

  it('never stores the password in localStorage and clears the form after success', async () => {
    const user = userEvent.setup()
    renderAt('/register')
    await fillForm(user)
    await submit(user)
    await screen.findByRole('heading', { name: 'สมัครบัญชีสำเร็จ' })
    expect(JSON.stringify({ ...localStorage })).not.toContain('Secret123')
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('Secret123')
  })

  it('rejects a username that is already taken (case-insensitive) and creates nothing', async () => {
    const user = userEvent.setup()
    const before = db.users.length
    renderAt('/register')
    await fillForm(user, { username: 'Manager1' })
    await submit(user)
    expect(await screen.findByText(/ชื่อผู้ใช้นี้ถูกใช้แล้ว/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'สมัครบัญชีสำเร็จ' })).not.toBeInTheDocument()
    expect(db.users).toHaveLength(before)
  })

  it('creates only one account when the submit button is pressed twice', async () => {
    const user = userEvent.setup()
    renderAt('/register')
    await fillForm(user)
    await user.dblClick(screen.getByRole('button', { name: 'สมัครบัญชี' }))
    await screen.findByRole('heading', { name: 'สมัครบัญชีสำเร็จ' })
    expect(db.users.filter((u) => u.username === 'somchai.j')).toHaveLength(1)
    expect(screen.queryByText(/ชื่อผู้ใช้นี้ถูกใช้แล้ว/)).not.toBeInTheDocument()
  })

  it('goes through the loading state and ends in the success state', async () => {
    const user = userEvent.setup()
    renderAt('/register')
    await fillForm(user)
    await submit(user)
    await screen.findByRole('heading', { name: 'สมัครบัญชีสำเร็จ' })
    expect(screen.queryByRole('button', { name: 'สมัครบัญชี' })).not.toBeInTheDocument()
  })
})

describe('registration security rules (mock API)', () => {
  const body = (over = {}) => ({ ...GOOD, confirmPassword: GOOD.password, ...over })

  it('always creates the employee role, ignoring any role sent by the client', async () => {
    for (const role of ['manager', 'hr', 'finance', 'executive', 'admin']) {
      resetDb()
      const res = await mockRequest('/auth/register', { method: 'POST', body: body({ role, roles: [role], isAdmin: true }) })
      expect(res.role).toBe('employee')
      expect(db.users.find((u) => u.username === GOOD.username).role).toBe('employee')
    }
  })

  it('never returns the password and does not link the account to any employee', async () => {
    const res = await mockRequest('/auth/register', { method: 'POST', body: body({ employeeId: 1, employeeCode: 'E100' }) })
    expect(JSON.stringify(res)).not.toContain('Secret123')
    expect(db.users.find((u) => u.username === GOOD.username).employeeId).toBeNull() // client cannot pick an employee
  })

  it('validates on the server side as well', async () => {
    await expect(mockRequest('/auth/register', { method: 'POST', body: body({ password: 'short', confirmPassword: 'short' }) }))
      .rejects.toMatchObject({ status: 400 })
    await expect(mockRequest('/auth/register', { method: 'POST', body: body({ confirmPassword: 'Different1' }) }))
      .rejects.toMatchObject({ status: 400 })
    await expect(mockRequest('/auth/register', { method: 'POST', body: body({ username: 'a b' }) }))
      .rejects.toMatchObject({ status: 400 })
  })

  it('uses 409 for a duplicate username', async () => {
    await mockRequest('/auth/register', { method: 'POST', body: body() })
    await expect(mockRequest('/auth/register', { method: 'POST', body: body({ username: 'SOMCHAI.J' }) }))
      .rejects.toMatchObject({ status: 409, errors: { username: expect.any(String) } })
  })

  it('a self-registered account has minimal permissions and cannot read any employee', async () => {
    await mockRequest('/auth/register', { method: 'POST', body: body() })
    const login = await mockRequest('/auth/login', { method: 'POST', body: { username: 'somchai.j', password: 'Secret123' } })
    expect(login.user.role).toBe('employee')
    expect(login.user.displayName).toBe('somchai.j')
    for (const p of ['employee:manage', 'salary:manage', 'salary:view', 'employee:search', 'employee:viewConfidential']) {
      expect(login.user.permissions).not.toContain(p)
    }
    expect(login.user.permissions).toContain('employee:selfOnly')
    const token = login.token
    await expect(mockRequest('/employees', { token })).rejects.toMatchObject({ status: 403 })
    await expect(mockRequest('/employees/1', { token })).rejects.toMatchObject({ status: 403 })
    await expect(mockRequest('/employees/1/salaries', { token })).rejects.toMatchObject({ status: 403 })
    const mgr = await mockRequest('/auth/login', { method: 'POST', body: { username: 'manager1', password: 'Passw0rd!' } })
    expect(mgr.user.role).toBe('manager')
  })
})
