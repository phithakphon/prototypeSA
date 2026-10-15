import { Router } from 'express'

export function dashboardRouter({ db }) {
  const router = Router()

  router.get('/summary', async (_req, res) => {
    const news = (
      await db.query('SELECT id, title, published_at FROM announcements ORDER BY published_at DESC, id DESC LIMIT 5')
    ).rows
    const announcements = news.map((n) => ({ id: n.id, title: n.title, publishedAt: n.published_at }))

    const c = (
      await db.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'active')::int AS active,
                COUNT(*) FILTER (WHERE status = 'resigned')::int AS resigned
         FROM employees`,
      )
    ).rows[0]
    const recent = (
      await db.query(
        `SELECT id, employee_code, first_name, last_name, position, start_date, status
         FROM employees ORDER BY id DESC LIMIT 5`,
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
