import { beforeEach, expect, it } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AppRoutes from '../AppRoutes'
import { resetDb } from '../mock/db'

beforeEach(() => { resetDb(); localStorage.clear(); localStorage.setItem('ems_token', 'mock-token-1') })
it('requires exact employee ID search before showing records and supports clear', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={['/evaluations']}><AppRoutes /></MemoryRouter>)
  await screen.findByRole('heading', { name: 'ผลการประเมินพนักงาน' })
  expect(screen.getByRole('button', { name: 'ค้นหา' })).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'ดูผลการประเมิน' })).not.toBeInTheDocument()
  await user.type(screen.getByLabelText('รหัสพนักงาน'), 'UNKNOWN{Enter}')
  expect(await screen.findByRole('alert')).toHaveTextContent('ไม่พบข้อมูลพนักงาน')
  await user.clear(screen.getByLabelText('รหัสพนักงาน'))
  await user.type(screen.getByLabelText('รหัสพนักงาน'), 'E106{Enter}')
  await user.click(await screen.findByRole('button', { name: 'ดูผลการประเมิน' }))
  expect(await screen.findByText('ยังไม่มีผลการประเมินสำหรับพนักงานรายนี้')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'ปิดหน้าต่าง' }))
  await user.click(screen.getByRole('button', { name: 'ล้างข้อมูล' }))
  expect(screen.getByLabelText('รหัสพนักงาน')).toHaveValue('')
})

it('shows selected employee and recalculates all six scores without claiming a demo save', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={['/evaluations']}><AppRoutes /></MemoryRouter>)
  await user.click(await screen.findByRole('button', { name: '+ เพิ่มการประเมิน' }))
  const dialog = screen.getByRole('dialog')
  const form = within(dialog)
  expect(form.getByRole('button', { name: 'บันทึกผลการประเมิน' })).toBeDisabled()
  await user.type(form.getByLabelText('รหัสพนักงาน'), 'E104{Enter}')
  await user.click(await form.findByRole('button', { name: 'เลือกพนักงาน' }))
  expect(form.getByRole('button', { name: 'เปลี่ยนพนักงาน' })).toBeInTheDocument()
  expect(form.getByText('คะแนนรวม: 18 / 30 · ระดับผลการประเมิน: ดี')).toBeInTheDocument()
  for (const select of form.getAllByRole('combobox')) await user.selectOptions(select, '5')
  expect(form.getByText('คะแนนรวม: 30 / 30 · ระดับผลการประเมิน: ดีเยี่ยม')).toBeInTheDocument()
  expect(form.getByRole('button', { name: 'บันทึกผลการประเมิน' })).toBeDisabled()
  expect(screen.queryByText('บันทึกผลการประเมินสำเร็จ')).not.toBeInTheDocument()
})

it('displays Thai E100 history after remount and opens the correct E103 record', async () => {
  const user = userEvent.setup()
  const app = () => <MemoryRouter initialEntries={['/evaluations']}><AppRoutes /></MemoryRouter>
  let view = render(app())
  async function open(code) {
    const input = await screen.findByLabelText('รหัสพนักงาน')
    await user.clear(input)
    await user.type(input, `${code}{Enter}`)
    await user.click(await screen.findByRole('button', { name: 'ดูผลการประเมิน' }))
    await screen.findByRole('heading', { name: 'รายละเอียดผลการประเมิน' })
    return within(screen.getByRole('dialog'))
  }
  let dialog = await open('E100')
  expect(await dialog.findByText('คะแนนรวม: 29 / 30 · ระดับผลการประเมิน: ดีเยี่ยม')).toBeInTheDocument()
  expect(dialog.getByText('คะแนนรวม: 25 / 30 · ระดับผลการประเมิน: ดีมาก')).toBeInTheDocument()
  expect(dialog.getByText('ประวัติการประเมิน')).toBeInTheDocument()
  expect(dialog.getAllByText('คุณภาพและความเรียบร้อยของงาน')).toHaveLength(2)
  expect(dialog.getByText(/รหัสพนักงาน: E100/)).toHaveTextContent('รัตนายุ วงศ์สกุล')
  expect(dialog.queryByText(/Excellent|Employee|Evaluation|None recorded/)).not.toBeInTheDocument()
  view.unmount()
  resetDb() // equivalent to recreating the mock data source on page refresh
  view = render(app())
  dialog = await open('E100')
  expect(await dialog.findByText('คะแนนรวม: 29 / 30 · ระดับผลการประเมิน: ดีเยี่ยม')).toBeInTheDocument()
  await user.click(dialog.getByRole('button', { name: 'ปิดหน้าต่าง' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  dialog = await open('E103')
  expect(await dialog.findByText('คะแนนรวม: 9 / 30 · ระดับผลการประเมิน: ต้องปรับปรุงเร่งด่วน')).toBeInTheDocument()
  expect(dialog.getByText(/รหัสพนักงาน: E103/)).toHaveTextContent('วิชัย มั่นคง')
  expect(dialog.queryByText(/รัตนายุ/)).not.toBeInTheDocument()
})
