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

  const getEmployee = async (id) => {
    const row = (await db.query('SELECT id, status FROM employees WHERE id = $1', [id])).rows[0]
    if (!row) throw notFound('ไม่พบข้อมูลพนักงาน')
    return row
  }

  // Overview of all employees with their current salary (finance only)
  router.get('/salaries', requirePermission('salary:manage'), async (_req, res) => {
    const { rows } = await db.query(
      `SELECT e.id, e.employee_code, e.first_name, e.last_name, e.department, e.position, e.status,
         (SELECT s.amount FROM salaries s WHERE s.employee_id = e.id AND s.effective_date <= $1
            ORDER BY s.effective_date DESC, s.id DESC LIMIT 1) AS current_amount,
         (SELECT s.effective_date FROM salaries s WHERE s.employee_id = e.id AND s.effective_date <= $1
            ORDER BY s.effective_date DESC, s.id DESC LIMIT 1) AS current_since
       FROM employees e ORDER BY e.employee_code COLLATE "C"`,
      [today()],
    )
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
  router.get('/employees/:id/salaries', async (req, res) => {
    const emp = await getEmployee(parseId(req.params.id))
    const allowed = can(req.user.role, 'salary:manage') || req.user.employeeId === emp.id
    if (!allowed) throw forbidden('คุณไม่มีสิทธิ์ดูข้อมูลเงินเดือน')
    const { rows } = await db.query('SELECT * FROM salaries WHERE employee_id = $1 ORDER BY effective_date DESC, id DESC', [emp.id])
    res.json({ salaries: rows.map(toSalary), canManage: can(req.user.role, 'salary:manage') })
  })

  router.post('/employees/:id/salaries', requirePermission('salary:manage'), async (req, res) => {
    const emp = await getEmployee(parseId(req.params.id))
    if (emp.status === 'resigned') throw badRequest('ไม่สามารถเพิ่มเงินเดือนให้พนักงานที่ลาออกแล้ว')
    const d = parseSalary(req.body)
    const { rows } = await db.query(
      'INSERT INTO salaries (employee_id, amount, effective_date, note, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [emp.id, d.amount, d.effectiveDate, d.note, req.user.id],
    )
    res.status(201).json({ salary: toSalary(rows[0]) })
  })

  router.put('/salaries/:id', requirePermission('salary:manage'), async (req, res) => {
    const id = parseId(req.params.id)
    if (!(await db.query('SELECT 1 FROM salaries WHERE id = $1', [id])).rows[0]) throw notFound('ไม่พบรายการเงินเดือน')
    const d = parseSalary(req.body)
    const { rows } = await db.query(
      'UPDATE salaries SET amount = $1, effective_date = $2, note = $3, updated_at = now() WHERE id = $4 RETURNING *',
      [d.amount, d.effectiveDate, d.note, id],
    )
    res.json({ salary: toSalary(rows[0]) })
  })

  return router
}
