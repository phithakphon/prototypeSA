import { Router } from 'express'
import { can } from '../rbac.js'
import { SUPPORTED_DEPARTMENT } from '../scope.js'

export function dashboardRouter({ db }) {
  const router = Router()

  router.get('/summary', async (req, res) => {
    const news = (
      await db.query('SELECT id, title, published_at FROM announcements ORDER BY published_at DESC, id DESC LIMIT 5')
    ).rows
    const announcements = news.map((n) => ({ id: n.id, title: n.title, publishedAt: n.published_at }))

    // Self-only roles never receive organisation-wide statistics or other employees' records
    if (can(req.user.role, 'employee:selfOnly')) return res.json({ counts: null, recentEmployees: [], announcements })

    const c = (
      await db.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'active')::int AS active,
                COUNT(*) FILTER (WHERE status = 'resigned')::int AS resigned
         FROM employees WHERE department = $1`,
        [SUPPORTED_DEPARTMENT],
      )
    ).rows[0]
    const recent = (
      await db.query(
        `SELECT id, employee_code, first_name, last_name, position, start_date, status
         FROM employees WHERE department = $1 ORDER BY start_date DESC, id DESC LIMIT 5`,
        [SUPPORTED_DEPARTMENT],
      )
    ).rows
    res.json({
      counts: { total: c.total, active: c.active, resigned: c.resigned },
      recentEmployees: recent.map((r) => ({
        id: r.id,
        employeeCode: r.employee_code,
        firstName: r.first_name,
        lastName: r.last_name,
        position: r.position,
        startDate: r.start_date,
        status: r.status,
      })),
      announcements,
    })
  })

  return router
}
