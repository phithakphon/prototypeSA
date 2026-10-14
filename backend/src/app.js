import express from 'express'
import { authRouter } from './routes/auth.js'
import { employeesRouter } from './routes/employees.js'
import { salariesRouter } from './routes/salaries.js'
import { dashboardRouter } from './routes/dashboard.js'
import { authenticate } from './middleware/auth.js'
import { HttpError } from './errors.js'

export function createApp({ db, config }) {
  const app = express()
  app.disable('x-powered-by')
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff')
    res.set('Cache-Control', 'no-store')
    next()
  })
  app.use(express.json({ limit: '100kb' }))

  const auth = authenticate({ db, config })
  app.use('/api/auth', authRouter({ db, config }))
  app.use('/api/dashboard', auth, dashboardRouter({ db }))
  app.use('/api/employees', auth, employeesRouter({ db }))
  app.use('/api', auth, salariesRouter({ db }))

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'ไม่พบเส้นทางที่ร้องขอ')))

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ message: err.message, ...(err.details ? { errors: err.details } : {}) })
    }
    if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
      return res.status(400).json({ message: 'รูปแบบข้อมูลที่ส่งมาไม่ถูกต้อง' })
    }
    // Log only the message: never request bodies (may contain salary/personal data)
    console.error('Unhandled error:', err.message)
    res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง' })
  })

  return app
}
