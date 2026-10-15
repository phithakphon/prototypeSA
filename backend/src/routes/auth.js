import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { permissionsFor, ROLE_LABELS } from '../rbac.js'
import { badRequest, HttpError } from '../errors.js'
import { authenticate } from '../middleware/auth.js'

// Valid bcrypt hash used to keep response time similar when the username does not exist.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10)

const MAX_FAILS = 5
const WINDOW_MS = 15 * 60 * 1000

export function authRouter({ db, config }) {
  const router = Router()
  const fails = new Map() // key -> { count, first }

  const keyOf = (req, username) => `${req.ip}|${username.toLowerCase()}`
  const isLocked = (key) => {
    const f = fails.get(key)
    if (!f) return false
    if (Date.now() - f.first > WINDOW_MS) {
      fails.delete(key)
      return false
    }
    return f.count >= MAX_FAILS
  }
  const recordFail = (key) => {
    const f = fails.get(key)
    if (!f || Date.now() - f.first > WINDOW_MS) fails.set(key, { count: 1, first: Date.now() })
    else f.count += 1
  }

  const describe = async (user) => {
    const emp = user.employee_id
      ? (await db.query('SELECT first_name, last_name FROM employees WHERE id = $1', [user.employee_id])).rows[0]
      : null
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      roleLabel: ROLE_LABELS[user.role],
      employeeId: user.employee_id,
      displayName: emp ? `${emp.first_name} ${emp.last_name}` : user.username,
      permissions: permissionsFor(user.role),
    }
  }

  // UC-01
  router.post('/login', async (req, res, next) => {
    const { username, password } = req.body || {}
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      return next(badRequest('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'))
    }
    const key = keyOf(req, username.trim())
    if (isLocked(key)) {
      return next(new HttpError(429, 'พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง 15 นาที'))
    }
    const user = (await db.query('SELECT * FROM users WHERE username = $1', [username.trim()])).rows[0]
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH)
    if (!user || !ok) {
      recordFail(key)
      return next(new HttpError(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'))
    }
    fails.delete(key)
    const token = jwt.sign({ sub: String(user.id), role: user.role }, config.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: config.jwtExpiresIn,
    })
    res.json({ token, user: await describe(user) })
  })

  router.get('/me', authenticate({ db, config }), async (req, res) => {
    const user = (await db.query('SELECT * FROM users WHERE id = $1', [req.user.id])).rows[0]
    res.json({ user: await describe(user) })
  })

  return router
}
