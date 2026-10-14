import { Router } from 'express'
import { transaction } from '../db.js'
import { can } from '../rbac.js'
import { requirePermission } from '../middleware/auth.js'
import { badRequest, conflict, notFound } from '../errors.js'
import { parseEmployee, parseResignation, today } from '../validate.js'

const toPublic = (r) => ({
  id: r.id,
  employeeCode: r.employee_code,
  firstName: r.first_name,
  lastName: r.last_name,
  department: r.department,
  position: r.position,
  status: r.status,
  startDate: r.start_date,
})

const toConfidential = (r) => ({
  nationalId: r.national_id,
  phone: r.phone,
  email: r.email,
  address: r.address,
  resignationReason: r.resignation_reason,
})

const toHistory = (h) => ({
  id: h.id,
  eventType: h.event_type,
  description: h.description,
  eventDate: h.event_date,
})

export function parseId(value) {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) throw notFound()
  return n
}

const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

export function employeesRouter({ db }) {
  const router = Router()

  const getEmployee = (id) => {
    const row = db.prepare('SELECT * FROM employees WHERE id = ?').get(id)
    if (!row) throw notFound('ไม่พบข้อมูลพนักงาน')
    return row
  }
  const addHistory = (employeeId, type, description, date, userId) =>
    db
      .prepare(
        'INSERT INTO employee_history (employee_id, event_type, description, event_date, created_by) VALUES (?, ?, ?, ?, ?)',
      )
      .run(employeeId, type, description, date, userId)

  const codeTaken = (code, exceptId = 0) =>
    Boolean(db.prepare('SELECT 1 FROM employees WHERE employee_code = ? AND id <> ?').get(code, exceptId))

  // UC-02: search by code, name or department
  router.get('/', requirePermission('employee:search'), (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : ''
    const department = typeof req.query.department === 'string' ? req.query.department.trim() : ''
    const status = typeof req.query.status === 'string' ? req.query.status : ''
    if (status && !['active', 'resigned'].includes(status)) throw badRequest('สถานะไม่ถูกต้อง')

    const where = []
    const params = []
    if (q) {
      const like = `%${escapeLike(q)}%`
      where.push(
        "(employee_code LIKE ? ESCAPE '\\' OR first_name LIKE ? ESCAPE '\\' OR last_name LIKE ? ESCAPE '\\' " +
          "OR (first_name || ' ' || last_name) LIKE ? ESCAPE '\\' OR department LIKE ? ESCAPE '\\')",
      )
      params.push(like, like, like, like, like)
    }
    if (department) {
      where.push('department = ?')
      params.push(department)
    }
    if (status) {
      where.push('status = ?')
      params.push(status)
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = db.prepare(`SELECT COUNT(*) AS n FROM employees ${clause}`).get(...params).n
    const rows = db
      .prepare(`SELECT * FROM employees ${clause} ORDER BY employee_code LIMIT 200`)
      .all(...params)
    res.json({ total, employees: rows.map(toPublic) })
  })

  router.get('/departments', requirePermission('employee:search'), (_req, res) => {
    const rows = db.prepare('SELECT DISTINCT department FROM employees ORDER BY department').all()
    res.json({ departments: rows.map((r) => r.department) })
  })

  // UC-06: list resigned employees
  router.get('/resigned', requirePermission('resignation:manage'), (_req, res) => {
    const rows = db
      .prepare("SELECT * FROM employees WHERE status = 'resigned' ORDER BY resignation_date DESC, id DESC")
      .all()
    res.json({
      employees: rows.map((r) => ({
        ...toPublic(r),
        resignationDate: r.resignation_date,
        resignationReason: r.resignation_reason,
      })),
    })
  })

  // UC-03: details + history
  router.get('/:id', requirePermission('employee:view'), (req, res) => {
    const row = getEmployee(parseId(req.params.id))
    const isSelf = req.user.employeeId === row.id
    const confidentialVisible = isSelf || can(req.user.role, 'employee:viewConfidential')
    const history = db
      .prepare('SELECT * FROM employee_history WHERE employee_id = ? ORDER BY event_date DESC, id DESC')
      .all(row.id)
    res.json({
      employee: {
        ...toPublic(row),
        resignationDate: row.resignation_date,
        ...(confidentialVisible ? toConfidential(row) : {}),
      },
      confidentialVisible,
      isSelf,
      history: history.map(toHistory),
    })
  })

  // UC-04: create
  router.post('/', requirePermission('employee:manage'), (req, res) => {
    const data = parseEmployee(req.body)
    if (codeTaken(data.employeeCode)) {
      throw conflict('รหัสพนักงานนี้มีอยู่ในระบบแล้ว')
    }
    const id = transaction(db, () => {
      const info = db
        .prepare(
          `INSERT INTO employees (employee_code, first_name, last_name, department, position, start_date,
             national_id, phone, email, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          data.employeeCode, data.firstName, data.lastName, data.department, data.position,
          data.startDate, data.nationalId, data.phone, data.email, data.address,
        )
      const newId = Number(info.lastInsertRowid)
      addHistory(newId, 'hired', `เริ่มงานในตำแหน่ง ${data.position} แผนก ${data.department}`, data.startDate, req.user.id)
      return newId
    })
    res.status(201).json({ employee: toPublic(getEmployee(id)) })
  })

  // UC-04: update (status changes are only possible through the resign endpoint)
  router.put('/:id', requirePermission('employee:manage'), (req, res) => {
    const old = getEmployee(parseId(req.params.id))
    const data = parseEmployee(req.body)
    if (codeTaken(data.employeeCode, old.id)) {
      throw conflict('รหัสพนักงานนี้มีอยู่ในระบบแล้ว')
    }
    transaction(db, () => {
      db.prepare(
        `UPDATE employees SET employee_code = ?, first_name = ?, last_name = ?, department = ?, position = ?,
           start_date = ?, national_id = ?, phone = ?, email = ?, address = ?, updated_at = datetime('now')
         WHERE id = ?`,
      ).run(
        data.employeeCode, data.firstName, data.lastName, data.department, data.position,
        data.startDate, data.nationalId, data.phone, data.email, data.address, old.id,
      )
      const date = today()
      let logged = false
      if (old.position !== data.position) {
        addHistory(old.id, 'position_changed', `เปลี่ยนตำแหน่งจาก ${old.position} เป็น ${data.position}`, date, req.user.id)
        logged = true
      }
      if (old.department !== data.department) {
        addHistory(old.id, 'department_changed', `ย้ายแผนกจาก ${old.department} เป็น ${data.department}`, date, req.user.id)
        logged = true
      }
      const changedOther = ['employee_code', 'first_name', 'last_name', 'start_date', 'national_id', 'phone', 'email', 'address']
        .some((col, i) => {
          const key = ['employeeCode', 'firstName', 'lastName', 'startDate', 'nationalId', 'phone', 'email', 'address'][i]
          return (old[col] ?? null) !== (data[key] ?? null)
        })
      if (!logged && changedOther) addHistory(old.id, 'updated', 'แก้ไขข้อมูลพนักงาน', date, req.user.id)
    })
    res.json({ employee: toPublic(getEmployee(old.id)) })
  })

  // UC-06: mark as resigned (record is preserved, never deleted)
  router.post('/:id/resign', requirePermission('resignation:manage'), (req, res) => {
    const emp = getEmployee(parseId(req.params.id))
    const { resignationDate, reason } = parseResignation(req.body)
    if (emp.status === 'resigned') throw conflict('พนักงานคนนี้ลาออกแล้ว')
    if (resignationDate < emp.start_date) {
      throw badRequest('ข้อมูลการลาออกไม่ถูกต้อง', { resignationDate: 'วันที่ลาออกต้องไม่ก่อนวันที่เริ่มงาน' })
    }
    if (resignationDate > today()) {
      throw badRequest('ข้อมูลการลาออกไม่ถูกต้อง', { resignationDate: 'วันที่ลาออกต้องไม่เป็นวันในอนาคต' })
    }
    transaction(db, () => {
      db.prepare(
        `UPDATE employees SET status = 'resigned', resignation_date = ?, resignation_reason = ?,
           updated_at = datetime('now') WHERE id = ?`,
      ).run(resignationDate, reason, emp.id)
      addHistory(emp.id, 'resigned', 'ลาออกจากองค์กร', resignationDate, req.user.id)
    })
    res.json({ employee: toPublic(getEmployee(emp.id)) })
  })

  return router
}
