import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AppRoutes from '../AppRoutes'
import { resetDb } from '../mock/db'

// mock-token-N is the session token of the Nth demo user (see mock/seed.js)
const TOKENS = { manager1: 1, employee1: 2, hr1: 3, finance1: 4, executive1: 5 }
const OWN_ID = 5 // E104 = employee1
const OTHER_ID = 6 // E105
const STAFF = ['manager1', 'hr1', 'finance1', 'executive1']

const open = (username, path) => {
  localStorage.setItem('ems_token', `mock-token-${TOKENS[username]}`)
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}
const nav = () => within(screen.getByRole('navigation', { name: 'เมนูนำทาง' }))

beforeEach(() => {
  resetDb()
  localStorage.clear()
})

describe('employee role: own record only', () => {
  it('has no search menu, but keeps the history menu', async () => {
    open('employee1', '/dashboard')
    await screen.findByRole('heading', { name: 'หน้าหลัก' })
    expect(nav().queryByRole('link', { name: 'ค้นหาข้อมูลพนักงาน' })).not.toBeInTheDocument()
    expect(nav().getByRole('link', { name: 'ประวัติพนักงาน' })).toBeInTheDocument()
  })

  it('Employee Home hides the four organisation-wide sections', async () => {
    open('employee1', '/dashboard')
    await screen.findByText('สมหญิง รักงาน')
    for (const label of ['พนักงานทั้งหมด', 'พนักงานปฏิบัติงาน', 'พนักงานลาออก']) {
      expect(screen.queryByRole('heading', { name: label })).not.toBeInTheDocument()
    }
    expect(screen.queryByLabelText(/^\d+ คน$/)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'พนักงานล่าสุดที่เพิ่มในระบบ' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'สรุปจำนวนพนักงาน' })).not.toBeInTheDocument()
    expect(screen.queryByText('สมชาย ใจดี')).not.toBeInTheDocument() // no other employees
  })

  it('Employee Home shows personal information, announcements and important notices', async () => {
    open('employee1', '/dashboard')
    expect(await screen.findByText('สมหญิง รักงาน')).toBeInTheDocument()
    expect(screen.getByText('E104')).toBeInTheDocument()
    expect(screen.getByText('ผู้ตรวจสอบบัญชี')).toBeInTheDocument()
    expect(screen.getByText('ปฏิบัติงาน')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ดูประวัติการทำงานของฉัน/ })).toHaveAttribute('href', '/employees/history')
    expect(screen.getByRole('heading', { name: 'ข่าวสาร/ประกาศ' })).toBeInTheDocument()
    expect(screen.getByText('ประกาศวันหยุดประจำเดือนตุลาคม')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'การแจ้งเตือนสำคัญ' })).toBeInTheDocument()
    const hrefs = screen.getAllByRole('link').map((x) => x.getAttribute('href'))
    expect(hrefs).not.toContain('/employees/search')
    expect(hrefs.filter((h) => /^\/employees\/\d+$/.test(h))).toEqual([])
  })

  it('other roles keep the statistics and recent employees on their Home', async () => {
    for (const username of ['manager1', 'hr1', 'finance1', 'executive1']) {
      localStorage.clear()
      resetDb()
      const { unmount } = open(username, '/dashboard')
      expect(await screen.findByLabelText('20 คน')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'พนักงานล่าสุดที่เพิ่มในระบบ' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'ข่าวสาร/ประกาศ' })).toBeInTheDocument()
      unmount()
    }
  })

  it('cannot open /employees/search directly', async () => {
    open('employee1', '/employees/search')
    expect(await screen.findByRole('heading', { name: 'ไม่มีสิทธิ์เข้าถึง' })).toBeInTheDocument()
    expect(screen.queryByLabelText('ค้นหาพนักงาน')).not.toBeInTheDocument()
  })

  it('sees their own profile and history on /employees/history, without any list or search', async () => {
    open('employee1', '/employees/history')
    expect(await screen.findByRole('heading', { name: 'สมหญิง รักงาน' })).toBeInTheDocument()
    expect(screen.getAllByText('E104').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'ประวัติการทำงาน' })).toBeInTheDocument()
    expect(screen.getByText(/เริ่มงานในตำแหน่ง ผู้ตรวจสอบบัญชี/)).toBeInTheDocument()
    expect(screen.getByText(/^\d{13}$/)).toBeInTheDocument() // own national id is visible to its owner
    expect(screen.queryByLabelText('ค้นหาพนักงาน')).not.toBeInTheDocument()
    expect(screen.queryByText('สมชาย ใจดี')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'ข้อมูลเงินเดือน' })).not.toBeInTheDocument()
  })

  it("is denied another employee's record when changing the URL", async () => {
    open('employee1', `/employees/${OTHER_ID}`)
    expect(await screen.findByRole('heading', { name: 'ไม่มีสิทธิ์เข้าถึง' })).toBeInTheDocument()
    expect(screen.queryByText('สมชาย ใจดี')).not.toBeInTheDocument()
  })

  it('is redirected from their own /employees/:id to the history page', async () => {
    open('employee1', `/employees/${OWN_ID}`)
    expect(await screen.findByRole('heading', { name: 'ประวัติการทำงาน' })).toBeInTheDocument()
  })

  it('mobile navigation follows the same restrictions', async () => {
    const user = userEvent.setup()
    open('employee1', '/dashboard')
    await screen.findByRole('heading', { name: 'หน้าหลัก' })
    await user.click(screen.getByRole('button', { name: 'เปิดเมนู' }))
    const sidebar = within(document.getElementById('app-sidebar'))
    expect(sidebar.queryByRole('link', { name: 'ค้นหาข้อมูลพนักงาน' })).not.toBeInTheDocument()
    expect(sidebar.getByRole('link', { name: 'ประวัติพนักงาน' })).toBeInTheDocument()
  })
})

