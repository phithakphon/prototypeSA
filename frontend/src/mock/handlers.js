// Mock implementation of the REST API contract in backend/ (same paths, same JSON shapes),
// so pages can be swapped to the real API by turning mock mode off in src/api.js.
// DEMO ONLY: the permission checks here simulate roles and are not real security.
import { ApiError } from '../apiError'
import { DEPARTMENT, todayIso } from '../format'
import { db, nextId } from './db'
import { can, permissionsFor, ROLE_LABELS } from './rbac'
import { parseEmployee, parseResignation, parseSalary } from './validate'
import { validateRegistration } from '../auth/registerRules'

const unauthorized = () => new ApiError(401, 'กรุณาเข้าสู่ระบบ')
const forbidden = (m = 'คุณไม่มีสิทธิ์ใช้งานส่วนนี้') => new ApiError(403, m)
const notFound = (m = 'ไม่พบข้อมูลที่ต้องการ') => new ApiError(404, m)
const conflict = (m) => new ApiError(409, m)

const PUBLIC_KEYS = ['id', 'employeeCode', 'firstName', 'lastName', 'department', 'position', 'status', 'startDate']
const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj[k]]))
const toPublic = (e) => pick(e, PUBLIC_KEYS)

const describeUser = (u) => {
  const emp = db.employees.find((e) => e.id === u.employeeId)
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    roleLabel: ROLE_LABELS[u.role],
    employeeId: u.employeeId,
    displayName: emp ? `${emp.firstName} ${emp.lastName}` : u.username,
    permissions: permissionsFor(u.role),
  }
}

const requirePerm = (user, permission) => {
  if (!can(user.role, permission)) throw forbidden()
}
// The system serves one department only. Records outside it are invisible, except a user's own record.
const inScope = (e) => e.department === DEPARTMENT
const scopedEmployees = () => db.employees.filter(inScope)
const getEmployee = (id, user) => {
  const e = db.employees.find((x) => x.id === Number(id))
  if (!e || (!inScope(e) && e.id !== user?.employeeId)) throw notFound('ไม่พบข้อมูลพนักงาน')
  return e
}
const addHistory = (employeeId, eventType, description, eventDate) =>
  db.history.push({ id: nextId('history'), employeeId, eventType, description, eventDate })
const codeTaken = (code, exceptId = 0) => db.employees.some((e) => e.employeeCode === code && e.id !== exceptId)

const currentSalary = (employeeId) =>
  db.salaries
    .filter((s) => s.employeeId === employeeId && s.effectiveDate <= todayIso())
    .sort((a, b) => (a.effectiveDate === b.effectiveDate ? b.id - a.id : a.effectiveDate < b.effectiveDate ? 1 : -1))[0]

