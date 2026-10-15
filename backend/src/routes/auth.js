import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { permissionsFor, ROLES, ROLE_LABELS } from '../rbac.js'
import { badRequest, HttpError } from '../errors.js'
import { authenticate } from '../middleware/auth.js'
import { parseRegistration } from '../validate.js'

// Valid bcrypt hash used to keep response time similar when the username does not exist.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10)

const MAX_FAILS = 5 // per IP + username
const MAX_FAILS_PER_IP = 30 // across all usernames, so rotating usernames cannot bypass the limit
const WINDOW_MS = 15 * 60 * 1000
const MAX_REGISTRATIONS = 10 // per IP per hour
const REGISTER_WINDOW_MS = 60 * 60 * 1000

export function authRouter({ db, config }) {
  const router = Router()
  const fails = new Map() // key -> { count, first }
  const registrations = new Map() // ip -> { count, first }
  const ipFails = new Map() // ip -> { count, first }

  // Entries only matter inside their window; prune so the maps cannot grow without bound.
  const prune = () => {
    const now = Date.now()
    for (const [k, v] of fails) if (now - v.first > WINDOW_MS) fails.delete(k)
    for (const [k, v] of ipFails) if (now - v.first > WINDOW_MS) ipFails.delete(k)
    for (const [k, v] of registrations) if (now - v.first > REGISTER_WINDOW_MS) registrations.delete(k)
  }
  setInterval(prune, 5 * 60 * 1000).unref()

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
  const bump = (map, key) => {
    const f = map.get(key)
    if (!f || Date.now() - f.first > WINDOW_MS) map.set(key, { count: 1, first: Date.now() })
    else f.count += 1
  }
  const recordFail = (key, ip) => {
    bump(fails, key)
    bump(ipFails, ip)
  }
  const ipLocked = (ip) => {
    const f = ipFails.get(ip)
    return Boolean(f) && Date.now() - f.first <= WINDOW_MS && f.count >= MAX_FAILS_PER_IP
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
    if (isLocked(key) || ipLocked(req.ip)) {
      return next(new HttpError(429, 'พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง 15 นาที'))
    }
    const user = (await db.query('SELECT * FROM users WHERE lower(username) = lower($1)', [username.trim()])).rows[0]
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH)
    if (!user || !ok) {
      recordFail(key, req.ip)
      return next(new HttpError(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'))
    }
    fails.delete(key)
    const token = jwt.sign({ sub: String(user.id), role: user.role }, config.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: config.jwtExpiresIn,
    })
    res.json({ token, user: await describe(user) })
  })

  // Self-service sign-up. The role is ALWAYS 'employee' and the account is NOT linked to any employee record
  // (employee_id NULL): it can read no employee data until an administrator links it. Nothing the client sends
  // (role, employeeId, ...) is ever used, and no employee record is created.
  router.post('/register', async (req, res, next) => {
    const now = Date.now()
    const r = registrations.get(req.ip)
    if (r && now - r.first <= REGISTER_WINDOW_MS && r.count >= MAX_REGISTRATIONS) {
      return next(new HttpError(429, 'สมัครบัญชีบ่อยเกินไป กรุณาลองใหม่ภายหลัง'))
    }
    const { username, password } = parseRegistration(req.body)
    const taken = new HttpError(409, 'ชื่อผู้ใช้นี้ถูกใช้แล้ว', { username: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว กรุณาเลือกชื่ออื่น' })
    if ((await db.query('SELECT 1 FROM users WHERE lower(username) = lower($1)', [username])).rows[0]) throw taken
    const hash = await bcrypt.hash(password, 10)
    try {
      await db.query('INSERT INTO users (username, password_hash, role, employee_id) VALUES ($1, $2, $3, NULL)', [
        username,
        hash,
        ROLES.EMPLOYEE,
      ])
    } catch (err) {
      if (err.code === '23505') throw taken // lost a race with a concurrent sign-up
      throw err
    }
    if (!r || now - r.first > REGISTER_WINDOW_MS) registrations.set(req.ip, { count: 1, first: now })
    else r.count += 1
    res.status(201).json({ username, role: ROLES.EMPLOYEE, roleLabel: ROLE_LABELS[ROLES.EMPLOYEE] })
  })

  router.get('/me', authenticate({ db, config }), async (req, res) => {
    const user = (await db.query('SELECT * FROM users WHERE id = $1', [req.user.id])).rows[0]
    res.json({ user: await describe(user) })
  })

  return router
}
