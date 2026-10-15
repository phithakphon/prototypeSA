import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AppRoutes from '../AppRoutes'
import { resetDb } from '../mock/db'
import { DEMO_PASSWORD } from '../mock/seed'

const renderApp = (path = '/login') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )

async function signIn(user, username) {
  await user.type(screen.getByLabelText('ชื่อผู้ใช้'), username)
  await user.type(screen.getByLabelText('รหัสผ่าน'), DEMO_PASSWORD)
  await user.click(screen.getByRole('button', { name: /เข้าสู่ระบบ/ }))
  await screen.findByRole('heading', { name: 'หน้าหลัก' }, { timeout: 4000 })
}

async function loginAndOpen(username, linkName) {
  const user = userEvent.setup()
  renderApp()
  await signIn(user, username)
  if (linkName) await user.click(within(screen.getByRole('navigation', { name: 'เมนูนำทาง' })).getByRole('link', { name: linkName }))
  return user
}

const TOKENS = { manager1: 1, employee1: 2, hr1: 3, finance1: 4, executive1: 5 }
async function openAs(username, path) {
  localStorage.setItem('ems_token', `mock-token-${TOKENS[username]}`)
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  resetDb()
  localStorage.clear()
})

describe('UC-01 login', () => {
  it('shows Thai validation messages for empty fields', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: /เข้าสู่ระบบ/ }))
    expect(await screen.findByText('กรุณากรอกชื่อผู้ใช้')).toBeInTheDocument()
    expect(screen.getByText('กรุณากรอกรหัสผ่าน')).toBeInTheDocument()
  })

  it('shows an error for wrong credentials', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.type(screen.getByLabelText('ชื่อผู้ใช้'), 'manager1')
    await user.type(screen.getByLabelText('รหัสผ่าน'), 'wrong')
    await user.click(screen.getByRole('button', { name: /เข้าสู่ระบบ/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
  })

  it('toggles password visibility', async () => {
    const user = userEvent.setup()
    renderApp()
    const field = screen.getByLabelText('รหัสผ่าน')
    expect(field).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'แสดงรหัสผ่าน' }))
    expect(field).toHaveAttribute('type', 'text')
  })

  it('fills a demo account and signs in to the dashboard', async () => {
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getByRole('button', { name: 'ผู้จัดการแผนกตรวจสอบบัญชี' }))
    await user.click(screen.getByRole('button', { name: /เข้าสู่ระบบ/ }))
    expect(await screen.findByText('สวัสดี, คุณรัตนายุ', {}, { timeout: 4000 })).toBeInTheDocument()
  })

  it('redirects unauthenticated visitors to the login page', async () => {
    renderApp('/employees')
    expect(await screen.findByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument()
  })
})

describe('dashboard', () => {
  it('renders statistics, recent employees and announcements from mock data', async () => {
    await loginAndOpen('hr1')
    expect(screen.getByLabelText('20 คน')).toBeInTheDocument()
    expect(screen.getByLabelText('17 คน')).toBeInTheDocument()
    expect(screen.getByLabelText('3 คน')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'พนักงานล่าสุดที่เพิ่มในระบบ' })).toBeInTheDocument()
    expect(screen.getByText('ประกาศวันหยุดประจำเดือนตุลาคม')).toBeInTheDocument()
  })
})

describe('role-based navigation (demo simulation)', () => {
  it.each([
    ['manager1', ['ค้นหาข้อมูลพนักงาน', 'จัดการข้อมูลพนักงาน', 'พนักงานที่ลาออก', 'ผลการประเมิน'], ['จัดการเงินเดือน']],
    ['hr1', ['ค้นหาข้อมูลพนักงาน'], ['จัดการข้อมูลพนักงาน', 'จัดการเงินเดือน', 'พนักงานที่ลาออก', 'ผลการประเมิน']],
    ['finance1', ['ค้นหาข้อมูลพนักงาน', 'จัดการเงินเดือน'], ['จัดการข้อมูลพนักงาน', 'พนักงานที่ลาออก', 'ผลการประเมิน']],
    ['executive1', ['ค้นหาข้อมูลพนักงาน'], ['จัดการข้อมูลพนักงาน', 'จัดการเงินเดือน', 'พนักงานที่ลาออก', 'ผลการประเมิน']],
    ['employee1', ['ผลการประเมิน'], ['ค้นหาข้อมูลพนักงาน', 'จัดการข้อมูลพนักงาน', 'จัดการเงินเดือน', 'พนักงานที่ลาออก']],
  ])('%s sees the right menu', async (username, shown, hidden) => {
    await loginAndOpen(username)
    const nav = within(screen.getByRole('navigation', { name: 'เมนูนำทาง' }))
    for (const name of ['หน้าหลัก', 'ประวัติพนักงาน', ...shown]) {
      expect(nav.getByRole('link', { name })).toBeInTheDocument()
    }
    for (const name of hidden) expect(nav.queryByRole('link', { name })).not.toBeInTheDocument()
  })

  it('opens and closes the mobile sidebar with the hamburger button', async () => {
    const user = await loginAndOpen('hr1')
    const burger = screen.getByRole('button', { name: 'เปิดเมนู' })
    expect(burger).toHaveAttribute('aria-expanded', 'false')
    await user.click(burger)
    expect(screen.getByRole('button', { name: 'ปิดเมนู', expanded: true })).toBeInTheDocument()
    expect(document.getElementById('app-sidebar')).toHaveClass('is-open')
    await user.keyboard('{Escape}')
    expect(document.getElementById('app-sidebar')).not.toHaveClass('is-open')
  })
})

