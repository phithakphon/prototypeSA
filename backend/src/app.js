import { evaluationsRouter } from './routes/evaluations.js'
import express from 'express'
import { authRouter } from './routes/auth.js'
import { employeesRouter } from './routes/employees.js'
import { salariesRouter } from './routes/salaries.js'
import { dashboardRouter } from './routes/dashboard.js'
import { accountsRouter } from './routes/accounts.js'
import { authenticate } from './middleware/auth.js'
import { HttpError } from './errors.js'
import { isDbUnavailable } from './db.js'
import { cors } from './cors.js'

export function createApp({ db, config }) {
  const app = express()
  app.disable('x-powered-by')
  // Behind a hosting proxy (Render, Railway ...) the real client IP comes from X-Forwarded-For, and the login and
  // registration rate limits use req.ip. TRUST_PROXY is the exact number of proxy hops (0 = none, the default).
  app.set('trust proxy', config.trustProxy ?? 0)
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff')
    res.set('X-Frame-Options', 'DENY')
    res.set('Referrer-Policy', 'no-referrer')
    res.set('Cache-Control', 'no-store')
    if (config.isProduction) res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
    next()
  })
  app.use(cors(config.corsOrigins))

  // Health checks for the hosting platform: no authentication, no data, no internal details.
  app.get('/health', (_req, res) => res.json({ status: 'ok' })) // liveness: the process is up
  app.get('/ready', async (_req, res) => {
    // readiness: the database answers
    try {
      await db.query('SELECT 1')
      res.json({ status: 'ok' })
    } catch {
      res.status(503).json({ status: 'unavailable' })
    }
  })

  app.use(express.json({ limit: '100kb' }))

  const auth = authenticate({ db, config })
  app.use('/api/auth', authRouter({ db, config }))
  app.use('/api/dashboard', auth, dashboardRouter({ db }))
  app.use('/api/evaluations', auth, evaluationsRouter({ db }))
  app.use('/api/employees', auth, employeesRouter({ db }))
  app.use('/api/accounts', auth, accountsRouter({ db }))
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
    if (isDbUnavailable(err)) {
      console.error('Database unavailable:', err.code || err.message)
      return res.status(503).json({ message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้ในขณะนี้ กรุณาลองใหม่อีกครั้งภายหลัง' })
    }
    if (err.code === '23505') return res.status(409).json({ message: 'ข้อมูลซ้ำกับที่มีอยู่ในระบบแล้ว' })
    // Log only the message: never request bodies (may contain salary/personal data)
    console.error('Unhandled error:', err.message)
    res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง' })
  })

  return app
}
