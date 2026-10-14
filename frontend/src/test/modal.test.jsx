import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AppRoutes from '../AppRoutes'
import { resetDb } from '../mock/db'

async function openEditModal() {
  localStorage.setItem('ems_token', 'mock-token-1') // manager1
  render(
    <MemoryRouter initialEntries={['/employees']}>
      <AppRoutes />
    </MemoryRouter>,
  )
  const user = userEvent.setup()
  const editButton = (await screen.findAllByRole('button', { name: /แก้ไข/ }))[0]
  await user.click(editButton)
  const dialog = await screen.findByRole('dialog', { name: 'แก้ไขข้อมูลพนักงาน' })
  return { user, dialog, editButton }
}

beforeEach(() => {
  resetDb()
  localStorage.clear()
  document.body.removeAttribute('style')
})

describe('employee edit modal', () => {
  it('is an accessible dialog with a scrollable body and a footer outside it', async () => {
    const { dialog } = await openEditModal()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName('แก้ไขข้อมูลพนักงาน')
    const body = dialog.querySelector('.modal-body')
    const footer = dialog.querySelector('.modal-foot')
    expect(body).toContainElement(screen.getByLabelText(/รหัสพนักงาน/))
    // Save / Cancel live in the fixed footer, not inside the scrolling body
    expect(footer).toContainElement(within(dialog).getByRole('button', { name: 'บันทึก' }))
    expect(footer).toContainElement(within(dialog).getByRole('button', { name: /ยกเลิก/ }))
    expect(body).not.toContainElement(within(dialog).getByRole('button', { name: 'บันทึก' }))
    expect(dialog.querySelector('.modal-head')).toContainElement(within(dialog).getByRole('button', { name: 'ปิดหน้าต่าง' }))
  })

  it('locks page scrolling while open and restores it afterwards', async () => {
    const { user, dialog } = await openEditModal()
    expect(document.body.style.overflow).toBe('hidden')
    await user.click(within(dialog).getByRole('button', { name: 'ปิดหน้าต่าง' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(document.body.style.overflow).toBe('')
  })

  it('closes with Escape and returns focus to the Edit button', async () => {
    const { user, editButton } = await openEditModal()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(editButton).toHaveFocus()
  })

  it('keeps keyboard focus inside the dialog', async () => {
    const { user, dialog } = await openEditModal()
    const save = within(dialog).getByRole('button', { name: 'บันทึก' })
    save.focus()
    await user.tab() // wraps around instead of leaving the dialog
    expect(dialog).toContainElement(document.activeElement)
    await user.tab({ shift: true })
    expect(save).toHaveFocus()
  })

  it('does not close when the backdrop is pressed (protects unsaved input)', async () => {
    const { dialog } = await openEditModal()
    fireEvent.mouseDown(dialog.parentElement)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('still saves changes: the footer Save button submits the form', async () => {
    const { user, dialog } = await openEditModal()
    const position = within(dialog).getByLabelText(/ตำแหน่ง/)
    await user.clear(position)
    await user.type(position, 'หัวหน้าทีมตรวจสอบ')
    await user.click(within(dialog).getByRole('button', { name: 'บันทึก' }))
    expect(await screen.findByText('บันทึกการแก้ไขข้อมูลพนักงานแล้ว')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('หัวหน้าทีมตรวจสอบ')).toBeInTheDocument()
  })

  it('shows validation errors and moves focus to the first invalid field', async () => {
    const { user, dialog } = await openEditModal()
    const first = within(dialog).getByLabelText(/^ชื่อ/)
    await user.clear(first)
    await user.click(within(dialog).getByRole('button', { name: 'บันทึก' }))
    expect(await within(dialog).findByText('กรุณากรอกชื่อ')).toBeInTheDocument()
    await waitFor(() => expect(first).toHaveFocus())
  })
})