describe('UC-02 / UC-03 search and profile', () => {
  it('filters employees and shows the empty state', async () => {
    const user = await loginAndOpen('hr1', 'ค้นหาข้อมูลพนักงาน')
    const box = await screen.findByLabelText('ค้นหาพนักงาน')
    await user.type(box, 'E105')
    expect(await screen.findByText('สมชาย ใจดี')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('วิชัย มั่นคง')).not.toBeInTheDocument())
    await user.clear(box)
    await user.type(box, 'zzzz')
    expect(await screen.findByText('ไม่พบพนักงานที่ตรงกับเงื่อนไขการค้นหา')).toBeInTheDocument()
  })

  it('HR sees the full personal information and the salary amount, read-only', async () => {
    const user = await loginAndOpen('hr1', 'ค้นหาข้อมูลพนักงาน')
    await user.type(await screen.findByLabelText('ค้นหาพนักงาน'), 'E105')
    await user.click(await screen.findByRole('link', { name: /ดูรายละเอียด/ }))
    expect(await screen.findByRole('heading', { name: 'สมชาย ใจดี' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ประวัติพนักงาน' })).toBeInTheDocument()
    expect(screen.getByText('เลขบัตรประชาชน')).toBeInTheDocument()
    expect(screen.getByText(/^\d{13}$/)).toBeInTheDocument() // unmasked
    expect(screen.queryByText(/ข้อมูลส่วนบุคคลเป็นความลับ/)).not.toBeInTheDocument()
    expect(await screen.findByText(/55,000/)).toBeInTheDocument() // real salary amount
    expect(screen.queryByLabelText('ข้อมูลถูกปกปิด')).not.toBeInTheDocument()
    // read-only: no edit / add controls for salary
    expect(screen.queryByRole('button', { name: /แก้ไข|เพิ่ม|ลบ/ })).not.toBeInTheDocument()
  })

  it('executive sees personal information but the salary stays masked', async () => {
    const user = await loginAndOpen('executive1', 'ค้นหาข้อมูลพนักงาน')
    await user.type(await screen.findByLabelText('ค้นหาพนักงาน'), 'E105')
    await user.click(await screen.findByRole('link', { name: /ดูรายละเอียด/ }))
    expect(await screen.findByRole('heading', { name: 'สมชาย ใจดี' })).toBeInTheDocument()
    expect(screen.getByText(/^\d{13}$/)).toBeInTheDocument()
    expect(screen.getByLabelText('ข้อมูลถูกปกปิด')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /แก้ไข|เพิ่ม|ลบ/ })).not.toBeInTheDocument()
  })

  it('finance cannot see personal information but can see salary', async () => {
    const user = await loginAndOpen('finance1', 'ค้นหาข้อมูลพนักงาน')
    await user.type(await screen.findByLabelText('ค้นหาพนักงาน'), 'E105')
    await user.click(await screen.findByRole('link', { name: /ดูรายละเอียด/ }))
    expect(await screen.findByRole('heading', { name: 'สมชาย ใจดี' })).toBeInTheDocument()
    expect(screen.getByText(/ข้อมูลส่วนบุคคลเป็นความลับ/)).toBeInTheDocument()
    expect(await screen.findByText(/55,000/)).toBeInTheDocument()
  })

  it('has no department dropdown, for every role', async () => {
    for (const username of ['manager1', 'hr1', 'finance1', 'executive1']) {
      localStorage.clear()
      resetDb()
      const { unmount } = await openAs(username, '/employees/search')
      await screen.findByLabelText('ค้นหาพนักงาน')
      expect(screen.queryByRole('combobox', { name: /แผนก/ })).not.toBeInTheDocument()
      expect(screen.queryByText('ทุกแผนก')).not.toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: 'กรองตามสถานะ' })).toBeInTheDocument() // status filter remains
      unmount()
    }
  })

  it('search only lists Accounting Audit Department employees', async () => {
    const user = await loginAndOpen('hr1', 'ค้นหาข้อมูลพนักงาน')
    await user.type(await screen.findByLabelText('ค้นหาพนักงาน'), 'E301')
    expect(await screen.findByText('ไม่พบพนักงานที่ตรงกับเงื่อนไขการค้นหา')).toBeInTheDocument()
  })
})

