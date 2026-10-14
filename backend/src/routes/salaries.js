import { Router } from 'express'
import { can } from '../rbac.js'
import { requirePermission } from '../middleware/auth.js'
import { badRequest, forbidden, notFound } from '../errors.js'
import { parseSalary, today } from '../validate.js'
import { parseId } from './employees.js'

const toSalary = (r) => ({
  id: r.id,
  employeeId: r.employee_id,
  amount: r.amount,
  effectiveDate: r.effective_date,
  note: r.note,
})

// UC-05. Salary data is never written to logs.
export function salariesRouter({ db }) {
  const router = Router()

  const getEmployee = (id) => {
    const row = db.prepare('SELECT id, status FROM employees WHERE id = ?').get(id)
    if (!row) throw notFound('ไม่พบข้อมูลพนักงาน')
    return row
  }

  // Overview of all employees with their current salary (finance only)
  router.get('/salaries', requirePermission('salary:manage'), (_req, res) => {
    const rows = db
      .prepare(
        `SELECT e.id, e.employee_code, e.first_name, e.last_name, e.department, e.position, e.status,
           (SELECT s.amount FROM salaries s WHERE s.employee_id = e.id AND s.effective_date <= ?
              ORDER BY s.effective_date DESC, s.id DESC LIMIT 1) AS current_amount,
           (SELECT s.effective_date FROM salaries s WHERE s.employee_id = e.id AND s.effective_date <= ?
              ORDER BY s.effective_date DESC, s.id DESC LIMIT 1) AS current_since
         FROM employees e ORDER BY e.employee_code`,
      )
      .all(today(), today())
    res.json({
      employees: rows.map((r) => ({
        id: r.id,
        employeeCode: r.employee_code,
        firstName: r.first_name,
        lastName: r.last_name,
        department: r.department,
        position: r.position,
        status: r.status,
        currentAmount: r.current_amount,
        currentSince: r.current_since,
      })),
    })
  })

  // Salary records of one employee: finance, or the employee themself
  router.get('/employees/:id/salaries', (req, res) => {
    const emp = getEmployee(parseId(req.params.id))
    const allowed = can(req.user.role, 'salary:manage') || req.user.employeeId === emp.id
    if (!allowed) throw forbidden('คุณไม่มีสิทธิ์ดูข้อมูลเงินเดือน')
    const rows = db
      .prepare('SELECT * FROM salaries WHERE employee_id = ? ORDER BY effective_date DESC, id DESC')
      .all(emp.id)
    res.json({ salaries: rows.map(toSalary), canManage: can(req.user.role, 'salary:manage') })
  })

  router.post('/employees/:id/salaries', requirePermission('salary:manage'), (req, res) => {
    const emp = getEmployee(parseId(req.params.id))
    if (emp.status === 'resigned') throw badRequest('ไม่สามารถเพิ่มเงินเดือนให้พนักงานที่ลาออกแล้ว')
    const d = parseSalary(req.body)
    const info = db
      .prepare('INSERT INTO salaries (employee_id, amount, effective_date, note, created_by) VALUES (?, ?, ?, ?, ?)')
      .run(emp.id, d.amount, d.effectiveDate, d.note, req.user.id)
    const row = db.prepare('SELECT * FROM salaries WHERE id = ?').get(Number(info.lastInsertRowid))
    res.status(201).json({ salary: toSalary(row) })
  })

  router.put('/salaries/:id', requirePermission('salary:manage'), (req, res) => {
    const id = parseId(req.params.id)
    if (!db.prepare('SELECT 1 FROM salaries WHERE id = ?').get(id)) throw notFound('ไม่พบรายการเงินเดือน')
    const d = parseSalary(req.body)
    db.prepare("UPDATE salaries SET amount = ?, effective_date = ?, note = ?, updated_at = datetime('now') WHERE id = ?")
      .run(d.amount, d.effectiveDate, d.note, id)
    res.json({ salary: toSalary(db.prepare('SELECT * FROM salaries WHERE id = ?').get(id)) })
  })

  return router
}
