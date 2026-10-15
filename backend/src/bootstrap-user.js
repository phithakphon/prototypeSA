// Creates the FIRST privileged accounts of a fresh production database (there is no seed in production, and employees
// are created by a manager while accounts are linked by HR, so someone has to start the chain).
//
//   1. Put the password in the environment for this run only (never on the command line, never in git):
//        BOOTSTRAP_PASSWORD=...   (at least 12 characters with lower case, upper case and a digit)
//   2. npm run bootstrap:user -- --username hr.admin --role hr --employee-code E201 --first-name สมหญิง --last-name ใจดี --position "เจ้าหน้าที่ฝ่ายบุคคล" --start-date 2024-01-15 --create-employee
//        DRY RUN: validates and prints the plan, writes nothing.
//   3. Add  --execute --confirm-bootstrap  to really write it (one transaction).
//
// Without --create-employee the account is linked to an EXISTING employee code that has no account yet.
// The password is hashed with bcrypt and never printed. Nothing existing is changed or removed.
import bcrypt from 'bcrypt'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './config.js'
import { createDb } from './db.js'
import { parseEmployee } from './validate.js'
import { passwordProblems } from './rotate-passwords.js'
import { SUPPORTED_DEPARTMENT } from './scope.js'

const ROLES = ['manager', 'hr', 'finance', 'executive']

export function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    out[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true
  }
  return out
}

// Returns { plan, problems }. Does not write anything unless execute is true and there are no problems.
export async function bootstrapUser(db, { args, password, execute }) {
  const problems = []
  const username = typeof args.username === 'string' ? args.username.trim() : ''
  const role = args.role
  if (!/^[A-Za-z][A-Za-z0-9._-]{3,19}$/.test(username)) problems.push('--username ต้องมี 4-20 ตัวอักษร ขึ้นต้นด้วยตัวอักษร (a-z, 0-9, . - _)')
  if (!ROLES.includes(role)) problems.push(`--role ต้องเป็นหนึ่งใน ${ROLES.join(', ')}`)
  problems.push(...passwordProblems(password).map((p) => `รหัสผ่าน: ${p}`))
  const code = typeof args['employee-code'] === 'string' ? args['employee-code'].trim().toUpperCase() : ''
  if (!code) problems.push('--employee-code จำเป็น')

  const createEmployee = args['create-employee'] === true
  let employee = null
  if (createEmployee) {
    try {
      employee = parseEmployee({
        employeeCode: code,
        firstName: args['first-name'],
        lastName: args['last-name'],
        department: SUPPORTED_DEPARTMENT, // the system serves one department: new employees are always saved in it
        position: args.position,
        startDate: args['start-date'],
      })
    } catch (e) {
      problems.push(...Object.values(e.details || { x: e.message }))
    }
  }

  const plan = { username, role, employeeCode: code, createEmployee, department: createEmployee ? SUPPORTED_DEPARTMENT : null }
  if (problems.length) return { plan, problems, done: false }

  const existingUser = (await db.query('SELECT 1 FROM users WHERE lower(username) = lower($1)', [username])).rows[0]
  if (existingUser) problems.push('ชื่อผู้ใช้นี้มีอยู่แล้ว')
  const existingEmp = (await db.query('SELECT id, status FROM employees WHERE employee_code = $1', [code])).rows[0]
  if (createEmployee && existingEmp) problems.push('รหัสพนักงานนี้มีอยู่แล้ว (ไม่สร้างทับ) — ตัด --create-employee เพื่อผูกกับพนักงานเดิม')
  if (!createEmployee) {
    if (!existingEmp) problems.push('ไม่พบพนักงานรหัสนี้ (ใช้ --create-employee เพื่อสร้างใหม่)')
    else if (existingEmp.status !== 'active') problems.push('พนักงานคนนี้ลาออกแล้ว')
    else if ((await db.query('SELECT 1 FROM users WHERE employee_id = $1', [existingEmp.id])).rows[0]) problems.push('พนักงานคนนี้มีบัญชีผู้ใช้อยู่แล้ว')
  }
  if (problems.length || !execute) return { plan, problems, done: false }

  const hash = await bcrypt.hash(password, 10)
  await db.transaction(async (tx) => {
    let employeeId = existingEmp?.id
    if (createEmployee) {
      const { rows } = await tx.query(
        `INSERT INTO employees (employee_code, first_name, last_name, department, position, start_date)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [employee.employeeCode, employee.firstName, employee.lastName, employee.department, employee.position, employee.startDate],
      )
      employeeId = rows[0].id
    }
    const { rows } = await tx.query('INSERT INTO users (username, password_hash, role, employee_id) VALUES ($1, $2, $3, $4) RETURNING id', [
      username, hash, role, employeeId,
    ])
    if (createEmployee) {
      await tx.query('INSERT INTO employee_history (employee_id, event_type, description, event_date, created_by) VALUES ($1, $2, $3, $4, $5)', [
        employeeId, 'hired', `เริ่มงานในตำแหน่ง ${employee.position} แผนก ${employee.department}`, employee.startDate, rows[0].id,
      ])
    }
  })
  return { plan, problems, done: true }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2))
  const execute = args.execute === true
  if (execute && args['confirm-bootstrap'] !== true) {
    console.error('การสร้างจริงต้องใส่ทั้ง --execute และ --confirm-bootstrap')
    process.exit(1)
  }
  let config
  try {
    config = loadConfig()
  } catch (err) {
    console.error(`ตั้งค่าไม่ถูกต้อง: ${err.message}`)
    process.exit(1)
  }
  const db = createDb(config)
  try {
    console.log(`${execute ? 'EXECUTE' : 'DRY RUN'} — host: ${config.dbHost} (ไม่แสดงรหัสผ่าน)`)
    const r = await bootstrapUser(db, { args, password: process.env.BOOTSTRAP_PASSWORD, execute })
    console.log('แผน:', JSON.stringify(r.plan))
    if (r.problems.length) {
      console.error(`ไม่ผ่านเงื่อนไข:\n- ${r.problems.join('\n- ')}`)
      process.exitCode = 1
    } else if (r.done) {
      console.log('สร้างบัญชีเรียบร้อยแล้ว — ลบ BOOTSTRAP_PASSWORD ออกจากสภาพแวดล้อมของคุณ')
    } else {
      console.log('ผ่านเงื่อนไขทั้งหมด — เมื่อพร้อม เพิ่ม --execute --confirm-bootstrap')
    }
  } catch (err) {
    console.error('ไม่สำเร็จ:', err.message)
    process.exitCode = 1
  } finally {
    await db.close()
  }
}

