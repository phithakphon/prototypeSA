import jwt from 'jsonwebtoken'
import { can } from '../rbac.js'
import { forbidden, unauthorized } from '../errors.js'

export function authenticate({ db, config }) {
  return async (req, _res, next) => {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) return next(unauthorized())
    let payload
    try {
      payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] })
    } catch {
      return next(unauthorized('เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่'))
    }
    // Always re-read the user so role changes/removals take effect immediately.
    const id = Number(payload.sub)
    if (!Number.isInteger(id)) return next(unauthorized())
    try {
      const { rows } = await db.query('SELECT id, username, role, employee_id FROM users WHERE id = $1', [id])
      const user = rows[0]
      if (!user) return next(unauthorized())
      req.user = { id: user.id, username: user.username, role: user.role, employeeId: user.employee_id }
      next()
    } catch (err) {
      next(err)
    }
  }
}

export const requirePermission = (permission) => (req, _res, next) =>
  can(req.user.role, permission) ? next() : next(forbidden())
