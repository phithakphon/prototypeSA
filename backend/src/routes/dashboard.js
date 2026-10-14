import { Router } from 'express'

export function dashboardRouter({ db }) {
  const router = Router()

  router.get('/summary', (_req, res) => {
    const c = db
      .prepare(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(status = 'active'), 0) AS active,
                COALESCE(SUM(status = 'resigned'), 0) AS resigned
         FROM employees`,
      )
      .get()
    const recent = db
      .prepare(
        `SELECT id, employee_code, first_name, last_name, position, start_date, status
         FROM employees ORDER BY id DESC LIMIT 5`,
      )
      .all()
    const news = db.prepare('SELECT id, title, published_at FROM announcements ORDER BY published_at DESC, id DESC LIMIT 5').all()
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
      announcements: news.map((n) => ({ id: n.id, title: n.title, publishedAt: n.published_at })),
    })
  })

  return router
}