describe('other roles keep their access', () => {
  it.each(STAFF)('%s can search and sees all employees', async (username) => {
    open(username, '/employees/search')
    expect(await screen.findByLabelText('ค้นหาพนักงาน')).toBeInTheDocument()
    expect(await screen.findByText('สมชาย ใจดี')).toBeInTheDocument()
  })

  it.each(STAFF)('%s sees the employee list on the history page', async (username) => {
    open(username, '/employees/history')
    expect(await screen.findByLabelText('ค้นหาพนักงาน')).toBeInTheDocument()
  })

  it.each(STAFF)('%s can open another employee profile', async (username) => {
    open(username, `/employees/${OTHER_ID}`)
    expect(await screen.findByRole('heading', { name: 'สมชาย ใจดี' })).toBeInTheDocument()
  })

  it('dashboard still lists recent employees for managers', async () => {
    open('manager1', '/dashboard')
    expect(await screen.findByRole('heading', { name: 'พนักงานล่าสุดที่เพิ่มในระบบ' })).toBeInTheDocument()
  })
})

describe('direct URL navigation respects the roles', () => {
  it('HR and executive cannot open management or salary pages', async () => {
    for (const [username, path] of [['hr1', '/salaries'], ['hr1', '/employees'], ['hr1', '/resigned'], ['executive1', '/salaries'], ['executive1', '/employees'], ['executive1', '/resigned']]) {
      localStorage.clear()
      resetDb()
      const { unmount } = open(username, path)
      expect(await screen.findByRole('heading', { name: 'ไม่มีสิทธิ์เข้าถึง' })).toBeInTheDocument()
      unmount()
    }
  })

  it('manager and finance keep their own pages', async () => {
    for (const [username, path, heading] of [['manager1', '/employees', 'จัดการข้อมูลพนักงาน'], ['manager1', '/resigned', 'พนักงานที่ลาออก'], ['finance1', '/salaries', 'จัดการเงินเดือน']]) {
      localStorage.clear()
      resetDb()
      const { unmount } = open(username, path)
      expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
      unmount()
    }
  })

  it('the management form shows the department as a fixed read-only value', async () => {
    const user = userEvent.setup()
    open('manager1', '/employees')
    await user.click(await screen.findByRole('button', { name: /เพิ่มพนักงาน/ }))
    const dept = within(screen.getByRole('dialog')).getByLabelText(/แผนก/)
    expect(dept).toHaveValue('ตรวจสอบบัญชี')
    expect(dept).toHaveAttribute('readonly')
  })
})