const routes = []
const route = (method, pattern, handler, { auth = true } = {}) =>
  routes.push({ method, auth, handler, re: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`) })

route('POST', '/auth/login', ({ body }) => {
  const { username, password } = body || {}
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    throw new ApiError(400, 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน')
  }
  const user = db.users.find((u) => u.username === username.trim())
  if (!user || user.password !== password) throw new ApiError(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
  return { token: `mock-token-${user.id}`, user: describeUser(user) }
}, { auth: false })

// MOCK sign-up adapter. The real backend has no registration endpoint yet (backend/src/routes/auth.js only has
// login and me), so this only simulates the intended behaviour in memory: nothing is persisted and the
// account disappears when the page is reloaded. Rules it enforces (a real server must enforce them too):
//  - the role is ALWAYS 'employee' (any role sent by the client is ignored)
//  - usernames must be unique (case-insensitive)
// The account is NOT linked to an employee record (no employee verification), so it can see no employee data.
route('POST', '/auth/register', ({ body }) => {
  const b = body && typeof body === 'object' ? body : {}
  const errors = validateRegistration(b)
  if (Object.keys(errors).length) throw new ApiError(400, 'ข้อมูลการสมัครไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง', errors)

  const username = String(b.username).trim()
  if (db.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    throw new ApiError(409, 'ชื่อผู้ใช้นี้ถูกใช้แล้ว', { username: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว กรุณาเลือกชื่ออื่น' })
  }

  // in-memory only (never written to localStorage); a real backend stores a bcrypt hash
  db.users.push({ id: nextId('users'), username, password: b.password, role: 'employee', employeeId: null })
  return { username, role: 'employee', roleLabel: ROLE_LABELS.employee, mock: true }
}, { auth: false })

route('GET', '/auth/me', ({ user }) => ({ user: describeUser(user) }))

// Fictional evaluation fixtures belong only to the demo data source; writes require the backend.
const evaluationEmployee = (user, query) => {
  requirePerm(user, 'evaluation:view')
  const code = (query.get('employeeCode') || '').trim().toUpperCase()
  const employee = db.employees.find(e => e.employeeCode.toUpperCase() === code && (inScope(e) || e.id === user.employeeId))
  if (!employee) throw notFound('ไม่พบข้อมูลพนักงาน')
  if (!can(user.role, 'evaluation:manage') && employee.id !== user.employeeId) throw forbidden('คุณดูได้เฉพาะผลการประเมินของตนเองเท่านั้น')
  return toPublic(employee)
}
route('GET', '/evaluations/employee', ({ user, query }) => ({ employee: evaluationEmployee(user, query) }))
route('GET', '/evaluations', ({ user, query }) => {
  const employee = evaluationEmployee(user, query)
  const evaluations = db.evaluations.filter(record => record.employeeId === employee.id)
    .sort((a, b) => b.evaluationDate.localeCompare(a.evaluationDate) || b.id - a.id)
  return { employee, evaluations }
})
route('POST', '/evaluations', ({ user }) => {
  requirePerm(user, 'evaluation:manage')
  throw new ApiError(503, 'การบันทึกผลการประเมินต้องเชื่อมต่อระบบฐานข้อมูลจริง')
})

route('GET', '/dashboard/summary', ({ user }) => {
  const staff = scopedEmployees()
  const selfOnly = can(user.role, 'employee:selfOnly')
  const sorted = [...staff].sort((a, b) => (a.startDate === b.startDate ? b.id - a.id : a.startDate < b.startDate ? 1 : -1))
  return {
    // self-only roles get no organisation-wide statistics and no other employees' details
    counts: selfOnly
      ? null
      : {
          total: staff.length,
          active: staff.filter((e) => e.status === 'active').length,
          resigned: staff.filter((e) => e.status === 'resigned').length,
        },
    recentEmployees: selfOnly ? [] : sorted.slice(0, 5).map((e) => pick(e, ['id', 'employeeCode', 'firstName', 'lastName', 'position', 'startDate', 'status'])),
    announcements: [...db.announcements].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1)).slice(0, 5),
  }
})

route('GET', '/employees', ({ user, query }) => {
  requirePerm(user, 'employee:search')
  const q = (query.get('q') || '').trim().toLowerCase()
  const status = query.get('status') || ''
  if (status && !['active', 'resigned'].includes(status)) throw new ApiError(400, 'สถานะไม่ถูกต้อง')
  const rows = scopedEmployees()
    .filter((e) => !q || `${e.employeeCode} ${e.firstName} ${e.lastName} ${e.firstName}${e.lastName}`.toLowerCase().includes(q))
    .filter((e) => !status || e.status === status)
    .sort((a, b) => a.employeeCode.localeCompare(b.employeeCode))
  return { total: rows.length, employees: rows.slice(0, 200).map(toPublic) }
})

route('GET', '/employees/departments', ({ user }) => {
  requirePerm(user, 'employee:search')
  return { departments: [DEPARTMENT] }
})

route('GET', '/employees/resigned', ({ user }) => {
  requirePerm(user, 'resignation:manage')
  const rows = scopedEmployees()
    .filter((e) => e.status === 'resigned')
    .sort((a, b) => (a.resignationDate < b.resignationDate ? 1 : -1))
  return { employees: rows.map((e) => ({ ...toPublic(e), resignationDate: e.resignationDate, resignationReason: e.resignationReason })) }
})

route('GET', '/employees/:id', ({ user, params }) => {
  requirePerm(user, 'employee:view')
  const e = getEmployee(params.id, user)
  const isSelf = user.employeeId === e.id
  // self-only roles can never read another employee's record
  if (can(user.role, 'employee:selfOnly') && !isSelf) throw forbidden('คุณดูได้เฉพาะข้อมูลของตนเองเท่านั้น')
  const confidentialVisible = isSelf || can(user.role, 'employee:viewConfidential')
  return {
    employee: {
      ...toPublic(e),
      resignationDate: e.resignationDate,
      ...(confidentialVisible ? pick(e, ['nationalId', 'phone', 'email', 'address', 'resignationReason']) : {}),
    },
    confidentialVisible,
    isSelf,
    history: db.history
      .filter((h) => h.employeeId === e.id)
      .sort((a, b) => (a.eventDate === b.eventDate ? b.id - a.id : a.eventDate < b.eventDate ? 1 : -1))
      .map((h) => pick(h, ['id', 'eventType', 'description', 'eventDate'])),
  }
})

route('POST', '/employees', ({ user, body }) => {
  requirePerm(user, 'employee:manage')
  const data = parseEmployee({ ...body, department: DEPARTMENT })
  if (codeTaken(data.employeeCode)) throw conflict('รหัสพนักงานนี้มีอยู่ในระบบแล้ว')
  const emp = { id: nextId('employees'), ...data, status: 'active', resignationDate: null, resignationReason: null }
  db.employees.push(emp)
  addHistory(emp.id, 'hired', `เริ่มงานในตำแหน่ง ${emp.position} แผนก ${emp.department}`, emp.startDate)
  return { employee: toPublic(emp) }
})

route('PUT', '/employees/:id', ({ user, params, body }) => {
  requirePerm(user, 'employee:manage')
  const old = getEmployee(params.id, user)
  const data = parseEmployee({ ...body, department: DEPARTMENT })
  if (codeTaken(data.employeeCode, old.id)) throw conflict('รหัสพนักงานนี้มีอยู่ในระบบแล้ว')
  const date = todayIso()
  let logged = false
  if (old.position !== data.position) {
    addHistory(old.id, 'position_changed', `เปลี่ยนตำแหน่งจาก ${old.position} เป็น ${data.position}`, date)
    logged = true
  }
  if (old.department !== data.department) {
    addHistory(old.id, 'department_changed', `ย้ายแผนกจาก ${old.department} เป็น ${data.department}`, date)
    logged = true
  }
  const changedOther = ['employeeCode', 'firstName', 'lastName', 'startDate', 'nationalId', 'phone', 'email', 'address']
    .some((k) => (old[k] ?? null) !== (data[k] ?? null))
  if (!logged && changedOther) addHistory(old.id, 'updated', 'แก้ไขข้อมูลพนักงาน', date)
  Object.assign(old, data) // status is never changed through update
  return { employee: toPublic(old) }
})

route('POST', '/employees/:id/resign', ({ user, params, body }) => {
  requirePerm(user, 'resignation:manage')
  const emp = getEmployee(params.id, user)
  const { resignationDate, reason } = parseResignation(body)
  if (emp.status === 'resigned') throw conflict('พนักงานคนนี้ลาออกแล้ว')
  if (resignationDate < emp.startDate) {
    throw new ApiError(400, 'ข้อมูลการลาออกไม่ถูกต้อง', { resignationDate: 'วันที่ลาออกต้องไม่ก่อนวันที่เริ่มงาน' })
  }
  if (resignationDate > todayIso()) {
    throw new ApiError(400, 'ข้อมูลการลาออกไม่ถูกต้อง', { resignationDate: 'วันที่ลาออกต้องไม่เป็นวันในอนาคต' })
  }
  Object.assign(emp, { status: 'resigned', resignationDate, resignationReason: reason })
  addHistory(emp.id, 'resigned', 'ลาออกจากองค์กร', resignationDate)
  return { employee: toPublic(emp) }
})

// Frontend-only extension (not in backend yet): return a resigned employee to active status.
route('POST', '/employees/:id/reinstate', ({ user, params }) => {
  requirePerm(user, 'resignation:manage')
  const emp = getEmployee(params.id, user)
  if (emp.status !== 'resigned') throw conflict('พนักงานคนนี้ยังปฏิบัติงานอยู่')
  Object.assign(emp, { status: 'active', resignationDate: null, resignationReason: null })
  addHistory(emp.id, 'reinstated', 'กลับเข้าปฏิบัติงาน', todayIso())
  return { employee: toPublic(emp) }
})

route('GET', '/salaries', ({ user }) => {
  requirePerm(user, 'salary:manage')
  return {
    employees: scopedEmployees()
      .sort((a, b) => a.employeeCode.localeCompare(b.employeeCode))
      .map((e) => {
        const cur = currentSalary(e.id)
        return { ...toPublic(e), currentAmount: cur ? cur.amount : null, currentSince: cur ? cur.effectiveDate : null }
      }),
  }
})

route('GET', '/employees/:id/salaries', ({ user, params }) => {
  const emp = getEmployee(params.id, user)
  // finance manages; HR may only read (salary:view); employees read their own
  if (!(can(user.role, 'salary:manage') || can(user.role, 'salary:view') || user.employeeId === emp.id)) throw forbidden('คุณไม่มีสิทธิ์ดูข้อมูลเงินเดือน')
  const rows = db.salaries
    .filter((s) => s.employeeId === emp.id)
    .sort((a, b) => (a.effectiveDate === b.effectiveDate ? b.id - a.id : a.effectiveDate < b.effectiveDate ? 1 : -1))
  return { salaries: rows.map((s) => ({ ...s })), canManage: can(user.role, 'salary:manage') }
})

route('POST', '/employees/:id/salaries', ({ user, params, body }) => {
  requirePerm(user, 'salary:manage')
  const emp = getEmployee(params.id, user)
  if (emp.status === 'resigned') throw new ApiError(400, 'ไม่สามารถเพิ่มเงินเดือนให้พนักงานที่ลาออกแล้ว')
  const d = parseSalary(body)
  const salary = { id: nextId('salaries'), employeeId: emp.id, ...d }
  db.salaries.push(salary)
  return { salary: { ...salary } }
})

route('PUT', '/salaries/:id', ({ user, params, body }) => {
  requirePerm(user, 'salary:manage')
  const s = db.salaries.find((x) => x.id === Number(params.id))
  if (!s) throw notFound('ไม่พบรายการเงินเดือน')
  Object.assign(s, parseSalary(body))
  return { salary: { ...s } }
})

const LATENCY_MS = import.meta.env?.MODE === 'test' ? 0 : 250

export async function mockRequest(path, { method = 'GET', body, token } = {}) {
  await new Promise((r) => setTimeout(r, LATENCY_MS))
  const [pathname, search = ''] = path.split('?')
  const match = routes
    .map((r) => ({ r, m: r.method === method ? pathname.match(r.re) : null }))
    .find((x) => x.m)
  if (!match) throw new ApiError(404, 'ไม่พบเส้นทางที่ร้องขอ')

  let user = null
  if (match.r.auth) {
    const id = token?.startsWith('mock-token-') ? Number(token.slice(11)) : NaN
    const u = db.users.find((x) => x.id === id)
    if (!u) throw unauthorized()
    user = u
  }
  // JSON round-trip so callers can never mutate the mock store by reference
  const result = match.r.handler({ user, params: match.m.groups || {}, query: new URLSearchParams(search), body })
  return JSON.parse(JSON.stringify(result))
}