describe('UC-04 manage employees', () => {
  it('validates the form, adds an employee and shows a toast', async () => {
    const user = await loginAndOpen('manager1', 'จัดการข้อมูลพนักงาน')
    await user.click(await screen.findByRole('button', { name: /เพิ่มพนักงาน/ }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'บันทึก' }))
    expect(await within(dialog).findByText('กรุณากรอกรหัสพนักงาน')).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText(/รหัสพนักงาน/), 'E900')
    await user.type(within(dialog).getByLabelText(/^ชื่อ \*/), 'ทดสอบ')
    await user.type(within(dialog).getByLabelText(/นามสกุล/), 'ระบบ')
    expect(within(dialog).getByLabelText(/แผนก/)).toHaveValue('ตรวจสอบบัญชี')
    expect(within(dialog).getByLabelText(/แผนก/)).toHaveAttribute('readonly')
    await user.type(within(dialog).getByLabelText(/ตำแหน่ง/), 'ผู้ตรวจสอบบัญชี')
    await user.type(within(dialog).getByLabelText(/วันที่เริ่มงาน/), '2026-01-05')
    await user.click(within(dialog).getByRole('button', { name: 'บันทึก' }))
    expect(await screen.findByText('เพิ่มพนักงานใหม่เรียบร้อยแล้ว')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows a duplicate-code error from the server layer', async () => {
    const user = await loginAndOpen('manager1', 'จัดการข้อมูลพนักงาน')
    await user.click(await screen.findByRole('button', { name: /เพิ่มพนักงาน/ }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/รหัสพนักงาน/), 'E105')
    await user.type(within(dialog).getByLabelText(/^ชื่อ \*/), 'ก')
    await user.type(within(dialog).getByLabelText(/นามสกุล/), 'ข')
    await user.type(within(dialog).getByLabelText(/ตำแหน่ง/), 'ก')
    await user.type(within(dialog).getByLabelText(/วันที่เริ่มงาน/), '2026-01-05')
    await user.click(within(dialog).getByRole('button', { name: 'บันทึก' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('รหัสพนักงานนี้มีอยู่ในระบบแล้ว')
  })
})

describe('UC-06 resignation workflow', () => {
  it('requires confirmation, then moves the employee to the resigned list', async () => {
    const user = await loginAndOpen('manager1', 'จัดการข้อมูลพนักงาน')
    await user.type(await screen.findByLabelText('ค้นหาพนักงาน'), 'E101')
    await user.click(await screen.findByRole('button', { name: /แจ้งลาออก/ }))
    await user.click(screen.getByRole('button', { name: 'ดำเนินการต่อ' }))
    const confirm = await screen.findByRole('dialog', { name: 'ยืนยันการลาออก' })
    await user.click(within(confirm).getByRole('button', { name: 'ยืนยันการลาออก' }))
    expect(await screen.findByText(/บันทึกการลาออกของ ประเสริฐ ศรีสุข/)).toBeInTheDocument()

    await user.click(within(screen.getByRole('navigation', { name: 'เมนูนำทาง' })).getByRole('link', { name: 'พนักงานที่ลาออก' }))
    expect(await screen.findByText('ประเสริฐ ศรีสุข')).toBeInTheDocument()
  })

  it('can filter the resigned list and reinstate with confirmation', async () => {
    const user = await loginAndOpen('manager1', 'พนักงานที่ลาออก')
    await screen.findByText('นภา สว่างใจ')
    await user.type(screen.getByLabelText('ค้นหาพนักงานที่ลาออก'), 'E111')
    expect(screen.queryByText('นภา สว่างใจ')).not.toBeInTheDocument()
    expect(screen.getByText('พิมพ์ชนก ทองคำ')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /กลับเข้าทำงาน/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'ยืนยัน' }))
    expect(await screen.findByText(/กลับเข้าปฏิบัติงานแล้ว/)).toBeInTheDocument()
  })
})

describe('UC-05 salary management', () => {
  it('shows salary summary, edits a salary and shows validation errors', async () => {
    const user = await loginAndOpen('finance1', 'จัดการเงินเดือน')
    expect(await screen.findByText('เงินเดือนรวมต่อเดือน (พนักงานปฏิบัติงาน)')).toBeInTheDocument()
    await user.type(screen.getByLabelText('ค้นหาพนักงาน'), 'E105')
    await user.click(await screen.findByRole('button', { name: /จัดการ/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(await within(dialog).findByLabelText(/เงินเดือน \(บาท\)/), '-5')
    await user.click(within(dialog).getByRole('button', { name: 'เพิ่มรายการ' }))
    expect(await within(dialog).findByText('เงินเดือนต้องมากกว่า 0')).toBeInTheDocument()

    const amount = within(dialog).getByLabelText(/เงินเดือน \(บาท\)/)
    await user.clear(amount)
    await user.type(amount, '60000')
    await user.click(within(dialog).getByRole('button', { name: 'เพิ่มรายการ' }))
    expect(await screen.findByText('เพิ่มข้อมูลเงินเดือนแล้ว')).toBeInTheDocument()
  })

  it('shows a no-permission page when a non-finance role opens the route directly', async () => {
    localStorage.setItem('ems_token', 'mock-token-3') // hr1 (restored session)
    renderApp('/salaries')
    expect(await screen.findByRole('heading', { name: 'ไม่มีสิทธิ์เข้าถึง' })).toBeInTheDocument()
  })
})
