import { Router } from 'express'
import { can } from '../rbac.js'
import { requirePermission } from '../middleware/auth.js'
import { badRequest, conflict, forbidden, notFound } from '../errors.js'
import { parseEmployee, parseResignation, today } from '../validate.js'
import { SUPPORTED_DEPARTMENT, inScope } from '../scope.js'

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
  // PostgreSQL INTEGER range: larger ids can never exist (and would raise a database error)
  if (!Number.isInteger(n) || n <= 0 || n > 2147483647) throw notFound()
  return n
}

// PostgreSQL's default LIKE escape character is the backslash
const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

export function employeesRouter({ db }) {
  const router = Router()

  // Out-of-scope records look exactly like missing ones (404), except the caller's own record.
  const getEmployee = async (id, user) => {
    const row = (await db.query('SELECT * FROM employees WHERE id = $1', [id])).rows[0]
    if (!row || !inScope(row, user)) throw notFound('ไม่พบข้อมูลพนักงาน')
    return row
  }
  const addHistory = (q, employeeId, type, description, date, userId) =>
    q.query(
      'INSERT INTO employee_history (employee_id, event_type, description, event_date, created_by) VALUES ($1, $2, $3, $4, $5)',
      [employeeId, type, description, date, userId],
    )

  const codeTaken = async (code, exceptId = 0) =>
    Boolean((await db.query('SELECT 1 FROM employees WHERE employee_code = $1 AND id <> $2', [code, exceptId])).rows[0])

  // UC-02: search by code, name or department
  router.get('/', requirePermission('employee:search'), async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : ''
    const department = typeof req.query.department === 'string' ? req.query.department.trim() : ''
    const status = typeof req.query.status === 'string' ? req.query.status : ''
    if (status && !['active', 'resigned'].includes(status)) throw badRequest('สถานะไม่ถูกต้อง')

    const params = [SUPPORTED_DEPARTMENT]
    const where = ['department = $1']
    const param = (v) => `$${params.push(v)}`
    if (q) {
      const like = param(`%${escapeLike(q)}%`)
      where.push(
        `(employee_code ILIKE ${like} OR first_name ILIKE ${like} OR last_name ILIKE ${like} ` +
          `OR (first_name || ' ' || last_name) ILIKE ${like} OR department ILIKE ${like})`,
      )
    }
    if (department) where.push(`department = ${param(department)}`)
    if (status) where.push(`status = ${param(status)}`)
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = (await db.query(`SELECT COUNT(*)::int AS n FROM employees ${clause}`, params)).rows[0].n
    const { rows } = await db.query(
      `SELECT * FROM employees ${clause} ORDER BY employee_code COLLATE "C" LIMIT 200`,
      params,
    )
    res.json({ total, employees: rows.map(toPublic) })
  })

  router.get('/departments', requirePermission('employee:search'), (_req, res) => {
    res.json({ departments: [SUPPORTED_DEPARTMENT] })
  })

  // UC-06: list resigned employees
  router.get('/resigned', requirePermission('resignation:manage'), async (_req, res) => {
    const { rows } = await db.query(
      "SELECT * FROM employees WHERE status = 'resigned' AND department = $1 ORDER BY resignation_date DESC, id DESC",
      [SUPPORTED_DEPARTMENT],
    )
    res.json({
      employees: rows.map((r) => ({
        ...toPublic(r),
        resignationDate: r.resignation_date,
        resignationReason: r.resignation_reason,
      })),
    })
  })

  // UC-03: details + history
  router.get('/:id', requirePermission('employee:view'), async (req, res) => {
    const id = parseId(req.params.id)
    // Self-only roles: decided before any lookup, so another employee's id can never be probed (403 whether or not it exists)
    if (can(req.user.role, 'employee:selfOnly') && req.user.employeeId !== id) {
      throw forbidden('คุณดูได้เฉพาะข้อมูลของตนเองเท่านั้น')
    }
    const row = await getEmployee(id, req.user)
    const isSelf = req.user.employeeId === row.id
    const confidentialVisible = isSelf || can(req.user.role, 'employee:viewConfidential')
    const { rows: history } = await db.query(
      'SELECT * FROM employee_history WHERE employee_id = $1 ORDER BY event_date DESC, id DESC',
      [row.id],
    )
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
  router.post('/', requirePermission('employee:manage'), async (req, res) => {
    const data = parseEmployee({ ...req.body, department: SUPPORTED_DEPARTMENT })
    if (await codeTaken(data.employeeCode)) throw conflict('รหัสพนักงานนี้มีอยู่ในระบบแล้ว')
    const id = await db.transaction(async (tx) => {
      const { rows } = await tx.query(
        `INSERT INTO employees (employee_code, first_name, last_name, department, position, start_date,
           national_id, phone, email, address) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          data.employeeCode, data.firstName, data.lastName, data.department, data.position,
          data.startDate, data.nationalId, data.phone, data.email, data.address,
        ],
      )
      const newId = rows[0].id
      await addHistory(tx, newId, 'hired', `เริ่มงานในตำแหน่ง ${data.position} แผนก ${data.department}`, data.startDate, req.user.id)
      return newId
    })
    res.status(201).json({ employee: toPublic(await getEmployee(id, req.user)) })
  })

  // UC-04: update (status changes are only possible through the resign endpoint)
  router.put('/:id', requirePermission('employee:manage'), async (req, res) => {
    const old = await getEmployee(parseId(req.params.id), req.user)
    const data = parseEmployee({ ...req.body, department: SUPPORTED_DEPARTMENT })
    if (await codeTaken(data.employeeCode, old.id)) throw conflict('รหัสพนักงานนี้มีอยู่ในระบบแล้ว')
    await db.transaction(async (tx) => {
      await tx.query(
        `UPDATE employees SET employee_code = $1, first_name = $2, last_name = $3, department = $4, position = $5,
           start_date = $6, national_id = $7, phone = $8, email = $9, address = $10, updated_at = now()
         WHERE id = $11`,
        [
          data.employeeCode, data.firstName, data.lastName, data.department, data.position,
          data.startDate, data.nationalId, data.phone, data.email, data.address, old.id,
        ],
      )
      const date = today()
      let logged = false
      if (old.position !== data.position) {
        await addHistory(tx, old.id, 'position_changed', `เปลี่ยนตำแหน่งจาก ${old.position} เป็น ${data.position}`, date, req.user.id)
        logged = true
      }
      if (old.department !== data.department) {
        await addHistory(tx, old.id, 'department_changed', `ย้ายแผนกจาก ${old.department} เป็น ${data.department}`, date, req.user.id)
        logged = true
      }
      const changedOther = ['employee_code', 'first_name', 'last_name', 'start_date', 'national_id', 'phone', 'email', 'address']
        .some((col, i) => {
          const key = ['employeeCode', 'firstName', 'lastName', 'startDate', 'nationalId', 'phone', 'email', 'address'][i]
          return (old[col] ?? null) !== (data[key] ?? null)
        })
      if (!logged && changedOther) await addHistory(tx, old.id, 'updated', 'แก้ไขข้อมูลพนักงาน', date, req.user.id)
    })
    res.json({ employee: toPublic(await getEmployee(old.id, req.user)) })
  })

  // UC-06: mark as resigned (record is preserved, never deleted)
  router.post('/:id/resign', requirePermission('resignation:manage'), async (req, res) => {
    const emp = await getEmployee(parseId(req.params.id), req.user)
    const { resignationDate, reason } = parseResignation(req.body)
    if (emp.status === 'resigned') throw conflict('พนักงานคนนี้ลาออกแล้ว')
    if (resignationDate < emp.start_date) {
      throw badRequest('ข้อมูลการลาออกไม่ถูกต้อง', { resignationDate: 'วันที่ลาออกต้องไม่ก่อนวันที่เริ่มงาน' })
    }
    if (resignationDate > today()) {
      throw badRequest('ข้อมูลการลาออกไม่ถูกต้อง', { resignationDate: 'วันที่ลาออกต้องไม่เป็นวันในอนาคต' })
    }
    await db.transaction(async (tx) => {
      await tx.query(
        `UPDATE employees SET status = 'resigned', resignation_date = $1, resignation_reason = $2,
           updated_at = now() WHERE id = $3`,
        [resignationDate, reason, emp.id],
      )
      await addHistory(tx, emp.id, 'resigned', 'ลาออกจากองค์กร', resignationDate, req.user.id)
    })
    res.json({ employee: toPublic(await getEmployee(emp.id, req.user)) })
  })

  // UC-06: return a resigned employee to active status (history is kept: the original 'resigned' entry stays)
  router.post('/:id/reinstate', requirePermission('resignation:manage'), async (req, res) => {
    const emp = await getEmployee(parseId(req.params.id), req.user)
    await db.transaction(async (tx) => {
      // The status check is part of the UPDATE, so two concurrent requests cannot both succeed or double-log.
      const { rowCount } = await tx.query(
        `UPDATE employees SET status = 'active', resignation_date = NULL, resignation_reason = NULL,
           updated_at = now() WHERE id = $1 AND status = 'resigned'`,
        [emp.id],
      )
      if (rowCount === 0) throw conflict('พนักงานคนนี้ยังปฏิบัติงานอยู่')
      await addHistory(tx, emp.id, 'reinstated', 'กลับเข้าปฏิบัติงาน', today(), req.user.id)
    })
    res.json({ employee: toPublic(await getEmployee(emp.id, req.user)) })
  })

  return router
}
