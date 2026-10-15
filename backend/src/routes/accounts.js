import { Router } from 'express'
import { requirePermission } from '../middleware/auth.js'
import { badRequest, conflict, forbidden, notFound } from '../errors.js'
import { SUPPORTED_DEPARTMENT } from '../scope.js'
import { parseId } from './employees.js'

// HR workflow: verify a self-registered account and link it to an existing employee record.
// Safeguards:
//  - only `account:link` (HR) may call it; the role of an account is NEVER changed here
//  - only unlinked accounts with the plain 'employee' role can be linked (never a privileged account)
//  - the employee must exist in the supported department, be active and have no account yet (unique index)
//  - HR must re-type the employee code of the record it selected (explicit verification step)
//  - every link / unlink is written to account_link_audit in the same transaction
export function accountsRouter({ db }) {
  const router = Router()
  router.use(requirePermission('account:link'))

  const toEmployee = (r) => ({
    id: r.id,
    employeeCode: r.employee_code,
    firstName: r.first_name,
    lastName: r.last_name,
    department: r.department,
    position: r.position,
    status: r.status,
    startDate: r.start_date,
  })

  // Accounts waiting for verification
  router.get('/pending', async (_req, res) => {
    const { rows } = await db.query(
      "SELECT id, username, created_at FROM users WHERE role = 'employee' AND employee_id IS NULL ORDER BY created_at, id",
    )
    res.json({ accounts: rows.map((r) => ({ id: r.id, username: r.username, createdAt: r.created_at })) })
  })

  // Accounts already linked to an employee of the supported department (to review or undo a link)
  router.get('/linked', async (_req, res) => {
    const { rows } = await db.query(
      `SELECT u.id, u.username, e.id AS employee_id, e.employee_code, e.first_name, e.last_name
       FROM users u JOIN employees e ON e.id = u.employee_id
       WHERE u.role = 'employee' AND e.department = $1
       ORDER BY e.employee_code COLLATE "C"`,
      [SUPPORTED_DEPARTMENT],
    )
    res.json({
      accounts: rows.map((r) => ({
        id: r.id,
        username: r.username,
        employeeId: r.employee_id,
        employeeCode: r.employee_code,
        firstName: r.first_name,
        lastName: r.last_name,
      })),
    })
  })

  // Employee records an account can still be linked to (no confidential fields)
  router.get('/linkable-employees', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : ''
    const params = [SUPPORTED_DEPARTMENT]
    let search = ''
    if (q) {
      params.push(`%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)
      search = "AND (e.employee_code ILIKE $2 OR e.first_name ILIKE $2 OR e.last_name ILIKE $2 OR (e.first_name || ' ' || e.last_name) ILIKE $2)"
    }
    const { rows } = await db.query(
      `SELECT e.* FROM employees e
       WHERE e.department = $1 AND e.status = 'active'
         AND NOT EXISTS (SELECT 1 FROM users u WHERE u.employee_id = e.id) ${search}
       ORDER BY e.employee_code COLLATE "C" LIMIT 50`,
      params,
    )
    res.json({ employees: rows.map(toEmployee) })
  })

  router.post('/:id/link', async (req, res) => {
    const userId = parseId(req.params.id)
    const b = req.body && typeof req.body === 'object' ? req.body : {}
    const employeeId = Number(b.employeeId)
    if (!Number.isInteger(employeeId) || employeeId <= 0 || employeeId > 2147483647) {
      throw badRequest('กรุณาเลือกพนักงาน', { employeeId: 'กรุณาเลือกพนักงาน' })
    }
    const code = typeof b.employeeCode === 'string' ? b.employeeCode.trim().toUpperCase() : ''
    if (userId === req.user.id) throw forbidden('ไม่สามารถผูกบัญชีของตนเองได้')

    const account = await db.transaction(async (tx) => {
      const user = (await tx.query('SELECT id, username, role, employee_id FROM users WHERE id = $1 FOR UPDATE', [userId])).rows[0]
      if (!user) throw notFound('ไม่พบบัญชีผู้ใช้')
      if (user.role !== 'employee') throw forbidden('ผูกได้เฉพาะบัญชีบทบาทพนักงานเท่านั้น')
      if (user.employee_id !== null) throw conflict('บัญชีนี้ถูกผูกกับพนักงานแล้ว')

      const emp = (await tx.query('SELECT * FROM employees WHERE id = $1', [employeeId])).rows[0]
      if (!emp || emp.department !== SUPPORTED_DEPARTMENT) throw notFound('ไม่พบข้อมูลพนักงาน')
      if (code !== emp.employee_code) {
        throw badRequest('รหัสพนักงานที่ยืนยันไม่ตรงกับพนักงานที่เลือก', { employeeCode: 'รหัสพนักงานไม่ตรงกับพนักงานที่เลือก' })
      }
      if (emp.status !== 'active') throw conflict('ไม่สามารถผูกบัญชีกับพนักงานที่ลาออกแล้ว')
      try {
        await tx.query('UPDATE users SET employee_id = $1 WHERE id = $2 AND role = $3 AND employee_id IS NULL', [emp.id, user.id, 'employee'])
      } catch (err) {
        if (err.code === '23505') throw conflict('พนักงานคนนี้ถูกผูกกับบัญชีอื่นแล้ว')
        throw err
      }
      await tx.query('INSERT INTO account_link_audit (action, user_id, employee_id, performed_by) VALUES ($1, $2, $3, $4)', [
        'link', user.id, emp.id, req.user.id,
      ])
      return { id: user.id, username: user.username, role: user.role, employeeId: emp.id, employeeCode: emp.employee_code }
    })
    res.json({ account })
  })

  // Undo a wrong link (still audited). Privileged accounts can not be touched.
  router.post('/:id/unlink', async (req, res) => {
    const userId = parseId(req.params.id)
    const account = await db.transaction(async (tx) => {
      const user = (await tx.query('SELECT id, username, role, employee_id FROM users WHERE id = $1 FOR UPDATE', [userId])).rows[0]
      if (!user) throw notFound('ไม่พบบัญชีผู้ใช้')
      if (user.role !== 'employee') throw forbidden('ยกเลิกการผูกได้เฉพาะบัญชีบทบาทพนักงานเท่านั้น')
      if (user.employee_id === null) throw conflict('บัญชีนี้ยังไม่ได้ผูกกับพนักงาน')
      await tx.query('UPDATE users SET employee_id = NULL WHERE id = $1', [user.id])
      await tx.query('INSERT INTO account_link_audit (action, user_id, employee_id, performed_by) VALUES ($1, $2, $3, $4)', [
        'unlink', user.id, user.employee_id, req.user.id,
      ])
      return { id: user.id, username: user.username, role: user.role, employeeId: null }
    })
    res.json({ account })
  })

  return router
}
