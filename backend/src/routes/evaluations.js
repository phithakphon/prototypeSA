import { Router } from 'express'
import { badRequest, forbidden, notFound } from '../errors.js'
import { requirePermission } from '../middleware/auth.js'
import { can } from '../rbac.js'
import { inScope } from '../scope.js'
import { CRITERIA, evaluationErrors, summarize } from '../../../shared/evaluations.js'

export function evaluationsRouter({ db }) {
  const router = Router()

  // Same visibility rules as employees: out-of-scope records look missing (404), except the caller's own record;
  // callers without evaluation:manage (employees) may only read their own evaluations (403 otherwise).
  const employee = async (code, user) => {
    if (typeof code !== 'string' || !code.trim() || code.length > 20) throw badRequest('กรุณาระบุรหัสพนักงานให้ถูกต้อง')
    const row = (
      await db.query(
        'SELECT id, employee_code, first_name, last_name, department FROM employees WHERE upper(employee_code) = $1',
        [code.trim().toUpperCase()],
      )
    ).rows[0]
    if (!row || !inScope(row, user)) throw notFound('ไม่พบข้อมูลพนักงาน')
    if (!can(user.role, 'evaluation:manage') && row.id !== user.employeeId) throw forbidden('คุณดูได้เฉพาะผลการประเมินของตนเองเท่านั้น')
    return { id: row.id, employeeCode: row.employee_code, firstName: row.first_name, lastName: row.last_name, department: row.department }
  }

  const toRecord = (row) => {
    const scores = CRITERIA.map((_, i) => row[`score_${i + 1}`])
    return {
      id: row.id,
      employeeId: row.employee_id,
      evaluationPeriod: row.evaluation_period,
      evaluationDate: row.evaluation_date,
      evaluatorName: row.evaluator_name,
      scores,
      deficiencies: row.deficiencies,
      recommendations: row.recommendations,
      ...summarize(scores),
    }
  }

  router.get('/employee', requirePermission('evaluation:view'), async (req, res) => {
    res.json({ employee: await employee(req.query.employeeCode, req.user) })
  })

  router.get('/', requirePermission('evaluation:view'), async (req, res) => {
    const selected = await employee(req.query.employeeCode, req.user)
    const { rows } = await db.query(
      'SELECT * FROM performance_evaluations WHERE employee_id = $1 ORDER BY evaluation_date DESC, id DESC',
      [selected.id],
    )
    res.json({ employee: selected, evaluations: rows.map(toRecord) })
  })

  router.post('/', requirePermission('evaluation:manage'), async (req, res) => {
    const body = req.body || {}
    const errors = evaluationErrors(body)
    if (Object.keys(errors).length) throw badRequest('ข้อมูลการประเมินไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง', errors)
    const selected = await employee(body.employeeCode, req.user)
    const { rows } = await db.query(
      `INSERT INTO performance_evaluations (employee_id, evaluation_period, evaluation_date, evaluator_name,
         score_1, score_2, score_3, score_4, score_5, score_6, deficiencies, recommendations, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        selected.id, body.evaluationPeriod.trim(), body.evaluationDate, body.evaluatorName.trim(), ...body.scores,
        (body.deficiencies || '').trim(), (body.recommendations || '').trim(), req.user.id,
      ],
    )
    res.status(201).json({ evaluation: toRecord(rows[0]) })
  })

  return router
}
